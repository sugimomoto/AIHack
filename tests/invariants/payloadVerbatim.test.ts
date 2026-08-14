import { describe, expect, it } from "vitest";
import {
  isFragment,
  isStatedIn,
  parseYen,
  resolveAmount,
  stripUnstatedFrom,
} from "@/domain/relay/payload";

/**
 * ★事実の断片は、原文のまま
 *
 * 実データ（約1,080件）を実装に通して見つけた欠陥を固定する。
 *
 *   スキーマの title と description が、そのまま値として出力されていた。
 *   書かれていない日付も作られた。金額は3回とも間違った。
 *
 * ★検査の向きが、取次ぎ本文とは逆になる。
 *
 *   | 取次ぎ本文（content） | **逐語であってはならない**（原文の流出。INV-4a） |
 *   | 事実の断片（payload） | **逐語でなければならない**（でなければ捏造） |
 *
 *   > 言葉は渡さない。事実は、原文のまま。
 */

const 写真 = "今日の運動会の写真です。徒競走で2位でした。楽しそうにしていました。";
const 体調 = "娘が朝から38度の熱を出しています。今日は学校を休ませました。";
const 面談 = "来週の三者面談ですが、火曜の15時で学校から連絡がありました。";
const メガネ = "娘のメガネが壊れて作り直しました。6万円かかったので、折半でお願いします。";

describe("★実データで出た捏造が、すべて落ちる", () => {
  it("★description の例文（入学金）が落ちる", () => {
    expect(stripUnstatedFrom(写真, { subject: "入学金" })).toEqual({});
  });

  it("★title そのもの（何について）が落ちる", () => {
    expect(stripUnstatedFrom(体調, { subject: "何について" })).toEqual({});
  });

  it("★description そのもの（例: 半分ずつ / 6対4）が落ちる", () => {
    expect(stripUnstatedFrom(体調, { shareText: "例: 半分ずつ / 6対4" })).toEqual({});
  });

  it("★書かれていない日付が落ちる", () => {
    // ★原文は「来週火曜」。2023-10-10 は実在しない
    expect(stripUnstatedFrom(面談, { date: "2023-10-10" })).toEqual({});
  });

  it("★換算された金額が落ちる（原文に 50000 と書かれていない）", () => {
    expect(stripUnstatedFrom(メガネ, { amountText: "50000" })).toEqual({});
  });
});

describe("★原文にあるものは、残る", () => {
  it("原文どおりの語は残る", () => {
    expect(stripUnstatedFrom(メガネ, { subject: "メガネ", amountText: "6万円" })).toEqual({
      subject: "メガネ",
      amountText: "6万円",
    });
  });

  it("★表記の揺れ（全角・記号・空白）は一致とみなす", () => {
    expect(isStatedIn("６万円かかりました", "6万円")).toBe(true);
    expect(isStatedIn("三者面談、火曜の15時です", "火曜の15時")).toBe(true);
  });

  it("★1文字は照合しない（偶然一致する）", () => {
    expect(isStatedIn(写真, "会")).toBe(false);
  });

  it("入れ子も見る。空になった入れ子は消える", () => {
    expect(stripUnstatedFrom(メガネ, { a: { subject: "入学金" }, b: { subject: "メガネ" } })).toEqual({
      b: { subject: "メガネ" },
    });
  });
});

describe("★事実の断片であること（文を丸ごと入れない）", () => {
  it("★原文を丸ごと拾ったものは落ちる", () => {
    // ★逐語の検査は通ってしまう（原文にある）。だが断片ではなく文である
    const 丸ごと = "娘が朝から38度の熱を出しています。今日は学校を休ませました。";
    expect(isStatedIn(体調, 丸ごと)).toBe(true);
    expect(isFragment(丸ごと)).toBe(false);
    expect(stripUnstatedFrom(体調, { shareText: 丸ごと })).toEqual({});
  });

  it("事実の断片は残る（句点が無い）", () => {
    expect(isFragment("6万円")).toBe(true);
    expect(isFragment("火曜の15時")).toBe(true);
    expect(isFragment("半分ずつ")).toBe(true);
  });

  it("★桁数を決め打ちしない。句点で切る", () => {
    expect(isFragment("1万円超えなので折半でお願いします")).toBe(true);
  });
});

describe("★金額は、コードで解釈する（P3）", () => {
  it("★実測で外し続けた「6万円」が、必ず 60000 になる", () => {
    // ★LLM は 5000 / 50000 / 50000 と答えた。3回とも誤り
    expect(parseYen("6万円")).toBe(60000);
  });

  it("よくある表記", () => {
    expect(parseYen("3万")).toBe(30000);
    expect(parseYen("1万5千円")).toBe(15000);
    expect(parseYen("5千円")).toBe(5000);
    expect(parseYen("50000")).toBe(50000);
    expect(parseYen("50,000円")).toBe(50000);
    expect(parseYen("６万円")).toBe(60000); // 全角
  });

  it("★解釈できなければ null。推測しない", () => {
    expect(parseYen("半分ずつ")).toBeNull();
    expect(parseYen("いくらか")).toBeNull();
    expect(parseYen("")).toBeNull();
  });

  it("★単位が無く8桁以上の数字列は通さない（日付・電話番号の形）", () => {
    expect(parseYen("20261231")).toBeNull();
    expect(parseYen("09012345678")).toBeNull();
  });

  it("★上限の額そのものは決めない（決め打ちは、いずれ実際の額を弾く）", () => {
    expect(parseYen("1000万円")).toBe(10_000_000);
    expect(parseYen("12345678円")).toBe(12_345_678);
  });

  it("★解釈できない金額は、項目ごと持たない（空欄のほうが安全）", () => {
    expect(resolveAmount({ amountText: "半分ずつ", subject: "メガネ" })).toEqual({
      subject: "メガネ",
    });
  });

  it("解釈できたら amountYen に変わる", () => {
    expect(resolveAmount({ amountText: "6万円", subject: "メガネ" })).toEqual({
      amountYen: 60000,
      subject: "メガネ",
    });
  });
});

describe("★スキーマから例文を消した", () => {
  it("抽出用スキーマの description に「例:」が無い", async () => {
    const { readFileSync } = await import("node:fs");
    const schemas = JSON.parse(readFileSync("firestore/seeds/payloadSchemas.json", "utf8")) as {
      targetType: string;
      schema: { properties: Record<string, { description?: string }> };
    }[];
    for (const s of schemas.filter((x) => x.targetType === "RELAY_EXTRACTION")) {
      for (const [k, v] of Object.entries(s.schema.properties)) {
        expect(v.description ?? "", `例文が残っている: ${k}`).not.toContain("例:");
      }
    }
  });

  it("★LLM に単位を換算させる項目が無い", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync("firestore/seeds/payloadSchemas.json", "utf8");
    const adj = JSON.parse(raw).find((x: { id: string }) => x.id === "ps_adjustment_v1");
    expect(Object.keys(adj.schema.properties)).not.toContain("amountYen");
    expect(Object.keys(adj.schema.properties)).toContain("amountText");
  });
});
