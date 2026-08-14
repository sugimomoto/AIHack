import { asCaseId, asConsultationId, type PartyId } from "@/domain/case/types";
import { respondTo } from "./dialogue";
import { buildRelay } from "./relay";
import {
  appendAdjustment,
  appendArrangement,
  appendMediationEvent,
  appendSafetyEvent,
  appendMessage,
  ensureConsultation,
  findOtherPartyId,
  loadForLlm,
  markMessageRelay,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { assertOwnParty, scopedInbound, scopedMessages, scopedOutbound } from "@/domain/case/scope";
import { parseEffect } from "@/domain/adjustment/flow";
import { consultationIdOf, parseThreadId } from "@/domain/consultation/thread";
import { arrangementFrom } from "@/domain/obligation/arrangement";
// ★assertNegotiable は使わなくなった（対話から取り決めへ行く経路が消えたため）。
//   関数そのものは残してある。二重の歯止めとして無害で、消すと戻せない。
import { canNegotiateAgreement, isAdjustment } from "@/domain/consultation/negotiable";
import { listScenarios } from "@/infra-adapters/firestore/repositories/masterRepository";
import { todayJst } from "@/lib/today";
import { requiresAgreement } from "@/domain/topic/level";
import { detectSafetyFlags, needsHumanReview, toSafetyEvent } from "@/domain/safety/detect";

/**
 * 相談の1往復
 *
 * ★保存の順序に意味がある。
 *
 *   1. 自分の発言を保存        … 相手からは読めない（partyId でスコープ）
 *   2. 受け止めを保存          … 同上
 *   3. 取次ぎを検査して保存    … ★ここで初めて相手側に現れる
 *
 * 3 が失敗しても 1・2 は残る。**受け止めは取次ぎに依存しない。**
 */

/** 合意済みの論点を、問いに差し込める形にする */
async function currentAgreementOf(
  caseId: ReturnType<typeof asCaseId>,
  topic: string | null,
): Promise<{ topic: string; summary: string } | null> {
  const { listAgreementItems } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  const items = await listAgreementItems(caseId);
  // ★話題に対応する合意を選ぶ。最古の1件しか見ないと、別の論点で問いが消える
  const agreed = items.find((i) => i.status === "AGREED" && i.payload && (!topic || i.topic === topic));
  if (!agreed) return null;

  const p = agreed.payload!;
  if (agreed.topic === "CHILD_SUPPORT" && typeof p.monthlyAmount === "number") {
    return { topic: agreed.topic, summary: `養育費は月額${p.monthlyAmount.toLocaleString()}円` };
  }
  if (agreed.topic === "VISITATION" && typeof p.frequency === "string") {
    const { CODE_LABELS } = await import("@/domain/document/builder");
    const f = CODE_LABELS.frequency?.[p.frequency] ?? null;
    if (f) return { topic: agreed.topic, summary: `面会交流は${f}` };
  }
  return null;
}

export type TurnResult = {
  reply: string;
  choices: { id: string; label: string }[];
  /** ★C3：合意を参照して出すお知らせ。選択は求めない */
  effectNotice: string | null;
  /** ★相手に届いた内容。届かなかった場合は null */
  relayed: string | null;
};

export async function postMessage(input: {
  caseId: string;
  partyId: PartyId;
  text: string;
  /**
   * ★旧：「今回だけ」「今後も」の選択。
   *   画面からは送られなくなった（選択肢をやめたため）。受け口だけ残す。
   */
  effect?: string | null;
  /** ★どの相談か。未指定なら既定の相談（K-1） */
  scenarioId?: string | null;
  /** ★どのスレッドか。同じトピックでも件ごとに分かれる */
  threadId?: string | null;
  title?: string | null;
}): Promise<TurnResult> {
  const caseId = asCaseId(input.caseId);
  // ★当事者であることを先に確かめる（A-1）
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  // ★相談は当事者ごとに分かれている。セッションが跨がらない構造そのもの。
  //   さらにシナリオごとに分かれる（K-1）。**提案は topic で引かれるため、
  //   相談が増えても合意の判定は壊れない。**
  const threadId = parseThreadId(input.threadId);
  const consultationId = asConsultationId(consultationIdOf(input.partyId, threadId));
  await ensureConsultation(caseId, consultationId, input.partyId, {
    scenarioId: input.scenarioId ?? null,
    threadId,
    title: input.title ?? null,
    initiatedBy: "SELF",
  });
  const userMessageId = await appendMessage(caseId, consultationId, {
    partyId: input.partyId,
    role: "USER",
    content: input.text,
  });

  // ★現在の取り決めを渡す。これがあるからこそ現在の内容を差し込める（C3）
  // ★先に分類して、その話題の合意を渡す
  // ★フラグを立てて記録するだけ。応答も画面も変えない。
  //   変えると「見抜かれた」という監視感が生まれる（§5.9）。
  //   通告するかどうかは、記録を読んだ人が決める。
  const flags = detectSafetyFlags(input.text);
  if (needsHumanReview(flags)) {
    await appendSafetyEvent(
      toSafetyEvent({
        caseId,
        partyId: input.partyId,
        flags,
        rawText: input.text, // ★原文を保全（FR-10）。G-F の意図的な例外
        createdAt: new Date().toISOString(),
      }),
    );
  }

  const r = await respondTo({
    caseId,
    consultationId,
    text: input.text,
    resolveAgreement: (topic) => currentAgreementOf(caseId, topic),
  });
  await appendMessage(caseId, consultationId, {
    partyId: input.partyId,
    role: "AI",
    content: r.reply,
  });

  // ★種別はサーバ側で引く。画面から渡させると、
  //   個別相談を FORMAL と偽って取り決めを動かせてしまう。
  const scenarioKind = input.scenarioId ? await kindOf(input.scenarioId) : null;

  const relayed = await relayIfNeeded({
    caseId,
    consultationId,
    partyId: input.partyId,
    raw: input.text,
    intents: r.intents,
    topic: r.topic,
    // ★お知らせで「今回だけのご相談として承ります」と伝えている。
    //   記録もそのとおりにする。**言ったことと残るものを食い違わせない。**
    effect: parseEffect(input.effect) ?? (r.effectNotice ? "ONE_TIME" : null),
    scenarioId: input.scenarioId ?? null,
    threadId,
    title: input.title ?? null,
    scenarioKind,
  });

  // ★届いたかどうかを、その発言に残す。
  //   画面が「取り次がれたのか」を後から示せるようにする。
  await markMessageRelay(caseId, consultationId, userMessageId, relayed !== null).catch(() => {});

  return { reply: r.reply, choices: r.choices, effectNotice: r.effectNotice, relayed };
}

/** ★取次ぎの失敗で受け止めを巻き戻さない */
async function relayIfNeeded(input: {
  caseId: ReturnType<typeof asCaseId>;
  consultationId: ReturnType<typeof asConsultationId>;
  partyId: PartyId;
  raw: string;
  intents: Parameters<typeof buildRelay>[0]["intents"];
  topic: string | null;
  effect: "ONE_TIME" | "PERMANENT" | null;
  /** ★どの相談から出たか */
  scenarioId?: string | null;
  threadId?: string | null;
  title?: string | null;
  /** ★取り決めを動かしてよい相談か（FORMAL だけ） */
  scenarioKind?: string | null;
}): Promise<string | null> {
  try {
    const relay = await buildRelay({
      caseId: input.caseId,
      consultationId: input.consultationId,
      raw: input.raw,
      intents: input.intents,
      topic: input.topic,
      // ★取り決めを動かさない相談は、柔軟なスキーマで取り出す（設計どおり）
      flexible: !canNegotiateAgreement(input.scenarioKind),
    });
    if (!relay) return null;

    const to = await findOtherPartyId(input.caseId, input.partyId);
    if (!to) return null;

    // ★★ 取り決めは、対話から作らない。
    //
    //   以前はここで appendProposal を呼び、抽出した値で取り決めを作っていた。
    //   そこから実測で3つの欠陥が出た：
    //     ・「進学費用」の相談が、合意済みの養育費の月額を書き換えうる状態だった
    //     ・抽出が品目を言い換え、「スマホ代」が「コピー代」に化けた
    //     ・はっきり書いた人ほど、逐語一致の検査で伝わる中身が減っていた
    //
    //   取り決めは「取り決め」画面の入力だけで作る（仮案 → 了承）。
    //
    // ★★ ただし、ADJUSTMENT と NOTIFICATION の区別まで一緒に落としてはいけない。
    //
    //   一度落としてしまい、**お知らせが「決まったこと」に控えを残した。**
    //   実測：運動会の写真を共有すると `{"subject":"入学金"}` が控えになった。
    //
    //     FORMAL       → 取次ぎのみ（★取り決めは作らない。今回の方針）
    //     ADJUSTMENT   → 取次ぎ ＋ 控え（Adjustment）
    //     NOTIFICATION → 取次ぎのみ。**合意を求めない連絡に、控えは要らない**
    //
    // ★payload が無ければ、記録する内容が無い。
    if (isAdjustment(input.scenarioKind) && relay.payload && input.threadId) {
      await appendAdjustment(input.caseId, {
        threadId: input.threadId,
        scenarioId: input.scenarioId ?? null,
        topic: input.topic ?? "OTHER",
        byPartyId: input.partyId,
        change: relay.payload,
        effect: input.effect,
      }).catch((e) => console.error("[consultation] 調整の保存に失敗しました", e));
    }

    // ★受け取る側にも同じスレッドの相談を用意する。
    //   これが無いと、届いたのに**相手の一覧に行が立たない。**
    if (input.threadId) {
      await ensureConsultation(
        input.caseId,
        asConsultationId(consultationIdOf(to, input.threadId)),
        to,
        {
          scenarioId: input.scenarioId ?? null,
          threadId: input.threadId,
          title: input.title ?? null,
          // ★相手が始めた相談。受け取る側から見れば「お相手から」
          initiatedBy: "OTHER",
        },
      ).catch(() => {});
    }

    // ★L2（調整）で了承されたものを、軽い約束として残す。
    //   取り決めにはしない（公正証書には載らない）が、
    //   **了承した日付が消えるのはおかしい。**「これから」にだけ載せる。
    if (!requiresAgreement(input.topic ?? "OTHER")) {
      const a = arrangementFrom({
        payload: relay.payload,
        intents: input.intents,
        today: todayJst(),
      });
      if (a) {
        await appendArrangement(input.caseId, {
          threadId: input.threadId ?? null,
          date: a.date,
          label: a.label,
          byPartyId: input.partyId,
        }).catch(() => {});
      }
    }

    await appendMediationEvent(input.caseId, {
      fromPartyId: input.partyId,
      toPartyId: to, // ★宛先。scopedInbound の拠り所
      scenarioId: input.scenarioId ?? null,
      threadId: input.threadId ?? null, // ★相手側でも同じスレッドに並べる
      content: relay.content,
    });

    return relay.content;
  } catch (e) {
    console.error("[consultation] 取次ぎの保存に失敗しました", e);
    return null;
  }
}

/**
 * 画面の再現。
 *
 * ★自分のメッセージと、自分宛の取次ぎだけを返す。
 *   相手の原文へ到達する経路が、この関数にも存在しない。
 */
export async function loadView(input: {
  caseId: string;
  partyId: PartyId;
  threadId?: string | null;
}) {
  const caseId = asCaseId(input.caseId);
  const snap = await loadForLlm(caseId);
  assertOwnParty(snap, input.partyId);

  const threadId = parseThreadId(input.threadId);
  const consultationId = asConsultationId(consultationIdOf(input.partyId, threadId));
  return {
    messages: scopedMessages(snap, consultationId, input.partyId).map((m) => ({
      role: m.role,
      content: m.content,
      relayed: m.relayed,
      createdAt: m.createdAt,
    })),
    inbound: scopedInbound(snap, input.partyId, threadId),
    // ★自分が送ったものが、どう伝わったか
    outbound: scopedOutbound(snap, input.partyId, threadId),
  };
}

/** シナリオの種別。★取得できなければ、取り決めに触れない側に倒す */
async function kindOf(scenarioId: string): Promise<string | null> {
  try {
    return (await listScenarios()).find((s) => s.id === scenarioId)?.kind ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
