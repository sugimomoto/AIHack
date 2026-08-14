/**
 * アカウント（Firebase Auth のユーザー）を消す
 *
 * ★取り消せない操作である。だから、
 *   1. 何が消えるかを**先に全部表示する**
 *   2. **確認の引数が無ければ、消さない**
 *   3. ケースが紐づいていたら、**既定では止まる**（データを孤児にしない）
 *
 * ★メールアドレスは Firestore に無い。Firebase Auth にだけある。
 *   退会の実装では、**Firestore を消すだけでは足りない**（U-07）。
 *
 * 使い方:
 *   npx tsx scripts/delete-auth-user.ts <email>            … 調べるだけ（消さない）
 *   npx tsx scripts/delete-auth-user.ts <email> --delete   … 消す
 *   npx tsx scripts/delete-auth-user.ts <email> --delete --with-cases
 *                                                          … 紐づくケースがあっても消す
 *                                                            （★ケースは残る。孤児になる）
 */
import { getDb } from "../src/infra-adapters/firestore/client";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];
const doDelete = process.argv.includes("--delete");
const withCases = process.argv.includes("--with-cases");

async function main() {
  if (!email || !email.includes("@")) {
    console.error("使い方: npx tsx scripts/delete-auth-user.ts <email> [--delete] [--with-cases]");
    process.exit(1);
  }

  const db = getDb();
  const auth = getAuth();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.log(`\n${email} のユーザーは、Firebase Auth にいません。`);
    console.log("そのまま新しくサインアップできます。");
    return;
  }

  console.log("\n── Firebase Auth");
  console.log(`   メール      : ${user.email}`);
  console.log(`   uid         : ${user.uid}`);
  console.log(`   作成        : ${user.metadata.creationTime}`);
  console.log(`   最終ログイン : ${user.metadata.lastSignInTime}`);

  // ★紐づくケースを、消す前に必ず出す
  const cases = await db.collection("cases").get();
  const linked: { caseId: string; partyId: string; demo: boolean; counts: string }[] = [];
  for (const c of cases.docs) {
    const parties = await c.ref.collection("parties").get();
    for (const p of parties.docs) {
      if (p.get("authUid") !== user.uid) continue;
      const [cons, props, agree] = await Promise.all([
        c.ref.collection("consultations").get(),
        c.ref.collection("proposals").get(),
        c.ref.collection("agreementItems").get(),
      ]);
      const agreed = agree.docs.filter((d) => d.get("status") === "AGREED").length;
      linked.push({
        caseId: c.id,
        partyId: p.id,
        demo: Boolean(c.get("demo")),
        counts: `相談 ${cons.size} / 提案 ${props.size} / 合意済 ${agreed}`,
      });
    }
  }

  console.log("\n── 紐づいているケース");
  if (linked.length === 0) {
    console.log("   ★ありません。消しても失われるものはありません。");
  } else {
    for (const l of linked) {
      console.log(`   ${l.caseId}  demo=${l.demo}`);
      console.log(`     当事者 ${l.partyId} / ${l.counts}`);
    }
    console.log("\n   ★ケースそのものは消しません。**紐づけが切れて、戻れなくなります。**");
  }

  if (!doDelete) {
    console.log("\n── 何もしていません（調べただけ）");
    console.log("   消すときは --delete を付けてください。");
    return;
  }

  if (linked.length > 0 && !withCases) {
    console.log("\n── 止めました");
    console.log("   ★ケースが紐づいています。データを孤児にしないため、既定では消しません。");
    console.log("   それでも消すなら --with-cases を付けてください。");
    process.exit(1);
  }

  await auth.deleteUser(user.uid);
  console.log(`\n★消しました（uid ${user.uid}）`);
  console.log(`${email} で、新しくサインアップできます。`);

  if (linked.length > 0) {
    console.log("\n★ケースは残っています。必要なら Firestore から手で消してください：");
    for (const l of linked) console.log(`   cases/${l.caseId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
