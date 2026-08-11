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
