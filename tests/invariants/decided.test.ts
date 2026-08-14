import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EMPTY_UPCOMING } from "@/domain/ui/emptyState";

/**
 * ★「決まったこと」（旧「これから」）
 *
 * 引き算だけを固定する。**外したものが戻ってこないこと**を見る。
 *
 *   手間 → 押されない → 記録が無い → 逸脱として検知される
 *                                      ↓
 *                 実際には払っているのに「確認できていません」と出る
 *
 * > 記録率が低い台帳は、正しい信号より誤った信号を多く出す。
 *
 * @see .steering/20260812-feedback-pivot/design-upcoming.md
 */

/**
 * ★コメントは数えない。
 *   「なぜ外したか」を書いたコメント自体が引っかかるため。
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const service = stripComments(readFileSync("src/services/schedule.ts", "utf8"));
const panel = stripComments(readFileSync("src/components/schedule/DecidedPanel.tsx", "utf8"));
const tabbar = readFileSync("src/components/ui/TabBar.tsx", "utf8");

describe("★返す内容そのものを絞る（画面で隠さない）", () => {
  const load = service.slice(service.indexOf("export async function loadSchedule"));

  it("★予定（rows）を返さない", () => {
    // ★画面だけ消しても、API を見れば読める。出さない側で止める
    expect(load).not.toMatch(/\brows\b/);
  });

  it("★逸脱を返さない", () => {
    expect(load).not.toMatch(/deviations/);
  });

  it("★リマインドを返さない（督促になる）", () => {
    expect(load).not.toMatch(/reminders/);
  });

  it("★先取特権の判定を返さない", () => {
    expect(load).not.toMatch(/enforceability/);
  });

  it("約束と、今回だけの変更は返す", () => {
    expect(load).toMatch(/arrangements/);
    expect(load).toMatch(/exceptions/);
  });
});

describe("★画面に、押されないボタンを置かない", () => {
  it("★履行の申告ボタンが無い", () => {
    expect(panel).not.toContain("支払いました");
    expect(panel).not.toContain("入金を確認");
  });

  it("★「確認できていません」を出さない", () => {
    // ★実際は払っているのに疑いが立つ
    expect(panel).not.toContain("確認できていません");
  });

  it("★済んだかどうかを問わない書き方にする", () => {
    // ★押されないボタンを置かない代わりに、状態を持たない文にしてある
    expect(panel).toContain("お約束として控えています");
  });
});

describe("★空のとき（L-3）", () => {
  it("★「通知は設定で切れます」を外した", () => {
    // ★リマインドをやめる以上、その通知は出ない。できないことを書かない
    const all = [EMPTY_UPCOMING.heading, EMPTY_UPCOMING.body, EMPTY_UPCOMING.note].join("");
    expect(all).not.toContain("通知");
  });

  it("★支払日・会う日が並ぶとは書かない（予定を管理しない）", () => {
    expect(EMPTY_UPCOMING.heading).not.toContain("支払いの日");
    expect(EMPTY_UPCOMING.examples.join("")).not.toContain("毎月");
  });

  it("★取り決めとの違いを書く（タブが隣り合うため）", () => {
    expect(EMPTY_UPCOMING.note).toContain("取り決め");
  });
});

describe("★タブ", () => {
  it("★「これから」ではなく「決まったこと」", () => {
    // ★中身が「これから起きること」から「決まったことの記録」に変わった。
    //   「これから」のままだと予定表だと思われる（スコープ外にしたもの）
    expect(tabbar).toContain('label: "決まったこと"');
    expect(tabbar).not.toContain('label: "これから"');
  });

  it("★取り決めと決まったことが、同じ形のアイコンにならない", () => {
    // ★どちらもチェックにしたところ、隣り合う2つが同じ形に見えた
    const agreement = tabbar.slice(tabbar.indexOf("function AgreementIcon"));
    expect(agreement.slice(0, 400)).not.toMatch(/l1\.8 1\.8/); // 中のチェックを外した
  });
});
