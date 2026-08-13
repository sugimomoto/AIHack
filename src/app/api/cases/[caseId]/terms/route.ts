import { NextResponse } from "next/server";
import { resolveParty } from "@/lib/resolveParty";
import { errorResponse } from "../messages/route";
import { recordConsent } from "@/services/agreement";
import { asCaseId, type PartyId } from "@/domain/case/types";
import { assertOwnParty } from "@/domain/case/scope";
import { IMPLEMENTED_TOPICS, TOPIC_LABEL, isAgreementTopic } from "@/domain/agreement/topics";
import {
  canShare,
  canWithdraw,
  isVisibleTo,
  shareNotice,
  withdrawNotice,
} from "@/domain/agreement/sharing";
import {
  appendMediationEvent,
  appendProposal,
  findOtherPartyId,
  listProposalsByTopic,
  loadForLlm,
  setConsent,
  shareProposal,
  withdrawProposal,
} from "@/infra-adapters/firestore/repositories/caseRepository";

/**
 * 取り決めの入力
 *
 * ★ここが、取り決めを作れる**唯一の入口**である。
 *   対話からは作られない（tests/invariants/proposalOrigin.test.ts で固定）。
 *
 * ★仮案を作って、了承してもらう。
 *
 *     SAVE     … 下書きとして残す。**相手には見えない**
 *     SHARE    … お相手に見ていただく。ここで初めて相手に現れる
 *     WITHDRAW … 取り下げる。★「見ていない状態」には戻せない
 *     APPROVE  … お相手の案を了承する。→ 合意
 *
 *   双方が独立に記入して一致を待つ形ではない。そんな一致は起きない。
 *   ★了承する側は**同じ仮案に**承諾するので、内容は必ず一致する。
 *
 * ★AIを通さない。当事者が書いた数字をそのまま記録する（P3）。
 */

type Action = "SAVE" | "SHARE" | "WITHDRAW" | "APPROVE";

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId: rawCaseId } = await ctx.params;
  const caseId = asCaseId(rawCaseId);
  try {
    const partyId = await resolveParty(req);
    const snap = await loadForLlm(caseId);
    assertOwnParty(snap, partyId);

    const body = (await req.json()) as {
      topic?: string;
      payload?: Record<string, unknown>;
      action?: Action;
    };
    const topic = body.topic;

    // ★扱えない論点を受け付けない。入口に出していないものは、入れさせない
    if (!topic || !isAgreementTopic(topic) || !IMPLEMENTED_TOPICS.includes(topic)) {
      return NextResponse.json({ error: "扱えない論点です" }, { status: 400 });
    }

    switch (body.action ?? "SAVE") {
      case "SAVE":
        return await save(caseId, partyId, topic, body.payload);
      case "SHARE":
        return await share(caseId, partyId, topic);
      case "WITHDRAW":
        return await withdraw(caseId, partyId, topic);
      case "APPROVE":
        return await approve(caseId, partyId, topic);
      default:
        return NextResponse.json({ error: "不明な操作です" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * 下書きとして残す。
 *
 * ★渡さない。**書いた時点では、相手に何も起きない。**
 *   下書きは考えるための場所であり、見られていると書けなくなる。
 *
 * ★自分の承諾は付けておく。書いた内容が自分の意思であることは、
 *   改めて確かめるまでもない。
 */
async function save(
  caseId: ReturnType<typeof asCaseId>,
  partyId: PartyId,
  topic: string,
  payload: Record<string, unknown> | undefined,
) {
  if (!payload || Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "内容が空です" }, { status: 400 });
  }

  const id = await appendProposal(caseId, {
    byPartyId: partyId,
    topic,
    payload,
    context: "",
    contextCategories: [],
    status: "PENDING",
    // ★今回だけの融通ではない。取り決めそのもの
    effect: "PERMANENT",
    // ★既定は下書き。渡すのは別の操作
    sharedAt: null,
  });
  await setConsent(caseId, topic, partyId, "ACCEPTED");

  return NextResponse.json({ ok: true, proposalId: id, shared: false });
}

/** ★自分の最新の仮案 */
async function latestOwn(
  caseId: ReturnType<typeof asCaseId>,
  partyId: PartyId,
  topic: string,
) {
  const all = await listProposalsByTopic(caseId, topic);
  return [...all].reverse().find((p) => p.byPartyId === partyId) ?? null;
}

/**
 * お相手に見ていただく。
 *
 * ★状態を変えるだけで終わらせない。**届かなければ、変わっていないのと同じ。**
 * ★お知らせに原文は含まない。論点の名前だけ（C1）。
 */
async function share(
  caseId: ReturnType<typeof asCaseId>,
  partyId: PartyId,
  topic: string,
) {
  const mine = await latestOwn(caseId, partyId, topic);
  if (!mine || !mine.payload) {
    return NextResponse.json({ error: "お渡しできる案がありません" }, { status: 400 });
  }

  // ★一度取り下げたものを、そのまま出し直さない。
  //   同じ行の sharedAt を書き換えると、**取り下げた記録が消える。**
  //   複製して新しい仮案として出す。履歴は残る。
  let id = mine.id;
  if (mine.withdrawnAt !== null) {
    id = await appendProposal(caseId, {
      byPartyId: partyId,
      topic,
      payload: { ...mine.payload },
      context: "",
      contextCategories: [],
      status: "PENDING",
      effect: "PERMANENT",
      sharedAt: null,
    });
    await setConsent(caseId, topic, partyId, "ACCEPTED");
  } else if (!canShare(mine)) {
    return NextResponse.json({ error: "すでにお渡ししています" }, { status: 400 });
  }

  const at = await shareProposal(caseId, id);

  const to = await findOtherPartyId(caseId, partyId);
  if (to) {
    await appendMediationEvent(caseId, {
      fromPartyId: partyId,
      toPartyId: to,
      content: shareNotice(TOPIC_LABEL[topic as keyof typeof TOPIC_LABEL]),
      proposalId: id,
    }).catch((e) => console.error("[terms] お知らせの保存に失敗しました", e));
  }

  return NextResponse.json({ ok: true, sharedAt: at });
}

/**
 * 取り下げる。
 *
 * ★**「見ていない状態」には戻せない。**
 *   取り下げたことは、相手にも伝わる。黙って消さない。
 */
async function withdraw(
  caseId: ReturnType<typeof asCaseId>,
  partyId: PartyId,
  topic: string,
) {
  const mine = await latestOwn(caseId, partyId, topic);
  if (!mine || !canWithdraw(mine)) {
    return NextResponse.json({ error: "取り下げられる案がありません" }, { status: 400 });
  }

  const at = await withdrawProposal(caseId, mine.id);

  const to = await findOtherPartyId(caseId, partyId);
  if (to) {
    await appendMediationEvent(caseId, {
      fromPartyId: partyId,
      toPartyId: to,
      content: withdrawNotice(TOPIC_LABEL[topic as keyof typeof TOPIC_LABEL]),
    }).catch((e) => console.error("[terms] お知らせの保存に失敗しました", e));
  }

  return NextResponse.json({ ok: true, withdrawnAt: at });
}

/**
 * お相手の案を了承する。
 *
 * ★★ payload はサーバ側で複製する。**画面から受け取らない。**
 *   受け取ると、了承のふりをして別の内容を入れられる。
 *
 * ★これで「双方の提案が一致しているか」の検査は自明に真になる。
 *   歯止め（payloadsAgree）は残すが、通常の経路では働く必要が無くなる。
 */
async function approve(
  caseId: ReturnType<typeof asCaseId>,
  partyId: PartyId,
  topic: string,
) {
  const all = await listProposalsByTopic(caseId, topic);

  // ★見えているものだけが対象。下書きを了承できてはならない
  const theirs = [...all]
    .reverse()
    .find((p) => p.byPartyId !== partyId && isVisibleTo(p, partyId) && p.payload);

  if (!theirs || !theirs.payload) {
    return NextResponse.json({ error: "了承できる案がありません" }, { status: 400 });
  }

  await appendProposal(caseId, {
    byPartyId: partyId,
    topic,
    // ★複製。同じ内容であることが構造的に保証される
    payload: { ...theirs.payload },
    context: "",
    contextCategories: [],
    status: "PENDING",
    effect: "PERMANENT",
    // ★了承は下書きではない。その場で相手に伝わってよい
    sharedAt: new Date().toISOString(),
    // ★★ 承諾をやり直さない。
    //   payload はこのサーバが複製したものであり、相手の案と必ず同じである。
    //   やり直すと、了承した瞬間に相手の承諾が消えて合意にならない。
    keepConsents: true,
  });

  // ★★ setConsent だけでは合意にならない。**確定の判定を通す。**
  //   直接 setConsent を呼んでいたため、了承しても取り決めが作られず、
  //   公正証書の原案にも入らなかった（実機で検出）。
  const view = await recordConsent({ caseId, partyId, topic, status: "ACCEPTED" });

  return NextResponse.json({ ok: true, approved: true, state: view.state });
}
