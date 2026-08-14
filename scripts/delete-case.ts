/**
 * ケースと、関連するデータを消す
 *
 * ★★ `cases/{caseId}` を消すだけでは片づかない。
 *
 *   このアプリは、**当事者の非開示情報をケースの外に置いている**（INV-2a）。
 *   ケースだけ消すと、**住所・電話・勤務先・精密な年収が残る。**
 *
 *   消す先：
 *     cases/{caseId}              … サブコレクションごと（相談・取次ぎ・仮案・合意…）
 *     contactInfo/{partyId}       … ★ケースの外。住所・年収
 *     invitations（caseId 一致）   … ★ケースの外
 *     safetyEvents（partyId 一致） … ★ケースの外。運営が読む記録
 *     llmCallLogs（caseId 一致）   … ★ケースの外。原価の集計
 *
 * ★退会（U-07）の下地でもある。**どこに何があるかを、消す手順として残す。**
 *   ただし退会そのものは、保持義務の確認待ちで未実装（R-11）。
 *
 * ★取り消せない。**既定では消さない。**
 *
 * ★★ `case_dev_*` は `--orphaned` に含めない。
 *
 *   種を播いたデモ用のデータは、**Auth にユーザーがいない。**
 *   そのため「迷子」の条件（authUid が Auth に無い）に当てはまってしまう。
 *
 *   実際に `case_dev_001`（相談3・取次ぎ13・仮案5・合意2）が候補に挙がった。
 *   **デモ動画を撮る前だった。**
 *
 *   ★消したいときは、**id を明示する。**まとめ消しには乗せない。
 *
 * 使い方:
 *   npx tsx scripts/delete-case.ts <caseId> [<caseId> …]            … 調べるだけ
 *   npx tsx scripts/delete-case.ts <caseId> … --delete              … 消す
 *   npx tsx scripts/delete-case.ts --orphaned                       … 迷子のケースを探す
 *   npx tsx scripts/delete-case.ts --orphaned --delete              … まとめて消す
 */
import { getDb } from "../src/infra-adapters/firestore/client";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const doDelete = args.includes("--delete");
const findOrphaned = args.includes("--orphaned");
const ids = args.filter((a) => !a.startsWith("--"));

/**
 * 迷子のケース。
 *
 * ★当事者の `authUid` が、Auth 側に**存在しない**もの。
 *   アカウントを消したあとに残る。**誰も入れないが、データは残っている。**
 *
 * ★`authUid` を1つも持たないケースは**含めない。**
 *   サインアップ必須にする前に作られたものが該当し、
 *   **持ち主が Cookie を持っている可能性がある。**
 */
async function orphanedCaseIds(): Promise<string[]> {
  const db = getDb();
  const auth = getAuth();
  const cases = await db.collection("cases").get();
  const out: string[] = [];

  for (const c of cases.docs) {
    // ★種を播いたデモ用。Auth にユーザーがいないのは当たり前なので、除く
    if (c.id.startsWith("case_dev")) continue;

    const parties = await c.ref.collection("parties").get();
    const uids = parties.docs.map((p) => p.get("authUid") as string | null).filter(Boolean) as string[];
    if (uids.length === 0) continue; // ★匿名時代のもの。触らない

    let alive = false;
    for (const uid of uids) {
      try {
        await auth.getUser(uid);
        alive = true;
        break;
      } catch {
        /* いない */
      }
    }
    if (!alive) out.push(c.id);
  }
  return out;
}

async function main() {
  const db = getDb();
  const targets = findOrphaned ? await orphanedCaseIds() : ids;

  if (targets.length === 0) {
    console.log(findOrphaned ? "\n迷子のケースはありません。" : "\ncaseId を指定してください。");
    return;
  }

  console.log(`\n── 対象 ${targets.length}件${findOrphaned ? "（迷子のケース）" : ""}`);

  const plan: { caseId: string; parties: string[]; counts: Record<string, number> }[] = [];

  for (const id of targets) {
    const ref = db.collection("cases").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      console.log(`\n   ${id}  … ありません`);
      continue;
    }
    const parties = (await ref.collection("parties").get()).docs.map((d) => d.id);
    const counts: Record<string, number> = {};
    for (const name of [
      "parties",
      "children",
      "consultations",
      "mediationEvents",
      "proposals",
      "agreementItems",
      "adjustments",
      "arrangements",
      "rules",
    ]) {
      counts[name] = (await ref.collection(name).get()).size;
    }

    // ★ケースの外にあるもの
    const [invs, logs] = await Promise.all([
      db.collection("invitations").where("caseId", "==", id).get(),
      db.collection("llmCallLogs").where("caseId", "==", id).get(),
    ]);
    counts["invitations（ケース外）"] = invs.size;
    counts["llmCallLogs（ケース外）"] = logs.size;

    let contacts = 0;
    let safety = 0;
    for (const p of parties) {
      if ((await db.collection("contactInfo").doc(p).get()).exists) contacts++;
      safety += (await db.collection("safetyEvents").where("partyId", "==", p).get()).size;
    }
    counts["contactInfo（★住所・年収）"] = contacts;
    counts["safetyEvents（ケース外）"] = safety;

    console.log(`\n   ${id}`);
    for (const [k, v] of Object.entries(counts)) if (v > 0) console.log(`     ${k}: ${v}`);
    if (Object.values(counts).every((v) => v === 0)) console.log("     （中身なし）");

    plan.push({ caseId: id, parties, counts });
  }

  if (!doDelete) {
    console.log("\n── 何もしていません（調べただけ）");
    console.log("   消すときは --delete を付けてください。");
    return;
  }

  for (const t of plan) {
    const ref = db.collection("cases").doc(t.caseId);

    // ★ケースの外から先に消す。★途中で止まっても、非開示情報を残さない
    for (const p of t.parties) {
      await db.collection("contactInfo").doc(p).delete();
      const se = await db.collection("safetyEvents").where("partyId", "==", p).get();
      for (const d of se.docs) await d.ref.delete();
    }
    for (const name of ["invitations", "llmCallLogs"]) {
      const q = await db.collection(name).where("caseId", "==", t.caseId).get();
      for (const d of q.docs) await d.ref.delete();
    }

    // ★サブコレクションごと。Firestore は親を消しても子が残る
    await db.recursiveDelete(ref);
    console.log(`★消しました  ${t.caseId}`);
  }

  console.log(`\n${plan.length}件を消しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
