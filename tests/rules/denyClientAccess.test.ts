import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ★L0：Firestore セキュリティルールの検証（→ docs/architecture.md §5.2）
 *
 * クライアントからのアクセスを一切許可しないことを確認する。
 *
 * この層が意味を持つのは最悪ケースである。
 * モバイルアプリから Firebase 設定値を抽出して直接クエリしても、
 * ルールが拒否するため相手のデータに到達できない。
 *
 * L0（ここ）と L1（ContextBuilder）は独立している。
 * 片方が破れても、もう片方が残る。
 *
 * 実行には Firestore エミュレータが必要:
 *   pnpm dlx firebase-tools emulators:start --only firestore
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8081";
const [host, port] = HOST.split(":");

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "aida-rules-test",
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync("firestore/firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

/** アプリが実際に持つコレクション（→ architecture.md §3.1） */
const PATHS = [
  "cases/case1",
  "cases/case1/parties/p1",
  "cases/case1/consultations/c1",
  "cases/case1/consultations/c1/messages/m1",
  "cases/case1/agreementItems/i1",
  "cases/case1/proposals/pr1",
  "cases/case1/adjustments/a1",
  "cases/case1/mediationEvents/e1",
  "cases/case1/obligations/o1",
  "contactInfo/p1", // ★非開示情報。ケース配下に置かない
  "masters/topicCategories",
  "llmCallLogs/l1",
];

describe("L0｜クライアントからの Firestore 直接アクセス", () => {
  describe("未認証", () => {
    it.each(PATHS)("%s を読めない", async (p) => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, p)));
    });

    it.each(PATHS)("%s に書けない", async (p) => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, p), { x: 1 }));
    });
  });

  describe("★認証済みでも拒否される", () => {
    it.each(PATHS)("%s を読めない", async (p) => {
      const db = env.authenticatedContext("user1").firestore();
      await assertFails(getDoc(doc(db, p)));
    });

    it("自分の contactInfo であっても読めない（すべてサーバー経由）", async () => {
      const db = env.authenticatedContext("p1").firestore();
      await assertFails(getDoc(doc(db, "contactInfo/p1")));
    });
  });

  it("ルールに allow true が書かれていない", () => {
    const rules = readFileSync("firestore/firestore.rules", "utf8");
    const allows = rules.match(/allow[^;]*;/g) ?? [];
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a).toMatch(/if\s+false/);
  });
});
