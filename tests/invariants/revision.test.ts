import { describe, expect, it } from "vitest";
import {
  describeChange,
  parseRevisionAction,
  reasonTextOf,
  REVISION_CHOICES,
  REVISION_PENDING_NOTE,
  REVISION_REASONS,
} from "@/domain/adjustment/revision";
import { isDocumentable, transition } from "@/domain/agreement/stateMachine";
import { CONTEXT_CATEGORIES, isHearsay } from "@/domain/relay/guard";

/**
 * ★K-6 変更申請を受ける側
 *
 *   「変更申請中」を「合意済」に戻すには相手の同意操作が要るのに、
 *   **その画面が無かった。**
 */

describe("★3つの選択肢に主従を作らない", () => {
  it("3つある", () => {
    expect(REVISION_CHOICES).toHaveLength(3);
  });

  // ★「よい」を強調した時点でダークパターンになる
  it("★強調や既定を表す属性を持たない", () => {
    for (const c of REVISION_CHOICES) {
      expect(Object.keys(c).sort()).toEqual(["action", "label"]);
    }
  });

  it("★「いまのままにしたい」が選べる", () => {
    expect(REVISION_CHOICES.map((c) => c.action)).toContain("KEEP");
  });

  it("知らない操作は受け付けない", () => {
    expect(parseRevisionAction("DELETE")).toBeNull();
    expect(parseRevisionAction(null)).toBeNull();
    expect(parseRevisionAction("accept")).toBe("ACCEPT");
  });

  // ★放置が不利にならないと分かって、はじめて落ち着いて選べる
  it("★返事をしないあいだは現状が続くと書いてある", () => {
    expect(REVISION_PENDING_NOTE).toContain("いまの取り決めが続きます");
  });
});

describe("★申し出の背景は、原文を越えさせない", () => {
  // ★自由記述を取次ぎの検査に通す実装は、必ず落ちた。
  //   本人が書いた文を「原文と一致しないこと」で検査すれば、当然すべて落ちる。
  //   書いたものが黙って消える経路を残さない。
  it("★一覧に無いものは通さない（自由記述をそのまま渡しても消える）", () => {
    expect(reasonTextOf("土曜に出勤しろと急に言われた")).toBeNull();
    expect(reasonTextOf("")).toBeNull();
    expect(reasonTextOf(null)).toBeNull();
  });

  it("越えてよいカテゴリは、定型の伝聞文になる", () => {
    expect(reasonTextOf("SCHEDULE_CONSTRAINT")).toBe("日程の都合がつかなくなったとのことです。");
  });

  // ★R-2：断定で越えさせない
  it("★すべての定型文が伝聞の形をしている", () => {
    for (const r of REVISION_REASONS) {
      expect(isHearsay(r.text)).toBe(true);
    }
  });

  // ★R-3：ホワイトリストは取次ぎと同じ一覧から採る
  it("★カテゴリが取次ぎのホワイトリストに収まっている", () => {
    for (const r of REVISION_REASONS) {
      expect(CONTEXT_CATEGORIES).toContain(r.code);
    }
  });

  it("★具体的な曜日や金額を定型文に含めない", () => {
    for (const r of REVISION_REASONS) {
      expect(r.text).not.toMatch(/[0-9０-９]|月曜|火曜|水曜|木曜|金曜|土曜|日曜/);
    }
  });
});

describe("★何が変わって、何が変わらないか", () => {
  const current = { frequency: "MONTHLY_1", dayOfWeek: "SAT", weekOfMonth: "第2" };
  const proposed = { dayOfWeek: "SUN", weekOfMonth: "第3" };

  it("変わらないものを先に言う", () => {
    const d = describeChange(current, proposed);
    expect(d.sentence).toBe("回数は変わりません。曜日と週が変わります。");
  });

  it("変わった項目は、前と後を持つ", () => {
    const d = describeChange(current, proposed);
    const day = d.changed.find((c) => c.key === "dayOfWeek")!;
    expect(day.from).toBe("土曜日");
    expect(day.to).toBe("日曜日");
  });

  it("触れていない項目は、変わらない側に入る", () => {
    const d = describeChange(current, proposed);
    expect(d.unchanged).toContain("回数");
  });

  it("金額は読める形にする", () => {
    const d = describeChange({ monthlyAmount: 50000 }, { monthlyAmount: 45000 });
    expect(d.changed[0]).toMatchObject({ label: "金額", from: "50,000円", to: "45,000円" });
  });

  // ★意味の定まらない値を条項に見せない（G-3b）
  it("★表記の定義が無いコード値は、変わったとも変わらないとも言わない", () => {
    const d = describeChange({ payDay: "DAY_99" }, { payDay: "LAST_DAY" });
    expect(d.changed).toHaveLength(0);
    expect(d.unchanged).toHaveLength(0);
    expect(d.hasUnreadable).toBe(true);
  });

  it("★入れ子をそのまま出さない", () => {
    const d = describeChange({ payDay: { code: "LAST_DAY" } }, { payDay: "LAST_DAY" });
    expect(d.hasUnreadable).toBe(true);
    expect(JSON.stringify(d.changed)).not.toContain("object");
  });
});

describe("★お返事があるまで、いまの取り決めが続く", () => {
  // ★ここを落とすと、変更を申し出た瞬間に現在の取り決めが公正証書から消える
  it("★変更申請中でも、いまの取り決めは書面に載る", () => {
    expect(isDocumentable("REVISION_REQUESTED")).toBe(true);
  });

  it("「この内容でよい」で合意済に戻る", () => {
    expect(transition("REVISION_REQUESTED", "AGREE_REVISION")).toBe("AGREED");
  });

  // ★これが無いと、断った人が現在の取り決めを失う
  it("★「いまのままにしたい」で、いまの取り決めに戻る", () => {
    expect(transition("REVISION_REQUESTED", "DECLINE_REVISION")).toBe("AGREED");
  });

  it("「別の案を出したい」は話し合いに戻る", () => {
    expect(transition("REVISION_REQUESTED", "REVISION_FAILED")).toBe("IN_NEGOTIATION");
  });
});
