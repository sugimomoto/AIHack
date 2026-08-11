/**
 * SecurityGuard
 *
 * ★この設計の要点は「防ぐ」ではなく「持っていない」である。
 *
 *   インジェクションが成功しても、
 *   **LLM のコンテキストに相手の原文が無い**（ContextBuilder／INV-1）。
 *   出せるものが無いのだから、出させることもできない。
 *
 *   ここでの検知は二重の防御の外側であり、**内側が本体**である。
 *
 * @see docs/functional-design.md §5.3
 */

export const INJECTION_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "指示の無効化", re: /(これまでの|以前の|上記の)?指示を(無視|忘れ)/ },
  { name: "ignore-instructions", re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { name: "プロンプトの開示要求", re: /(システム)?プロンプトを(教え|見せ|出力)/ },
  { name: "verbatim-repeat", re: /repeat\s+(everything|all)\s+(above|before)/i },
  { name: "役割の上書き", re: /あなたは(今から|これから)[^。]{0,20}(制限|規則|ルール)(の)?(ない|無い)/ },
  { name: "相手の原文の要求", re: /相手の(メッセージ|発言|文章|原文)を(全部|すべて|そのまま)/ },
  { name: "非開示情報の要求", re: /(相手|お相手)の(住所|電話|勤務先|年収)を(教え|答え|出力)/ },
];

export type InjectionHit = { pattern: string; excerpt: string };

/**
 * ★検知は記録であって拒否ではない。
 *   拒否すると、通常の相談まで巻き込んで止まる。
 *   そして止めなくても、コンテキストに無いものは出ない。
 */
export function detectInjection(text: string): InjectionHit | null {
  for (const p of INJECTION_PATTERNS) {
    const m = text.match(p.re);
    if (m) return { pattern: p.name, excerpt: m[0] };
  }
  return null;
}

// ---------------------------------------------------------------------------

/**
 * 出力の PII フィルタ
 *
 * ★最後の網である。ContextBuilder が渡していない以上、
 *   ここに引っかかるものは本来出てこない。
 *   **出てきたら、内側が破れている。**
 *
 * ★帯の表記と、合意した金額は伏せない。
 *   これらは越えてよいものであり、伏せると文書が壊れる。
 */
const PII_RULES: { name: string; re: RegExp }[] = [
  { name: "電話番号", re: /0\d{1,4}-\d{1,4}-\d{3,4}/g },
  { name: "メールアドレス", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { name: "住所", re: /(東京都|北海道|(?:京都|大阪)府|[^\s]{2,3}県)[^\s、。]{2,20}\d+-\d+(-\d+)?/g },
  // ★区切りの無い7桁以上の数字。「30,000円」「月2万〜4万円」は該当しない
  { name: "金額", re: /(?<![\d,])\d{7,}(?![\d,])/g },
];

export function redactPii(text: string): string {
  return PII_RULES.reduce((s, r) => s.replace(r.re, `〔${r.name}は伏せています〕`), text);
}
