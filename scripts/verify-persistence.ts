/**
 * S19 の検証 ★実データでの C1
 *
 * ★保存を通しても、相手の原文が読めないことを確かめる。
 *   生成できることと、届くことは違う。
 */
import { postMessage, loadView } from "../src/services/consultation";
import { asPartyId } from "../src/domain/case/types";

const CASE = "case_dev_001";
const A = asPartyId("party_dev_a");
const B = asPartyId("party_dev_b");

const A_RAW = "月3万が限界。こっちだって仕事切られて必死なんだよ。そっちだって働いてるだろ、少しは考えろ";

async function main() {
  console.log("① Aが投稿する");
  console.log(`   原文: ${A_RAW}`);
  const r = await postMessage({ caseId: CASE, partyId: A, text: A_RAW });
  console.log(`\n   Aへの受け止め: ${r.reply.slice(0, 60)}…`);
  console.log(`   ★Bに届いたもの: ${r.relayed ?? "（届かず）"}`);

  console.log("\n② それぞれの画面を読み出す");
  const av = await loadView({ caseId: CASE, partyId: A });
  const bv = await loadView({ caseId: CASE, partyId: B });

  console.log(`   Aのメッセージ数: ${av.messages.length} ／ Aへの取次ぎ: ${av.inbound.length}`);
  console.log(`   Bのメッセージ数: ${bv.messages.length} ／ Bへの取次ぎ: ${bv.inbound.length}`);

  console.log("\n③ ★C1 の検証（実データ）");
  const bAll = JSON.stringify(bv);
  const check = (label: string, ok: boolean) => console.log(`   ${label}: ${ok ? "✓" : "✗"}`);

  check("Aの原文が、Aの画面にはある      ", JSON.stringify(av).includes(A_RAW));
  check("★Aの原文が、Bの画面には無い     ", !bAll.includes(A_RAW));
  check("★非難『必死』がBに届いていない   ", !bAll.includes("必死"));
  check("★非難『少しは考えろ』が届いていない", !bAll.includes("少しは考えろ"));
  check("★Aの受け止め応答がBに無い       ", !bAll.includes(r.reply.slice(0, 20)));
  // ★S2 の seed に元から A 宛の取次ぎが1件ある。件数では判定できない。
  //   「今回作られた取次ぎ」が B にのみ現れることを確かめる。
  const relayed = r.relayed ?? "";
  check(
    "★今回の取次ぎがBに現れる        ",
    relayed !== "" && bv.inbound.some((e) => e.content === relayed),
  );
  check(
    "★今回の取次ぎがAには現れない     ",
    relayed !== "" && !av.inbound.some((e) => e.content === relayed),
  );

  if (bv.inbound.length > 0) {
    console.log(`\n   Bが見るもの:\n     ${bv.inbound[bv.inbound.length - 1].content.split("\n").join("\n     ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
