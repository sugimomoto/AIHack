/**
 * 「決める」相談を、「相談する」相談にする
 *
 * ★★ 題が果たせない約束になっていた。
 *
 *   sc_001「養育費を決める」／ sc_006「面会のルールを決める」。
 *   対話から取り決めへ行く経路は断ってある（T1）ので、**話しても決まらない。**
 *   opening はさらに踏み込んで「決まると書面にできます」と言っていた。
 *   **できないことを、最初の一行で約束していた。**
 *
 * ★消さずに、題を直す。**行き先として要るから。**
 *
 *   取り決めの画面の「このことを相談する」は
 *   `/app/consult/new?topic=CHILD_SUPPORT` へ送り、
 *   `linkedTopic` が一致するシナリオを出す。
 *   消すと、**養育費そのものを相談する先が無くなる**（他は塾・進学・医療など個別の件）。
 *
 * ★kind も一緒に変える。題だけ直しても片手落ちになる。
 *
 *   FORMAL のままだと `isAdjustment` が false なので、
 *   **相談しても「決まったこと」に何も残らない。**
 *   いちばん残ってほしい題で、何も残らないことになる。
 *
 *   ADJUSTMENT にすると、ほかの19件と揃う。
 *     ・控えが残る
 *     ・「このご相談では、いまの取り決めは変わりません」が画面に出る
 *     ・合意済みでも「済んだ」に沈まない（別件として相談できる）
 *
 * ★promptHint から「算定表を参照して範囲を示してください」を外す。
 *   **数字を作らせない**（P3）。範囲は算定表そのものが示す。
 *
 * ★取り消せる。**古い値を必ず出力してから書き換える。**
 *
 * 使い方:
 *   npx tsx scripts/retitle-formal-scenarios.ts            … 調べるだけ
 *   npx tsx scripts/retitle-formal-scenarios.ts --apply    … 書き換える
 */
import { getDb } from "../src/infra-adapters/firestore/client";

const apply = process.argv.includes("--apply");

const CHANGES: Record<string, Record<string, string>> = {
  sc_001: {
    title: "養育費のことを相談する",
    kind: "ADJUSTMENT",
    promptHint:
      "養育費についてのご相談です。取り決めそのものは変わりません。金額や条項は、こちらからは作りません。",
    opening: "養育費のことですね。いまのご事情や、お考えになっていることをお書きください。",
  },
  sc_006: {
    title: "面会のルールを相談する",
    kind: "ADJUSTMENT",
    promptHint: "お会いになる約束についてのご相談です。取り決めそのものは変わりません。",
    opening:
      "お会いになる約束のことですね。ご希望や、難しいと感じておられるところをお書きください。",
  },
};

async function main() {
  const db = getDb();
  const col = db.collection("masters").doc("scenarios").collection("items");

  for (const [id, patch] of Object.entries(CHANGES)) {
    const ref = col.doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      console.log(`\n${id} … ありません`);
      continue;
    }

    console.log(`\n── ${id}`);
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      const before = String(doc.get(k) ?? "");
      if (before === v) {
        console.log(`   ${k} … すでに同じ`);
        continue;
      }
      changed = true;
      console.log(`   ${k}`);
      console.log(`     いま : ${before}`);
      console.log(`     あと : ${v}`);
    }
    if (!changed) continue;

    if (apply) {
      await ref.update(patch);
      console.log("   ★書き換えました");
    }
  }

  if (!apply) {
    console.log("\n── 何もしていません（調べただけ）");
    console.log("   書き換えるときは --apply を付けてください。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
