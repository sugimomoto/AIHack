import { CODE_LABELS } from "@/domain/document/builder";
import { hasVerbatimRun } from "@/domain/relay/guard";

/**
 * 構造化された提案から、要約を組み立てる。
 *
 * ★逐語一致（INV-4a）で要約が落ちたときの受け皿。
 *
 *   短く素直に書いた発言ほど、要約が原文と一致してしまい落ちる。
 *   その結果、相手に届くのが「ご相談が来ています。」だけになっていた。
 *   **はっきり書いた人ほど、伝わる中身が減っていた。**
 *
 * ★これは原文から作らない。**抽出済みの構造化された値だけを使う。**
 *   したがって、そもそも逐語一致が起こりえない。
 *
 * ★値が読めなければ、その項目を出さない（G-3b と同じ規律）。
 */
const ORDER = [
  "monthlyAmount",
  "payDay",
  "until",
  "frequency",
  "dayOfWeek",
  // ★日常の連絡。**事実そのものが内容**なので、言い換えでは通せない。
  //   構造化された値として渡すことで、逐語一致に潰されなくなる。
  "date",
  "time",
  "place",
  "subject",
] as const;

const PHRASE: Record<string, (v: string) => string> = {
  monthlyAmount: (v) => `月額${v}`,
  payDay: (v) => `お支払いは${v}`,
  until: (v) => `${v}まで`,
  frequency: (v) => `${v}`,
  dayOfWeek: (v) => `${v}`,
  date: (v) => `${v}`,
  time: (v) => `${v}`,
  place: (v) => `${v}`,
  subject: (v) => `${v}`,
};

/** ★お知らせは「ご希望」ではない。事実として結ぶ */
const INFO_KEYS = ["date", "time", "place", "subject"];

/**
 * ★自由記述の項目。**ここだけ逐語一致を検査する。**
 *
 *   金額・支払日・日付・時刻は、正しく伝えれば原文と一致して当たり前である。
 *   組み立てた文全体を検査すると、**事実を伝えること自体ができなくなる。**
 *   （実測：「10月8日の14時に小学校の体育館で開催されます」→ 何も渡らなかった）
 *
 *   一方 subject と place は LLM が自由に埋めるため、
 *   ここから原文の言い回しが越えうる。**この2つだけを検査する。**
 */
const FREE_TEXT_KEYS = ["subject", "place"];

/** ★抽出が埋めた「不明」の類を、事実として渡さない */
const PLACEHOLDERS = ["未記載", "不明", "なし", "記載なし", "未定", "-", "—"];

function display(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;

  const codes = CODE_LABELS[key];
  if (codes) return codes[String(value)] ?? null; // ★未知のコードは通さない

  if (key === "monthlyAmount" && typeof value === "number") {
    return `${value.toLocaleString("ja-JP")}円`;
  }
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "boolean") return null;

  const s = String(value).trim();
  if (s === "" || /^[A-Z][A-Z0-9_]{2,}$/.test(s)) return null;
  // ★「未記載」を場所や時刻として渡さない
  if (PLACEHOLDERS.includes(s)) return null;
  return s;
}

/**
 * ★読める項目が一つも無ければ null。
 *   そのときだけ「ご相談が来ています。」に落とす。
 */
export function summaryFromPayload(
  payload: Record<string, unknown> | null,
  /** ★自由記述の項目だけ、原文との逐語一致を検査する */
  raw = "",
): string | null {
  if (!payload) return null;

  const readable = (k: string): string | null => {
    if (!(k in payload)) return null;
    const v = display(k, payload[k]);
    if (v === null) return null;
    // ★自由記述からは、原文の言い回しを越えさせない
    if (FREE_TEXT_KEYS.includes(k) && raw && hasVerbatimRun(raw, v)) return null;
    return v;
  };

  const parts = ORDER.map((k) => {
    const v = readable(k);
    return v === null ? null : PHRASE[k](v);
  }).filter((x): x is string => x !== null);

  if (parts.length === 0) return null;

  // ★お知らせを「ご希望」と書くと、要求として誤解される
  if (ORDER.some((k) => k in payload && INFO_KEYS.includes(k))) return infoSentence(readable);
  return `${parts.join("、")}をご希望とのことです。`;
}

/**
 * お知らせの文を組み立てる。
 *
 * ★値を「、」で並べるとデータの羅列になる。助詞でつなぐ。
 * ★年を勝手に補わない。抽出が ISO で返してきたら月日だけにする。
 *   **書かれていない年を足すと、事実を作ることになる。**
 */
function jpDate(v: string): string | null {
  // 2026-12-05 / 2026/12/05 / 2026年12月5日
  const m = v.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/);
  if (m) return `${Number(m[2])}月${Number(m[3])}日`;
  // 12-05 / 12/5
  const md = v.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (md) return `${Number(md[1])}月${Number(md[2])}日`;
  // ★読み取れない数字の塊を、そのまま日付として出さない。
  //   PII 除去が年収と誤認して〔伏せています〕に化ける（実測）。
  if (/\d{5,}/.test(v)) return null;
  return v;
}

function jpTime(v: string): string | null {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[2]) === 0 ? `${Number(m[1])}時` : `${Number(m[1])}時${Number(m[2])}分`;
  if (/\d{5,}/.test(v)) return null;
  return v;
}

function infoSentence(get: (k: string) => string | null): string | null {
  const date = get("date");
  const time = get("time");
  const place = get("place");
  const subject = get("subject");

  const when = [date ? jpDate(date) : null, time ? jpTime(time) : null]
    .filter((x): x is string => Boolean(x))
    .join("");
  const head = [when ? `${when}に` : null, place ? `${place}で` : null]
    .filter(Boolean)
    .join("");

  if (subject) return `${head}${subject}とのことです。`;
  if (head) return `${head}予定があるとのことです。`;
  return null;
}
