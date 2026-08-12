import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SAFETY_FLAGS,
  detectSafetyFlags,
  needsHumanReview,
  toSafetyEvent,
  visibleChangeFor,
} from "@/domain/safety/detect";
import { RECEPTION_SYSTEM_PROMPT } from "@/domain/dialogue/prompts";

/**
 * ★安全の確保（S17）
 *
 * ★AIは判定しない。フラグを立てるだけである。
 *   誤検知の帰結が取り消せない（通告を起点に家庭へ調査が入りうる）。
 *   見逃しも重い。**どちらの誤りも重いので、人が読む。**
 *
 * ★AIは説教しない。
 *   「そのような表現は不適切です」と返した瞬間、
 *   **C1の「何を書いてもいい」という約束が壊れる。**
 *
 * @see docs/legal-child-risk-research.md
 * @see docs/functional-design.md §5.9
 *
 * ★このテストは実装より先に書かれた
 */

describe("★AIは説教しない", () => {
  it("★受け止めのプロンプトに、危険な表現を戒める指示が無い", () => {
    for (const w of ["不適切", "控えて", "そのような表現", "警告", "危険です"]) {
      expect(RECEPTION_SYSTEM_PROMPT).not.toContain(w);
    }
  });
});

describe("★検知はフラグであって判定ではない", () => {
  it("フラグの種別が定義されている", () => {
    expect(SAFETY_FLAGS).toContain("HARMFUL");
    expect(SAFETY_FLAGS).toContain("VICTIM_REPORT");
    expect(SAFETY_FLAGS).toContain("CHILD_RISK");
  });

  it("★複数のフラグが同時に立ちうる", () => {
    // 児童虐待防止法2条4号：児童が同居する家庭における配偶者への暴力は児童虐待にあたる。
    // DVの訴えは、同時に子への危害でもありうる。
    const f = detectSafetyFlags("殴られました。子どもの前でも殴られます");
    expect(f).toContain("VICTIM_REPORT");
    expect(f).toContain("CHILD_RISK");
  });

  it("加害的表現を拾う", () => {
    expect(detectSafetyFlags("次に会ったら殺してやる")).toContain("HARMFUL");
  });

  it("★通常の相談では何も立たない", () => {
    for (const t of [
      "来週の受け渡し、10時ではなく11時にできませんか",
      "もう限界だ。あいつの顔も見たくない",
      "月3万が限界です",
    ]) {
      expect(detectSafetyFlags(t)).toEqual([]);
    }
  });

  it("★フラグが立っても、AIの応答を変える情報を返さない", () => {
    // 戻り値は文字列の配列のみ。「どう応答すべきか」を含まない
    const f = detectSafetyFlags("殴られました");
    expect(Array.isArray(f)).toBe(true);
    for (const x of f) expect(typeof x).toBe("string");
  });
});

describe("★本人の画面を変えない", () => {
  it("★検知しても、その場では何も表示しない", () => {
    expect(visibleChangeFor(["CHILD_RISK"])).toBeNull();
    expect(visibleChangeFor(["HARMFUL"])).toBeNull();
    expect(visibleChangeFor(["VICTIM_REPORT"])).toBeNull();
  });

  it("★何も検知しなくても同じ（差が出ない＝見抜かれた感が生まれない）", () => {
    expect(visibleChangeFor([])).toBeNull();
  });
});

describe("★人が読む経路に乗せる", () => {
  it("フラグが立てば確認待ちになる", () => {
    expect(needsHumanReview(["CHILD_RISK"])).toBe(true);
    expect(needsHumanReview(["HARMFUL"])).toBe(true);
  });

  it("何も立たなければ確認しない", () => {
    expect(needsHumanReview([])).toBe(false);
  });

  it("★自動で通告する経路が存在しない", () => {
    const e = toSafetyEvent({
      caseId: "c1",
      partyId: "p1",
      flags: ["CHILD_RISK"],
      rawText: "原文",
      createdAt: "2026-08-12T00:00:00Z",
    });
    expect(Object.keys(e)).not.toContain("reported");
    expect(Object.keys(e)).not.toContain("notifiedAuthority");
    expect(e.status).toBe("PENDING_REVIEW");
  });
});

describe("★原文の保全（FR-10）", () => {
  const e = toSafetyEvent({
    caseId: "c1",
    partyId: "p1",
    flags: ["HARMFUL"],
    rawText: "次に会ったら殺してやる",
    createdAt: "2026-08-12T00:00:00Z",
  });

  it("★原文が保全される（通告する場合の根拠になる）", () => {
    expect(e.rawText).toBe("次に会ったら殺してやる");
  });

  it("★これは G-F の意図的な例外である。ログではなく専用の記録に置く", () => {
    // 記録の型に、ログへ流す意図を示すフィールドが無いこと
    expect(Object.keys(e)).not.toContain("log");
  });

  it("誰の・どのケースかが分かる", () => {
    expect(e.caseId).toBe("c1");
    expect(e.partyId).toBe("p1");
  });
});

/**
 * ★原文がケースの読み取り経路に出ないこと
 *
 * `safetyEvents` はケース配下に置かない。
 * `loadForLlm` はケース配下しか読まないため、**構造的に到達しない。**
 * パスの設計そのものが防御である。
 */
describe("★安全の記録はケース配下に無い", () => {
  it("★リポジトリがケース配下に書いていない", () => {
    const src = readFileSync("src/infra-adapters/firestore/repositories/caseRepository.ts", "utf8");
    const i = src.indexOf("export async function appendSafetyEvent");
    const body = src.slice(i, i + 400);
    expect(body).toContain('collection("safetyEvents")');
    expect(body).not.toContain("caseRef(");
  });

  it("★LLM用の読み取りが safetyEvents に触れていない", () => {
    const src = readFileSync("src/infra-adapters/firestore/repositories/caseRepository.ts", "utf8");
    const i = src.indexOf("export async function loadForLlm");
    const body = src.slice(i, src.indexOf("export async function", i + 10));
    expect(body).not.toContain("safetyEvents");
  });
});
