/**
 * モックのデータモデル
 *
 * ★設計の核：このモデル自体が C1（メッセージを転送しない）を体現する。
 *
 * イベント列を1本だけ持ち、視点ごとにフィルタして描画する。
 * `own` イベントは `party` が一致する視点にしか現れないため、
 * **相手の生の発言は、実装上どうやっても他方の画面に出てこない。**
 *
 * これは見た目の再現ではなく、構造の再現である。
 * S2 で実装する buildRelayContext（partyId を引数に取らない）と同じ思想。
 *
 * @see .steering/20260811-sm-mock/design.md §1
 */

/** 当事者。※ father / mother は使わない（→ docs/glossary.md §4） */
export type Party = "CUSTODIAL" | "NON_CUSTODIAL";

export const PARTY_LABEL: Record<Party, string> = {
  CUSTODIAL: "同居している親",
  NON_CUSTODIAL: "別居している親",
};

export type TabId = "home" | "chat" | "agreement" | "schedule" | "settings";

/** モック内で発生する出来事 */
export type MockEvent =
  /** ① 自分の発言。書いた本人にしか見えない */
  | { t: "own"; party: Party; text: string }
  /** ② AI 自身の発言。宛先の本人にしか見えない */
  | { t: "ai"; party: Party; lines: string[] }
  /** ③ AI による取次ぎ（封書カード）。宛先にだけ届く */
  | { t: "relay"; to: Party; body: string; hearsay?: string }
  /** AI が提示する選択肢。定型文ではなく AI への入力 */
  | { t: "choices"; party: Party; items: string[] }
  /** 日付の区切り。双方に見える */
  | { t: "day"; label: string };

/**
 * ★C1 の実装本体。
 *
 * `own` は party 一致時のみ、`relay` は to 一致時のみ通す。
 * したがって相手の生の発言を取り出す経路が存在しない。
 */
export function viewOf(events: MockEvent[], p: Party): MockEvent[] {
  return events.filter((e) => {
    switch (e.t) {
      case "own":
      case "ai":
      case "choices":
        return e.party === p;
      case "relay":
        return e.to === p;
      case "day":
        return true;
    }
  });
}

/** 合意の状態（→ docs/glossary.md §5.3） */
export type AgreementStatus =
  | "NOT_STARTED"
  | "IN_NEGOTIATION"
  | "AGREED"
  | "REVISION_REQUESTED"
  | "DEVIATED"
  | "ESCALATED"
  | "PLANNED"; // モック上の「今後対応」表示用

/** 論点（→ docs/glossary.md §5.2） */
export type AgreementTopic =
  | "DIVORCE_CONSENT"
  | "PARENTAL_AUTHORITY"
  | "CHILD_SUPPORT"
  | "VISITATION"
  | "PROPERTY_DIVISION"
  | "CONSOLATION_MONEY"
  | "PENSION_SPLIT"
  | "MARITAL_EXPENSES";

export type AgreementRow = {
  topic: AgreementTopic;
  label: string;
  status: AgreementStatus;
  detail?: string;
  /** 一時的例外の注記。取り決め自体は変わっていないことを示す */
  exception?: string;
};

/** 1シーン。events を upto 件目まで表示する */
export type Scene = {
  no: number;
  caption: string;
  tab: TabId;
  /** 推奨する視点。ユーザーはいつでも切り替えられる */
  suggest: Party;
  upto: number;
  /** 「今回だけ／今後も」の確認シートを出すか */
  sheet?: "scope";
  /** 取り決めの状態（0=初期 / 1=調整後） */
  agreements: 0 | 1;
  /** この場面で見てほしいこと */
  note?: string;
};
