import type { Intent } from "./intent";

/**
 * 選択肢
 *
 * ★「テンプレート」「定型文」ではなく「選択肢」である（glossary.md §4）。
 *   本プロダクトは定型文を採用しない。
 *   選択肢は**次にできること**を示すものであり、文面を代筆するものではない。
 *
 * ★intent から固定で導く（C-01）。
 *   LLM に作らせると、出るたびに変わって学習できない。
 */

export type Choice = { id: string; label: string };

const BY_INTENT: Partial<Record<Intent, Choice[]>> = {
  EMOTIONAL_EXPRESSION: [
    { id: "just_listen", label: "いまは聞いてほしいだけ" },
    { id: "to_request", label: "お相手に伝えたいことがある" },
  ],
  REQUEST: [
    { id: "make_proposal", label: "提案としてまとめる" },
    { id: "think_more", label: "もう少し考える" },
  ],
  PROPOSAL: [{ id: "make_proposal", label: "提案としてまとめる" }],
  REVISION_REQUEST: [{ id: "start_revision", label: "取り決めの見直しを始める" }],
  INFO_QUERY: [{ id: "open_knowledge", label: "取り決めについて調べる" }],
  OUT_OF_SCOPE: [{ id: "consult_expert", label: "専門家への相談を検討する" }],
};

export function choicesFor(intents: readonly Intent[]): Choice[] {
  const seen = new Set<string>();
  const out: Choice[] = [];
  for (const i of intents) {
    for (const c of BY_INTENT[i] ?? []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
  }
  return out;
}
