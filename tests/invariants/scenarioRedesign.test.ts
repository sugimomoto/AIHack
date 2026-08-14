import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import scenarios from "../../firestore/seeds/scenarios.json";
import categories from "../../firestore/seeds/topicCategories.json";
import { NOT_NEGOTIABLE_NOTE } from "@/domain/consultation/negotiable";

/**
 * ★実データを受けた、シナリオとカテゴリの作り直し
 *
 * 約1,080件・9.5か月のやり取りを10の大項目に分けたものと突き合わせた。
 *
 * @see .steering/20260814-real-data-findings/design.md 第2部
 */

type S = { id: string; title: string; kind: string; categoryId: string; examples?: string[] };
const sc = scenarios as S[];
const cats = categories as { id: string; name: string }[];

describe("★「決める」と題しながら決まらないものを置かない", () => {
  it("★FORMAL（取り決めを決める相談）が無い", () => {
    // ★対話から取り決めを作らないと決めた以上、
    //   題が「決める」なのに決まらない。果たせない約束になる。
    expect(sc.filter((s) => s.kind === "FORMAL")).toEqual([]);
  });

  it("★題に「決める」が無い", () => {
    for (const s of sc) {
      expect(s.title.includes("決める"), `決まらないのに決めると書いている: ${s.id}`).toBe(false);
    }
  });

  it("★外した跡に、取り決め画面への行き先がある", () => {
    // ★消すだけだと、入口が消えて、決める場所には行けなくなる
    const nc = readFileSync("src/components/consult/NewConsult.tsx", "utf8");
    expect(nc).toContain("/app/agreements");
    expect(nc).toContain("取り決めを決める・変える");
  });

  it("★このご相談では取り決めが変わらないことを、書く前に言う", () => {
    // ★文言は書かれていたのに、一度も表示されていなかった
    const talk = readFileSync("src/app/app/consult/talk/page.tsx", "utf8");
    expect(talk).toContain("NOT_NEGOTIABLE_NOTE");
    expect(NOT_NEGOTIABLE_NOTE).toContain("取り決めの画面");
    // ★行き先も同じ場所に置く。片方だけだと行き止まりになる
    expect(talk).toContain("/app/agreements");
  });
});

describe("★実データの10大項目すべてに、入口がある", () => {
  const titles = sc.map((s) => s.title).join("／");

  // ★大項目 → その入口を示す語
  const NEEDED: [string, string[]][] = [
    ["1 送迎・生活サポート", ["送迎", "受け渡し", "荷物"]],
    ["2 学校行事・学校関連", ["学校行事", "提出書類", "持ち物", "面談"]],
    ["3 突発的な費用", ["費用", "精算", "買うもの"]],
    ["4 転校・進路", ["進学", "転居"]],
    ["5 健康・発達", ["医療", "体調", "特性"]],
    ["6 学校でのできごと", ["学校でのできごと"]],
    ["7 しつけ・生活ルール", ["生活のルール"]],
    ["9 事務手続き", ["提出書類"]],
    ["10 旅行・キャンプ", ["長期休暇", "宿泊"]],
  ];

  it.each(NEEDED)("%s に入口がある", (_label, words) => {
    expect(words.some((w) => titles.includes(w))).toBe(true);
  });

  it("★8 緊急・安全確認は、入口を作らない（スコープ外）", () => {
    // ★平時の設計（急かさない）を崩すことになる。
    //   中途半端に扱うと、届かなかったときの責任が重い。
    for (const w of ["緊急", "急ぎ", "安否", "行方"]) {
      expect(titles.includes(w), `緊急の入口ができている: ${w}`).toBe(false);
    }
  });

  it("★急な体調の窓口は、常設の一覧にある（機能ではなく、行き先）", () => {
    const rs = JSON.parse(readFileSync("firestore/seeds/supportResources.json", "utf8")) as {
      contact: string;
      note: string;
    }[];
    const k = rs.find((r) => r.contact === "#8000");
    expect(k).toBeDefined();
    // ★受付時間は都道府県ごとに違う。24時間とは書かない（一次資料で確認）
    expect(k!.note).toContain("都道府県");
    expect(k!.note).not.toContain("24時間");
  });
});

describe("★カテゴリ", () => {
  it("★「学校のこと」がある", () => {
    // ★実データで独立した塊だった。「日常の連絡」と「進路・生活」に割れていた
    expect(cats.map((c) => c.name)).toContain("学校のこと");
  });

  it("すべてのシナリオが、実在するカテゴリに属す", () => {
    const ids = new Set(cats.map((c) => c.id));
    for (const s of sc) expect(ids.has(s.categoryId), `${s.id}`).toBe(true);
  });

  it("空のカテゴリを作らない", () => {
    for (const c of cats) {
      expect(sc.some((s) => s.categoryId === c.id), `空のカテゴリ: ${c.id}`).toBe(true);
    }
  });
});

describe("★言い出しにくい話題に、責める言葉を入口に置かない", () => {
  it("★「問題行動」「トラブル」と書かない", () => {
    // ★実データの分類名は「学校トラブル・問題行動」だが、その語を画面に出さない。
    //   入口に書いてあれば、書く前に責められた気持ちになる。
    const all = sc.map((s) => s.title).join("");
    for (const w of ["問題行動", "トラブル", "非行", "違反"]) {
      expect(all.includes(w), `責める語が入口にある: ${w}`).toBe(false);
    }
  });

  it("★書き方の例に、責める言い方を置かない", () => {
    // ★例は、その人の最初の一文になる
    const BLAMING = ["なぜ", "どうして", "約束したのに", "守って", "ひどい", "いい加減", "せい"];
    for (const s of sc) {
      for (const e of s.examples ?? []) {
        for (const b of BLAMING) {
          expect(e.includes(b), `責める例: ${s.id}「${e}」`).toBe(false);
        }
      }
    }
  });
});
