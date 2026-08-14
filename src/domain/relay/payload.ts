/**
 * 提案の構造化
 *
 * ★P3｜数字と条項をLLMに作らせない。
 *
 *   合意のスキーマ（payloadSchemas）は required を持つ。
 *   「月3万が限界」という入力にそのまま使うと、
 *   **書かれていない支払日や終期をLLMが埋める。**
 *
 *   入力に無い値を埋めた提案は、
 *   **当事者が言っていないことを相手に伝えることになる。**
 *
 * @see docs/functional-design.md §5.1a ①
 */

type Json = Record<string, unknown>;

/**
 * 合意用スキーマから提案用スキーマを作る。
 *
 * ★当初は required を外す方針だったが、実機で 400 が返った。
 *   **OpenAI の strict モードは、全プロパティが required であることを要求する。**
 *
 * そこで「全項目を required にしたうえで、null を許す」形にした。
 *
 *   モデルは「書かれていない」と答えられる（null を返せる）
 *     ↓ stripUnstated が null を落とす
 *   書かれた項目だけが残る
 *
 * ★null を返せないと、モデルは値を埋めるしかなくなる。
 *   nullable にすることが P3 の担保そのものである。
 *
 * ★元のスキーマを壊さない（マスタは共有されている）。
 */
export function toProposalSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;

  const src = schema as Json;
  const out: Json = { ...src };

  if (src.properties && typeof src.properties === "object") {
    const props = src.properties as Json;
    const next: Json = {};
    for (const [k, v] of Object.entries(props)) next[k] = nullable(toProposalSchema(v));
    out.properties = next;
    // ★strict モードは全プロパティの列挙を要求する
    out.required = Object.keys(props);
  }
  return out;
}

/** 型に null を足す。enum にも null を足さないと、値を選ぶしかなくなる */
function nullable(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const s = schema as Json;
  const out: Json = { ...s };

  if (typeof s.type === "string" && s.type !== "null") out.type = [s.type, "null"];
  if (Array.isArray(s.enum) && !s.enum.includes(null)) out.enum = [...s.enum, null];

  return out;
}

/**
 * 言及されていない値を落とす。
 *
 * ★0 と false は落とさない。
 *   「0円」「相談は不要」はいずれも意味のある提案である。
 *   falsy でまとめて落とすと、これらが消える。
 */
export function stripUnstated(value: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      const nested = stripUnstated(v as Json);
      if (Object.keys(nested).length > 0) out[k] = nested;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ★★ 原文に無い値を落とす（捏造の除去）
// ---------------------------------------------------------------------------

/**
 * ★実データで判明したこと
 *
 *   スキーマの `title` と `description` が、**そのまま値として出力される。**
 *
 *     入力：運動会の写真です。徒競走で2位でした。
 *     出力：{"subject":"入学金", "shareText":"半分ずつ / 6対4"}
 *            ↑ description の例文       ↑ description の例文
 *
 *     入力：娘が朝から38度の熱を出しています。
 *     出力：{"subject":"何について", "shareText":"例: 半分ずつ / 6対4"}
 *            ↑ title そのもの           ↑ description そのもの
 *
 *   さらに、書かれていない日付を作る（「来週火曜」→ "2023-10-10"）。
 *
 * ★★ 検査の向きが、取次ぎ本文とは逆になる。
 *
 *   | 対象 | 求めるもの |
 *   | 取次ぎ本文（content） | **逐語であってはならない**（原文が流出する。INV-4a） |
 *   | 事実の断片（payload） | **逐語でなければならない**（でなければ捏造） |
 *
 *   > 言葉は渡さない。事実は、原文のまま。
 */

/** ★比較のために揺れを均す。**意味は変えない** */
function normalize(s: string): string {
  return s
    .normalize("NFKC") // 全角英数字・記号を半角に（６万円 → 6万円）
    .replace(/[\s、。，．・「」『』（）()]/g, "")
    .toLowerCase();
}

/**
 * この値は、原文に書かれていたか。
 *
 * ★数値は文字列にしてから見る。「50000」を作られても、
 *   原文に「50000」も「5万」も無ければ落ちる。
 */
export function isStatedIn(raw: string, value: unknown): boolean {
  if (typeof value === "boolean") return true; // ★真偽値は照合しない（言い回しが多様すぎる）
  const s = String(value ?? "").trim();
  if (s === "") return false;

  // ★1文字は偶然一致する。事実の断片として短すぎる
  if (normalize(s).length < 2) return false;

  return normalize(raw).includes(normalize(s));
}

/**
 * その値は「事実の断片」か。
 *
 * ★実測：原文をほぼ丸ごと拾ってくることがある。
 *
 *     shareText: "娘が朝から38度の熱を出しています。今日は学校を休ませました。念のためお伝えします。"
 *
 *   逐語の検査は通る（原文にある）。だが**これは断片ではなく、文である。**
 *   「分担」の欄に入るべき値でもない。
 *
 * ★句点で切る。**桁数を決め打ちしない。**
 *   「6万円」「火曜の15時」「半分ずつ」——事実の断片に句点は要らない。
 *
 * ★なお C1 は別の層で守られている（調整の API は自分が出したものしか返さない）。
 *   これは**中身の質**のための検査である。
 */
export function isFragment(value: unknown): boolean {
  if (typeof value !== "string") return true;
  return !value.includes("。");
}

/**
 * 原文に無い項目を落とす。
 *
 * ★落とすだけで、直さない。**推測で埋め直すと、また捏造になる。**
 * ★入れ子も見る。空になった入れ子は消す。
 */
export function stripUnstatedFrom(raw: string, value: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const nested = stripUnstatedFrom(raw, v as Json);
      if (Object.keys(nested).length > 0) out[k] = nested;
      continue;
    }
    if (isStatedIn(raw, v) && isFragment(v)) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ★★ 金額は、コードで解釈する（P3）
// ---------------------------------------------------------------------------

/**
 * ★実測：原文「6万円」を3回抽出して、5000 / 50000 / 50000。**一度も合わない。**
 *
 *   単位の換算は算術である。**LLM にさせない。**
 *   原文のままの文字列（「6万円」）を取り、ここで解釈する。
 *
 * ★解釈できなければ null。**推測しない。**
 *   （formatValue・toIncomeBand と同じ考え方）
 */
const MAN = /^(\d+(?:\.\d+)?)万(?:(\d+)千)?(?:円)?$/;
const SEN = /^(\d+(?:\.\d+)?)千(?:円)?$/;
const YEN = /^(\d+)(?:円)?$/;

export function parseYen(text: unknown): number | null {
  if (typeof text === "number") return Number.isInteger(text) && text >= 0 ? text : null;
  const s = String(text ?? "")
    .normalize("NFKC")
    .replace(/[\s,]/g, "");
  if (s === "") return null;

  const man = s.match(MAN);
  if (man) {
    const v = Number(man[1]) * 10000 + (man[2] ? Number(man[2]) * 1000 : 0);
    return Number.isInteger(v) && v >= 0 ? v : null;
  }
  const sen = s.match(SEN);
  if (sen) {
    const v = Number(sen[1]) * 1000;
    return Number.isInteger(v) && v >= 0 ? v : null;
  }
  const yen = s.match(YEN);
  if (yen) {
    // ★単位（円・万・千）が無く、8桁以上の数字列は通さない。
    //   日付（20261231）や電話番号の形であり、**その桁数の金額を、
    //   単位を付けずに書く人はいない。**
    //   ★上限の額そのものは決めない。決め打ちは、いずれ実際の額を弾く。
    if (!s.includes("円") && yen[1].length >= 8) return null;
    const v = Number(yen[1]);
    return Number.isFinite(v) && v >= 0 ? v : null;
  }
  return null;
}

/**
 * 金額の文字列を、数値に直す。
 *
 * ★`amountText`（原文のまま）→ `amountYen`（解釈済み）
 *   解釈できなければ **`amountYen` を持たない。**空欄のほうが、誤った額より安全である。
 */
export function resolveAmount(payload: Json): Json {
  const text = payload.amountText;
  if (text === undefined) return payload;

  const { amountText: _drop, ...rest } = payload;
  const yen = parseYen(text);
  return yen === null ? rest : { ...rest, amountYen: yen };
}
