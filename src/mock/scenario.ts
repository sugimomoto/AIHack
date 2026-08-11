import type { AgreementRow, MockEvent, Scene } from "./types";

/**
 * シナリオ：面会交流の日程を、今回だけ変更する
 *
 * 登場人物はすべて架空。金額・日付も架空。
 *
 * 山場はシーン⑥。ここで視点を切り替えると、
 * 「また勝手に土曜に決めやがって」が同居している親の画面に
 * 一度も現れていないことが分かる。
 */

export const EVENTS: MockEvent[] = [
  // 0
  { t: "day", label: "8月11日" },

  // 1 ── 同居している親からの相談が、AI の要約として届く
  {
    t: "relay",
    to: "NON_CUSTODIAL",
    body: "土曜の日程について、別案のご相談が来ています。",
    hearsay: "背景として、お相手は現在求職中とのことです。",
  },

  // 2 ── 別居している親が、感情をそのまま書く（相手には届かない）
  { t: "own", party: "NON_CUSTODIAL", text: "また勝手に土曜に決めやがって" },

  // 3 ── AI が受け止める（相手には共有されない）
  {
    t: "ai",
    party: "NON_CUSTODIAL",
    lines: ["そのお気持ち、受け止めました。", "日程の話は、こちらで預かります。"],
  },

  // 4 ── AI が選択肢を出す（定型文ではなく、AI への入力）
  {
    t: "choices",
    party: "NON_CUSTODIAL",
    items: ["日曜がいい", "今は決めない", "理由を聞きたい"],
  },

  // 5 ── 別居している親が選ぶ
  { t: "own", party: "NON_CUSTODIAL", text: "日曜なら" },

  // 6 ── ★同居している親に届くのは、これだけ
  {
    t: "relay",
    to: "CUSTODIAL",
    body: "9月13日について、日曜であればと伺っています。",
  },

  // 7 ── 同居している親が答える
  { t: "own", party: "CUSTODIAL", text: "日曜でいい" },

  // 8 ── 合意の確認
  {
    t: "ai",
    party: "CUSTODIAL",
    lines: ["ありがとうございます。", "9月14日（日）でお預かりしました。"],
  },
];

export const SCENES: Scene[] = [
  {
    no: 1,
    caption: "ホームを開く",
    tab: "home",
    suggest: "NON_CUSTODIAL",
    upto: 1,
    agreements: 0,
    note: "開いても、何もしなくていい感じがするか",
  },
  {
    no: 2,
    caption: "お相手からの相談を読む",
    tab: "chat",
    suggest: "NON_CUSTODIAL",
    upto: 1,
    agreements: 0,
    note: "封書のカードを見て「相手が書いた言葉ではない」と分かるか",
  },
  {
    no: 3,
    caption: "思っていることを書く",
    tab: "chat",
    suggest: "NON_CUSTODIAL",
    upto: 2,
    agreements: 0,
    note: "「ここに書いたことは、お相手には届きません」を信じられるか",
  },
  {
    no: 4,
    caption: "AI が受け止める",
    tab: "chat",
    suggest: "NON_CUSTODIAL",
    upto: 3,
    agreements: 0,
    note: "説教くさくないか。突き放していないか",
  },
  {
    no: 5,
    caption: "選択肢が出る",
    tab: "chat",
    suggest: "NON_CUSTODIAL",
    upto: 5,
    agreements: 0,
    note: "定型文に見えないか",
  },
  {
    no: 6,
    caption: "★ 視点を切り替える",
    tab: "chat",
    suggest: "CUSTODIAL",
    upto: 6,
    agreements: 0,
    note: "お相手の画面に、何が届いて、何が届いていないか",
  },
  {
    no: 7,
    caption: "お相手が答える",
    tab: "chat",
    suggest: "CUSTODIAL",
    upto: 7,
    agreements: 0,
    note: "",
  },
  {
    no: 8,
    caption: "★ 今回だけか、今後もか",
    tab: "chat",
    suggest: "CUSTODIAL",
    upto: 7,
    sheet: "scope",
    agreements: 0,
    note: "二択の重さの違いが伝わるか。文言は正確か",
  },
  {
    no: 9,
    caption: "取り決めを確認する",
    tab: "agreement",
    suggest: "CUSTODIAL",
    upto: 8,
    agreements: 1,
    note: "今回だけの変更なので、取り決めそのものは変わっていない",
  },
];

/** 取り決めの状態（0=初期） */
const AGREEMENTS_BASE: AgreementRow[] = [
  {
    topic: "CHILD_SUPPORT",
    label: "養育費",
    status: "AGREED",
    detail: "月50,000円 ／ 毎月末日",
  },
  {
    topic: "VISITATION",
    label: "面会交流",
    status: "AGREED",
    detail: "月1回・第2土曜 10:00-17:00 ／ ○○駅",
  },
  { topic: "PARENTAL_AUTHORITY", label: "親権者", status: "NOT_STARTED" },
  { topic: "PROPERTY_DIVISION", label: "財産分与", status: "PLANNED" },
  { topic: "CONSOLATION_MONEY", label: "慰謝料", status: "PLANNED" },
  { topic: "PENSION_SPLIT", label: "年金分割", status: "PLANNED" },
  { topic: "MARITAL_EXPENSES", label: "婚姻費用", status: "PLANNED" },
  { topic: "DIVORCE_CONSENT", label: "離婚への同意", status: "PLANNED" },
];

/**
 * 調整後（1）。
 * ★取り決めそのものは変わらない。9月13日の1回だけが例外として記録される。
 */
const AGREEMENTS_AFTER: AgreementRow[] = AGREEMENTS_BASE.map((r) =>
  r.topic === "VISITATION"
    ? { ...r, exception: "9月13日のみ、9月14日（日）に変更されています" }
    : r,
);

export const AGREEMENTS: Record<0 | 1, AgreementRow[]> = {
  0: AGREEMENTS_BASE,
  1: AGREEMENTS_AFTER,
};

/** 相談のシナリオ見出し */
export const CONSULTATION_TITLE = "今回の日程を変更したい";

/** トピック選択のマスタ（→ docs/functional-design.md §4.2） */
export const TOPIC_CATEGORIES = [
  {
    id: "money",
    label: "お金のこと",
    scenarios: [
      "養育費を決める",
      "塾・習い事の費用を相談する",
      "進学費用の分担を相談する",
      "今月の支払いを待ってほしい",
      "医療費の分担を相談する",
    ],
  },
  {
    id: "meeting",
    label: "子どもと会うこと",
    scenarios: [
      "面会のルールを決める",
      "今回の日程を変更したい",
      "学校行事に参加したい",
      "長期休暇の過ごし方を相談する",
      "宿泊・遠出について相談する",
    ],
  },
  {
    id: "life",
    label: "子どもの進路・生活",
    scenarios: [
      "進学について相談する",
      "医療について相談する",
      "転居・転校について相談する",
    ],
  },
  {
    id: "daily",
    label: "日常の連絡",
    scenarios: [
      "送迎をお願いしたい",
      "子どもの体調を伝える",
      "写真・成長を共有する",
      "学校からの連絡を共有する",
    ],
  },
] as const;
