import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  SHARE_CAVEAT,
  SHARING_LABEL,
  canShare,
  canWithdraw,
  isVisibleTo,
  shareNotice,
  sharingStateOf,
  withdrawNotice,
} from "@/domain/agreement/sharing";
import { payloadsAgree } from "@/domain/agreement/consent";

/**
 * ★仮案の共有
 *
 * 取り決めは「片方が仮案を作り、もう片方が了承する」形で作られる。
 * 双方が独立に記入して一致を待つ形ではない。**そんな一致は起きない。**
 *
 * @see .steering/20260812-feedback-pivot/design-sharing.md
 */

const A = "party_a";
const B = "party_b";

const draft = { byPartyId: A, sharedAt: null, withdrawnAt: null };
const shared = { byPartyId: A, sharedAt: "2026-08-12T10:00:00Z", withdrawnAt: null };
const withdrawn = {
  byPartyId: A,
  sharedAt: "2026-08-12T10:00:00Z",
  withdrawnAt: "2026-08-12T11:00:00Z",
};

describe("★下書きは、お相手から見えない", () => {
  it("★渡していない案は、相手に見えない", () => {
    expect(isVisibleTo(draft, B)).toBe(false);
  });

  it("自分の下書きは、自分には見える（書いている本人だから）", () => {
    expect(isVisibleTo(draft, A)).toBe(true);
  });

  it("渡した案は、相手に見える", () => {
    expect(isVisibleTo(shared, B)).toBe(true);
  });

  it("★取り下げた案は、相手から見えなくなる", () => {
    expect(isVisibleTo(withdrawn, B)).toBe(false);
  });

  it("取り下げても、自分には見える（直して出し直せる）", () => {
    expect(isVisibleTo(withdrawn, A)).toBe(true);
  });
});

describe("★状態", () => {
  it("入力が無ければ NONE", () => expect(sharingStateOf(null)).toBe("NONE"));
  it("渡していなければ DRAFT", () => expect(sharingStateOf(draft)).toBe("DRAFT"));
  it("渡してあれば SHARED", () => expect(sharingStateOf(shared)).toBe("SHARED"));
  it("取り下げれば WITHDRAWN", () => expect(sharingStateOf(withdrawn)).toBe("WITHDRAWN"));

  it("★下書きの説明が「見えていない」と言い切っている", () => {
    // ★見えていると思われると、書けなくなる。下書きは考えるための場所である
    expect(SHARING_LABEL.DRAFT).toContain("見えていません");
  });
});

describe("★渡す・取り下げる", () => {
  it("中身の無い案は渡せない（相手に空の案が届く）", () => {
    expect(canShare({ ...draft, payload: null })).toBe(false);
    expect(canShare({ ...draft, payload: { monthlyAmount: 50000 } })).toBe(true);
  });

  it("すでに渡してあるものを、もう一度渡さない", () => {
    expect(canShare({ ...shared, payload: { monthlyAmount: 50000 } })).toBe(false);
  });

  it("渡していないものは取り下げられない（下書きは直せばよい）", () => {
    expect(canWithdraw(draft)).toBe(false);
  });

  it("渡したものは取り下げられる", () => {
    expect(canWithdraw(shared)).toBe(true);
  });

  it("二度は取り下げられない", () => {
    expect(canWithdraw(withdrawn)).toBe(false);
  });
});

describe("★取り消せるように見せない", () => {
  it("★渡す前に「見たことは取り消せない」と読める", () => {
    // ★操作の見た目が、実際にできることより多くを約束してはならない。
    //   「届きません」→「直接届きません」と同じ問題。
    expect(SHARE_CAVEAT).toContain("取り消せません");
  });

  it("★取り下げたことは、相手に伝わる（黙って消さない）", () => {
    expect(withdrawNotice("養育費")).toContain("取り下げ");
    expect(withdrawNotice("養育費")).toContain("養育費");
  });
});

describe("★お知らせに原文を含めない（C1）", () => {
  it("論点の名前だけを含む", () => {
    const n = shareNotice("養育費");
    expect(n).toContain("養育費");
    // ★金額・日付・自由記述が混ざる余地が無い
    expect(n).not.toMatch(/\d/);
  });

  it("取り下げのお知らせにも数字が入らない", () => {
    expect(withdrawNotice("財産分与")).not.toMatch(/\d/);
  });
});

describe("★了承すると、内容は必ず一致する", () => {
  it("★同じ payload を複製するので、payloadsAgree が自明に真になる", () => {
    // ★consent.ts に記録した欠陥：
    //     Aの提案 3万円 ／ Bの提案 4万円 で双方が承諾
    //     → 誰も合意していない 3万円が確定した
    //   仮案→了承にすると、この発生条件そのものが消える。
    const theirs = { monthlyAmount: 50000, payDay: "DAY_25", until: "AGE_20" };
    const copied = { ...theirs };
    expect(payloadsAgree([theirs, copied])).toBe(true);
  });

  it("独立に記入すると、ふつうは一致しない（だから仮案→了承にした）", () => {
    expect(
      payloadsAgree([
        { monthlyAmount: 50000, payDay: "DAY_25", until: "AGE_20" },
        { monthlyAmount: 50000, payDay: "DAY_25", until: "AGE_22_MARCH" },
      ]),
    ).toBe(false);
  });
});

/**
 * ★画面で隠さない。サーバ側で落とす。
 *
 *   画面で隠す実装にすると、API を直接見れば読める。
 *   C1（原文が渡らない）と同じ強さで守る。
 */
describe("★サーバ側で落とす", () => {
  const service = readFileSync("src/services/agreement.ts", "utf8");
  const route = readFileSync("src/app/api/cases/[caseId]/terms/route.ts", "utf8");

  it("★合意の view が、見えない提案を落としている", () => {
    expect(service).toMatch(/isVisibleTo\(p, input\.partyId\)/);
  });

  it("★了承は、見えている案だけを対象にする", () => {
    expect(route).toMatch(/isVisibleTo\(p, partyId\)/);
  });

  it("★了承の payload を画面から受け取らない（複製する）", () => {
    // ★受け取ると、了承のふりをして別の内容を入れられる
    const approve = route.slice(route.indexOf("async function approve"));
    expect(approve).toContain("...theirs.payload");
    expect(approve).not.toMatch(/body\.payload/);
  });
});
