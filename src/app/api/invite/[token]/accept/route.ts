import { NextResponse } from "next/server";
import { writeSession } from "@/lib/session";
import { asPartyId } from "@/domain/case/types";
import { isWellFormedToken } from "@/domain/invitation/token";
import { transition } from "@/domain/invitation/stateMachine";
import { findByToken, updateStatus } from "@/infra-adapters/firestore/repositories/invitationRepository";
import { verifyIdToken } from "@/lib/verifyIdToken";

/**
 * 招待の受諾・辞退
 *
 * ★受諾には認証が要る。誰が参加したのかが確定しないと、
 *   以降どちらのセッションに紐づくかが決まらない。
 *
 * ★辞退も明示的に扱う。「返事をしない」以外の選択肢を用意する。
 */
/**
 * ★★ 受諾には、本人確認が要る（2026-08-14 に変更）。
 *
 *   以前は「有効な招待トークンを持っていること自体が本人性の根拠」としていた。
 *   だがそれだと、**受け取った側は authUid を持たないまま参加する。**
 *   セッションの Cookie を失えば、二度と戻れない。
 *
 *   ★片側だけ辿れない状態を残さない。**招待した側と同じ扱いにする。**
 *
 * ★辞退には要らない。**断るのに、アカウントを作らせない。**
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const { action, idToken } = (await req.json()) as {
    action?: "ACCEPT" | "DECLINE";
    idToken?: string;
  };
  if (action !== "ACCEPT" && action !== "DECLINE") {
    return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
  }
  if (!isWellFormedToken(token)) {
    return NextResponse.json({ error: "このリンクは使えません" }, { status: 404 });
  }

  // ★受諾のときだけ、本人確認を先に通す。**辞退は素通し**
  let uid: string | null = null;
  if (action === "ACCEPT") {
    const v = await verifyIdToken(idToken ?? "");
    if (!v) {
      return NextResponse.json(
        { error: "メールアドレスのご確認が必要です", needsAuth: true },
        { status: 401 },
      );
    }
    uid = v.uid;
  }

  const inv = await findByToken(token);
  // ★存在しないトークンと期限切れを区別しない（探索に使われるため）
  if (!inv) return NextResponse.json({ error: "このリンクは使えません" }, { status: 404 });
  if (new Date(inv.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "このリンクは期限が切れています" }, { status: 410 });
  }

  let next;
  try {
    next = transition(inv.status, action);
  } catch {
    return NextResponse.json({ error: "このリンクは使えません" }, { status: 409 });
  }

  // ★受諾した側の当事者。招待に紐づくケースの、招待者でないほう
  const joinedPartyId = await resolveJoiningParty(inv.caseId, inv.createdByPartyId);

  await updateStatus(inv.id, {
    status: next,
    ...(action === "ACCEPT"
      ? { acceptedAt: new Date().toISOString(), acceptedByPartyId: joinedPartyId ?? undefined }
      : {}),
  });

  if (action === "ACCEPT" && joinedPartyId) {
    // ★参加した時点で結びつける。**認証済みでない当事者を残さない**
    if (uid) {
      const { linkAuthUid } = await import(
        "@/infra-adapters/firestore/repositories/caseRepository"
      );
      const { asCaseId } = await import("@/domain/case/types");
      await linkAuthUid(asCaseId(inv.caseId), asPartyId(joinedPartyId), uid);
    }
    // ★ここで初めてセッションが発行される。招待を経ずにセッションは作れない
    await writeSession({ partyId: joinedPartyId, caseId: inv.caseId });
    await activateCase(inv.caseId, joinedPartyId);
  }

  return NextResponse.json({ status: next });
}

/** 招待者でないほうの当事者を返す */
async function resolveJoiningParty(caseId: string, inviterPartyId: string): Promise<string | null> {
  const { findOtherPartyId } = await import(
    "@/infra-adapters/firestore/repositories/caseRepository"
  );
  const { asCaseId } = await import("@/domain/case/types");
  return await findOtherPartyId(asCaseId(caseId), asPartyId(inviterPartyId));
}

/** 受諾でケースが動き出す */
async function activateCase(caseId: string, partyId: string): Promise<void> {
  const { patchParty } = await import("@/infra-adapters/firestore/repositories/caseRepository");
  const { asCaseId } = await import("@/domain/case/types");
  await patchParty(asCaseId(caseId), asPartyId(partyId), { state: "ACTIVE" });
}
