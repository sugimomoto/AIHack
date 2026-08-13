import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * ★取り決めは、対話から作られない
 *
 * これは機能テストではない。**方針そのもの**の検証である。
 *
 * 以前は対話から抽出した値で取り決め（提案）を作っていた。そこから実測で3つの欠陥が出た：
 *
 *   ・「進学費用」の相談が、合意済みの養育費の月額を書き換えうる状態だった
 *   ・抽出が品目を言い換え、「スマホ代」が「コピー代」に化けた
 *   ・はっきり書いた人ほど、逐語一致の検査で伝わる中身が減っていた
 *
 * ★歯止め（kind による分岐）は入れられる。
 *   だが**歯止めが要ること自体が構造の問題**だった。
 *   取り決めを入力だけに限れば、これらは**構造的に起こらない。**
 *
 * ★このテストは「呼ばないこと」を固定する。
 *   ふつうのテストでは書けない。呼ばれないことは、実行しても見えないため。
 *
 * @see .steering/20260812-feedback-pivot/requirements.md §1.1
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

/** ★コメントは数えない。「呼ばない」と書いたコメント自体が引っかかるため */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const FILES = walk(SRC).map((path) => ({
  path: path.slice(process.cwd().length + 1),
  code: stripComments(readFileSync(path, "utf8")),
}));

const p = (posix: string) => posix.split("/").join(sep);

/** ★提案を作ってよい唯一の入口。ウィザードと編集画面だけ */
const ALLOWED = [p("src/app/api/cases/[caseId]/terms/route.ts")];

/** ★定義そのものは数えない。呼び出し側を見たい */
const DEFINITION = p("src/infra-adapters/firestore/repositories/caseRepository.ts");

describe("★提案を作れるのは、入力の経路だけ", () => {
  const callers = FILES.filter(
    (f) => f.path !== DEFINITION && /\bappendProposal\s*\(/.test(f.code),
  ).map((f) => f.path);

  it("★appendProposal を呼ぶのは、取り決めの入力 API だけ", () => {
    expect(callers.sort()).toEqual([...ALLOWED].sort());
  });

  it("★対話（consultation）から提案が作られない", () => {
    const consultation = FILES.find((f) => f.path === p("src/services/consultation.ts"));
    expect(consultation).toBeDefined();
    expect(consultation!.code).not.toMatch(/\bappendProposal\b/);
  });

  it("★取次ぎ（relay）から提案が作られない", () => {
    const relay = FILES.find((f) => f.path === p("src/services/relay.ts"));
    expect(relay).toBeDefined();
    expect(relay!.code).not.toMatch(/\bappendProposal\b/);
  });
});

describe("★対話が取り決めを書き換えない", () => {
  it("★applyAdjustment（PERMANENT で合意を書き換える）を、対話から呼ばない", () => {
    const fromDialogue = FILES.filter(
      (f) =>
        /\bapplyAdjustment\s*\(/.test(f.code) &&
        (f.path.includes("consultation") || f.path.includes("dialogue") || f.path.includes("relay")),
    ).map((f) => f.path);

    expect(fromDialogue).toEqual([]);
  });

  it("★「今後も変更する」を対話で選ばせない", () => {
    // ★選べるように見せたまま何も起きないほうが、選べないことより悪い
    const chat = FILES.find((f) => f.path.endsWith("CaseChat.tsx"));
    expect(chat).toBeDefined();
    expect(chat!.code).not.toContain("今後も変更する");
    expect(chat!.code).not.toContain("PERMANENT");
  });
});

describe("★AI が金額に触れる経路が無い（P3）", () => {
  it("★取り決めの service が LLM を呼ばない", () => {
    // ★以前は buildMediationDraft が LARGE を呼び、
    //   「おふたりのご提案の差」を説明させていた。
    //   生成後の検査は効いていたが、**経路が残っていること自体**をやめた。
    const agreement = FILES.find((f) => f.path === p("src/services/agreement.ts"));
    expect(agreement).toBeDefined();
    expect(agreement!.code).not.toMatch(/\bcallLlm\b/);
    expect(agreement!.code).not.toMatch(/\bcallLlmStructured\b/);
  });

  it("★算定表を引くのは決定的な関数だけ", () => {
    const agreement = FILES.find((f) => f.path === p("src/services/agreement.ts"))!;
    expect(agreement.code).toMatch(/lookupChildSupport/);
  });

  it("★合意の画面に、AI が書いた説明文を渡さない", () => {
    const panel = FILES.find((f) => f.path.endsWith("AgreementPanel.tsx"));
    expect(panel).toBeDefined();
    expect(panel!.code).not.toMatch(/draft\.explanation/);
  });
});
