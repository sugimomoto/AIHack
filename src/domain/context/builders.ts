import type { AgreementItemId, PartyId, ProposalId } from "@/domain/case/types";
import type { CaseSnapshot } from "./snapshot";

/**
 * ★C1（メッセージを転送しない）の実装本体
 *
 * LLM に渡すコンテキストは、このモジュールの出力のみとする。
 * エンジンがデータ層へ直接アクセスしてコンテキストを組み立てる経路を作らない。
 *
 * **防御をプロンプトに置かない。**
 * 「相手の住所を答えてはいけません」と指示するのではなく、
 * そもそもコンテキストに存在しない状態にする。
 * モデルが何を指示されても出力できない。
 *
 * @see docs/functional-design.md §5.2
 * @see docs/development-guidelines.md §2.5
 */

// ---------------------------------------------------------------------------
// ① 自分のセッション用
// ---------------------------------------------------------------------------

export type OwnContext = {
  /** 自分の対話履歴のみ */
  ownMessages: { role: "USER" | "AI"; content: string }[];
  /** 合意済みの構造化データ（双方共有） */
  agreement: { topic: string; payload: unknown; version: number }[];
  /** 自分宛のAI生成メッセージ */
  inbound: { content: string }[];
  /** 子の情報（双方共有の前提事実） */
  children: { birthDate: string }[];
};

/**
 * 自分のセッションのコンテキストを組み立てる。
 *
 * ❌ 相手の Message を取得しない
 * ❌ ContactInfo を取得しない（住所・電話・勤務先・年収）
 */
export function buildContext(snap: CaseSnapshot, partyId: PartyId): OwnContext {
  return {
    ownMessages: snap.messages
      .filter((m) => m.partyId === partyId) // ★自分のものだけ
      .map((m) => ({ role: m.role, content: m.content })),

    agreement: snap.agreementItems
      .filter((a) => a.status === "AGREED")
      .map((a) => ({ topic: a.topic, payload: a.payload, version: a.version })),

    inbound: snap.mediationEvents
      .filter((e) => e.toPartyId === partyId)
      .map((e) => ({ content: e.content })),

    children: snap.children.map((c) => ({ birthDate: c.birthDate })),
  };
}

// ---------------------------------------------------------------------------
// ② 相手への取次ぎ用 ★C1の実装本体
// ---------------------------------------------------------------------------

export type RelayContext = {
  topic: string;
  /** 構造化された提案 */
  payload: unknown;
  /** 抽出済みの背景事実（原文ではない／→ §5.1a） */
  context?: string;
  rationale?: string;
  /** 現在の合意（あれば） */
  currentAgreement: { payload: unknown; version: number } | null;
};

/**
 * 取次ぎ用のコンテキストを組み立てる。
 *
 * ★引数に partyId を取らない。
 *   したがって Message へ到達する経路が型レベルで存在しない。
 *   「気をつける」ではなく「書けない」状態にしている。
 *
 * ★この関数のシグネチャを変更してはならない。
 *   partyId を受け取れるようにした時点で、C1 の担保が失われる。
 */
export function buildRelayContext(
  snap: CaseSnapshot,
  proposalId: ProposalId,
): RelayContext {
  const p = snap.proposals.find((x) => x.id === proposalId);
  if (!p) throw new Error(`提案が見つかりません: ${proposalId}`);

  const item = snap.agreementItems.find((a) => a.id === p.agreementItemId);

  return {
    topic: item?.topic ?? "",
    payload: p.payload,
    context: p.context,
    rationale: p.rationale,
    currentAgreement:
      item && item.status === "AGREED"
        ? { payload: item.payload, version: item.version }
        : null,
  };
}

// ---------------------------------------------------------------------------
// ③ 調停用
// ---------------------------------------------------------------------------

export type MediationContext = {
  topic: string;
  /** 双方の提案。payload と抽出済みの事情のみ */
  proposals: { payload: unknown; context?: string }[];
  /** 算定表の参照に使う帯。★精密な年収は含まない */
  incomeBands: (string | null)[];
  children: { birthDate: string }[];
  currentAgreement: { payload: unknown; version: number } | null;
};

/**
 * 調停用のコンテキストを組み立てる。
 *
 * 双方のデータが唯一出会う場所だが、扱うのは payload と抽出済みの context のみ。
 * ★引数に partyId を取らない。
 */
export function buildMediationContext(
  snap: CaseSnapshot,
  agreementItemId: AgreementItemId,
): MediationContext {
  const item = snap.agreementItems.find((a) => a.id === agreementItemId);

  return {
    topic: item?.topic ?? "",
    proposals: snap.proposals
      .filter((p) => p.agreementItemId === agreementItemId)
      .map((p) => ({ payload: p.payload, context: p.context })),
    // ★帯だけ。ContactInfo.annualIncome は参照しない（INV-2a）
    incomeBands: snap.parties.map((p) => p.incomeBand),
    children: snap.children.map((c) => ({ birthDate: c.birthDate })),
    currentAgreement:
      item && item.status === "AGREED"
        ? { payload: item.payload, version: item.version }
        : null,
  };
}
