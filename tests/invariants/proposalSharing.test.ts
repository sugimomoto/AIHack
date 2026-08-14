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

/**
 * ★実機で見つけた欠陥を固定する
 *
 * どれも「テストは通るが、通しで動かすと壊れている」種類のものだった。
 */
describe("★実機で見つけた欠陥", () => {
  const service = readFileSync("src/services/agreement.ts", "utf8");
  const route = readFileSync("src/app/api/cases/[caseId]/terms/route.ts", "utf8");
  const repo = readFileSync(
    "src/infra-adapters/firestore/repositories/caseRepository.ts",
    "utf8",
  );

  it("★取り下げても、自分の手元からは消えない", () => {
    // ★取り下げは「相手から見えなくする」ことであって、自分の下書きを消すことではない。
    //   消していたため、S-5 の画面が帯だけになり、書き直す対象が無くなっていた。
    expect(service).toContain("ownPayload: mine?.payload ?? null");
  });

  it("★合意になれるのは、双方に見えている案だけ", () => {
    // ★下書きを数えると、おたがい渡していないのに
    //   たまたま同じ内容を書いただけで合意が成立する。
    const record = service.slice(service.indexOf("export async function recordConsent"));
    expect(record).toMatch(/sharedAt !== null && p\.withdrawnAt === null/);
  });

  it("★了承は、確定の判定を通る（setConsent だけで終わらせない）", () => {
    // ★直接 setConsent を呼んでいたため、了承しても取り決めが作られず、
    //   公正証書の原案にも入らなかった。
    const approve = route.slice(route.indexOf("async function approve"));
    expect(approve).toContain("recordConsent");
  });

  it("★了承では承諾をやり直さない", () => {
    // ★やり直すと、了承した瞬間に相手の承諾が消えて、いつまでも合意にならない。
    //   payload はサーバが複製したものなので、内容は必ず同じである。
    expect(repo).toContain("keepConsents");
    const approve = route.slice(route.indexOf("async function approve"));
    expect(approve).toContain("keepConsents: true");
  });

  it("★下書きの保存では、承諾をやり直す", () => {
    // ★内容が違いうる経路。前回の ACCEPTED が残っていると、
    //   片側1クリックで別の内容が確定する。
    const save = route.slice(route.indexOf("async function save"), route.indexOf("async function latestOwn"));
    expect(save).not.toContain("keepConsents");
  });

  it("★取り下げたものを、同じ行のまま出し直さない", () => {
    // ★sharedAt を書き換えると、取り下げた記録が消える
    const share = route.slice(route.indexOf("async function share"), route.indexOf("async function withdraw"));
    expect(share).toMatch(/withdrawnAt !== null/);
    expect(share).toContain("appendProposal");
  });
});

describe("★了承した直後に「別の案」と出さない", () => {
  it("内容が同じなら DIVERGED にしない", async () => {
    const { screenStateOf } = await import("@/domain/agreement/screen");
    const same = { monthlyAmount: 50000, payDay: "DAY_25", until: "AGE_20" };
    expect(
      screenStateOf({
        agreed: false,
        ownPayload: same,
        otherPayload: { ...same },
        sharing: "SHARED",
      }),
    ).toBe("SHARED");
  });

  it("★内容が違っても、二つの案を並べる状態を作らない", async () => {
    // ★かつては DIVERGED（お相手から別の案）にしていた。**やめた。**
    //   二つの金額を左右に並べた時点で、交渉の卓になる。
    //   了承しないときは、必ず仲介（相談）を通す。
    const { screenStateOf } = await import("@/domain/agreement/screen");
    expect(
      screenStateOf({
        agreed: false,
        ownPayload: { monthlyAmount: 50000 },
        otherPayload: { monthlyAmount: 30000 },
        sharing: "SHARED",
      }),
    ).toBe("INCOMING");
  });

  it("★合意済は、何よりも先に見える", async () => {
    const { screenStateOf } = await import("@/domain/agreement/screen");
    expect(
      screenStateOf({
        agreed: true,
        ownPayload: { a: 1 },
        otherPayload: { a: 2 },
        sharing: "SHARED",
      }),
    ).toBe("AGREED");
  });
});

/**
 * ★「別の案を出す」をやめた
 *
 * 受け取った側にできるのは「了承する」か「このことを相談する」の2つ。
 * 対立は、フォーム上の対案の応酬ではなく、**必ず仲介を通す。**
 *
 * ★実装は壊れてもいた。別の案を保存しても画面が INCOMING に戻り、
 *   下書きが見えず、渡す手段も無かった（実機で検出）。
 */
describe("★対案はフォームで返さない。相談を通す", () => {
  // ★コメントは数えない。「やめた」と書いた説明自体が引っかかる
  const strip = (x: string) =>
    x.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const screen = strip(readFileSync("src/components/agreement/TopicScreen.tsx", "utf8"));
  const route = readFileSync("src/app/api/cases/[caseId]/terms/route.ts", "utf8");

  it("★画面に「別の案を出す」が無い", () => {
    expect(screen).not.toContain("別の案を出す");
  });

  it("★受け取った側の行き先が、相談になっている", () => {
    const incoming = screen.slice(screen.indexOf('state === "INCOMING"'));
    expect(incoming.slice(0, 3000)).toContain("ConsultLink");
  });

  it("★二つの案を並べる画面を呼ばない", () => {
    // ★Divergence / RangeBar のコードは残す。呼ばないだけ
    expect(screen).not.toMatch(/<Divergence/);
  });

  it("★先に渡した人が筆を持つ。API で止める", () => {
    // ★画面だけで止めない。API を直接叩けば渡せてしまう
    const share = route.slice(route.indexOf("async function share"), route.indexOf("async function withdraw"));
    expect(share).toContain("theirsShared");
    expect(share).toMatch(/409/);
  });
});

describe("★下書きを消せるのは、自分の渡していないものだけ", () => {
  const repo = readFileSync("src/infra-adapters/firestore/repositories/caseRepository.ts", "utf8");
  const fn = repo.slice(repo.indexOf("export async function discardOwnDrafts"));

  it("★自分のものだけ", () => {
    expect(fn.slice(0, 900)).toContain('where("byPartyId", "==", partyId)');
  });

  it("★渡したものは消さない（相手が見ている）", () => {
    expect(fn.slice(0, 900)).toMatch(/sharedAt.*=== null/);
  });

  it("★合意済みには触れない（片方が消せてはいけない）", () => {
    // proposals しか触らない。agreementItems を消していない
    expect(fn.slice(0, 900)).toContain('collection("proposals")');
    expect(fn.slice(0, 900)).not.toContain("agreementItems");
  });
});
