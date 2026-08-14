import { payloadsAgree } from "@/domain/agreement/consent";

/**
 * おふたりで決めたこと（House Rule）
 *
 * ★★ 公正証書には入らない。条項にもしない。**当事者が自分で決めて、自分で直す。**
 *
 *   実データ（約1,080件）で、**最も頻出する対立要因はお金**だった。
 *   しかもその多くが**臨時費用**である（メガネ・キャンプ・医療費・学用品）。
 *
 *   そのご家庭は、都度の交渉ではなく**ルールを先に決めていた。**
 *
 *     > 1件1万円を超えるものは折半
 *
 *   ★決めておけば、**都度の交渉そのものが要らなくなる。**
 *
 * ★なぜ取り決め（公正証書）にしないか
 *
 *   条項にすると、**変えるのに相手の同意という重い手続き**が要る。
 *   このルールは、暮らしに合わせて何度でも直すものである。
 *   **重くすると、直されなくなる。**
 *
 * ★なぜ片方だけでは決まらないか
 *
 *   「決まったこと」という題である以上、
 *   **一方が書いただけのものが決まったこととして並ぶのは誤りである。**
 *   取り決めほど重くはしないが、**相手の了承は要る。**
 *
 * @see .steering/20260814-real-data-findings/design.md §9
 */

/** いま扱うルールの種類。★増やすときは、必ず構造化して足す */
export const RULE_KINDS = ["SPECIAL_EXPENSE"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_TITLE: Record<RuleKind, string> = {
  SPECIAL_EXPENSE: "臨時の費用の分け方",
};

/**
 * ★選択肢だけにする。自由記述にしない。
 *
 *   自由記述にすると、**書いた言葉がそのまま相手に渡る**ことになる（C1）。
 *   取り決めと同じく、**構造化された値だけが越える。**
 */
export const THRESHOLDS = [
  ["5000", "5,000円"],
  ["10000", "10,000円"],
  ["20000", "20,000円"],
  ["30000", "30,000円"],
] as const;

export const SHARES = [
  ["HALF", "半分ずつ"],
  ["CONSULT", "そのつど相談する"],
] as const;

export type SpecialExpenseRule = {
  /** これを超えたら、下の分け方にする */
  thresholdYen: number;
  share: "HALF" | "CONSULT";
};

/** ★画面に出す一文。数字は当事者が選んだ値そのもの（LLM を通さない） */
export function describeRule(kind: RuleKind, value: Record<string, unknown>): string | null {
  if (kind !== "SPECIAL_EXPENSE") return null;

  const yen = Number(value.thresholdYen);
  const share = String(value.share ?? "");
  if (!Number.isFinite(yen) || yen <= 0) return null;

  const label = SHARES.find(([v]) => v === share)?.[1];
  if (!label) return null;

  return `1件 ${yen.toLocaleString("ja-JP")}円 を超える費用は、${label}`;
}

/**
 * 揃ったか。
 *
 * ★合意・調整と同じ規律。**双方が出していて、かつ内容が一致したときだけ。**
 *   片方だけで確定させると、相手が同意していないものが記録に残る。
 */
export type RuleEntry = { byPartyId: string; value: Record<string, unknown> | null };

export const RULE_STATES = ["NONE", "WAITING", "AGREED"] as const;
export type RuleState = (typeof RULE_STATES)[number];

export function ruleStateOf(
  entries: readonly RuleEntry[],
  partyIds: readonly string[],
): RuleState {
  if (entries.length === 0) return "NONE";
  // ★1人しかいないケースで、揃ったことにしない
  if (partyIds.length < 2) return "WAITING";

  const latest = new Map<string, Record<string, unknown> | null>();
  for (const e of entries) latest.set(e.byPartyId, e.value);

  const values = partyIds.map((id) => latest.get(id) ?? null);
  if (values.some((v) => v === null)) return "WAITING";
  return payloadsAgree(values) ? "AGREED" : "WAITING";
}

export const RULE_STATE_LABEL: Record<RuleState, string> = {
  NONE: "まだ決めていません",
  WAITING: "お相手のご返事をお待ちしています",
  AGREED: "おふたりで決めました",
};

/**
 * ★公正証書に入らないことを、その場に書く。
 *   取り決めのタブが隣にあるので、書かないと混ざる。
 */
export const RULE_NOTE =
  "公正証書には入りません。おふたりのあいだの取り決めとして控えるものです。いつでも決め直せます。";

/** ★渡す前に読める一文。取り決めと同じ作法にする */
export const RULE_SHARE_CAVEAT =
  "お相手が同じ内容を選ばれると、おふたりで決めたこととして残ります。";
