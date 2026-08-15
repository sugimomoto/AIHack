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
 * ★`--aliases` を付けると、エイリアス（`name+xxx@…`）もまとめて対象にする。
 *   Firebase は `a@x` と `a+1@x` を**別のユーザー**として扱うため、
 *   試すたびに増える。まとめて片づけられるようにしておく。
 *
 * 使い方:
 *   npx tsx scripts/delete-auth-user.ts <email>                      … 調べるだけ
 *   npx tsx scripts/delete-auth-user.ts <email> --aliases            … エイリアスも調べる
 *   npx tsx scripts/delete-auth-user.ts <email> --aliases --delete   … 消す
 *   … --delete --with-cases   … 紐づくケースがあっても消す（★ケースは残る。孤児になる）
 */
import { getDb } from "../src/infra-adapters/firestore/client";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];
const doDelete = process.argv.includes("--delete");
const withCases = process.argv.includes("--with-cases");
const withAliases = process.argv.includes("--aliases");

/**
 * 同じ受信箱に届くアドレスか。
 *
 * ★Gmail は **ドットを無視し、`+` 以降も無視する。**
 *   `s.example+1@gmail.com` は `sexample@gmail.com` と同じ人に届く。
 *
 * ★だが **Firebase は別のユーザーとして扱う。**
 *   試すたびに増えるうえ、**打ち間違いが別アカウントになる**（実際に3件増えた）。
 *
 * ★ドットを無視してよいのは Gmail だけである。**他のドメインで同じことをしない。**
 */
const GMAIL = new Set(["gmail.com", "googlemail.com"]);

function normalize(addr: string): string {
  const [local, domain] = addr.toLowerCase().split("@");
  if (!domain) return addr.toLowerCase();
  const base = local.split("+")[0];
  return `${GMAIL.has(domain) ? base.replace(/\./g, "") : base}@${domain}`;
}

function matchesBase(base: string, candidate: string): boolean {
  return normalize(base) === normalize(candidate);
}

/** ★対象のユーザーを集める。エイリアスは全件走査でしか引けない */
async function targets(auth: ReturnType<typeof getAuth>) {
  if (!withAliases) {
    try {
      return [await auth.getUserByEmail(email)];
    } catch {
      return [];
    }
  }
  const found: Awaited<ReturnType<typeof auth.getUserByEmail>>[] = [];
  let page: string | undefined;
  do {
    const r = await auth.listUsers(1000, page);
    for (const u of r.users) {
      if (u.email && matchesBase(email, u.email)) found.push(u);
    }
    page = r.pageToken;
  } while (page);
  return found;
}

async function main() {
  if (!email || !email.includes("@")) {
    console.error(
      "使い方: npx tsx scripts/delete-auth-user.ts <email> [--aliases] [--delete] [--with-cases]",
    );
    process.exit(1);
  }

  const db = getDb();
  const auth = getAuth();

  const users = await targets(auth);
  if (users.length === 0) {
    console.log(`\n${email}${withAliases ? "（エイリアスを含む）" : ""} のユーザーはいません。`);
    console.log("そのまま新しくサインアップできます。");
    return;
  }

  console.log(`\n── 対象 ${users.length}件${withAliases ? "（エイリアスを含む）" : ""}`);

  // ★紐づくケースを、消す前に必ず全部出す
  const cases = await db.collection("cases").get();
  const byUid = new Map<string, { caseId: string; partyId: string; demo: boolean; counts: string }[]>();

  for (const c of cases.docs) {
    const parties = await c.ref.collection("parties").get();
    for (const p of parties.docs) {
      const uid = p.get("authUid") as string | null;
      if (!uid || !users.some((u) => u.uid === uid)) continue;
      const [cons, props, agree] = await Promise.all([
        c.ref.collection("consultations").get(),
        c.ref.collection("proposals").get(),
        c.ref.collection("agreementItems").get(),
      ]);
      const agreed = agree.docs.filter((d) => d.get("status") === "AGREED").length;
      byUid.set(uid, [
        ...(byUid.get(uid) ?? []),
        {
          caseId: c.id,
          partyId: p.id,
          demo: Boolean(c.get("demo")),
          counts: `相談 ${cons.size} / 提案 ${props.size} / 合意済 ${agreed}`,
        },
      ]);
    }
  }

  let anyLinked = 0;
  for (const u of users) {
    const linked = byUid.get(u.uid) ?? [];
    anyLinked += linked.length;
    console.log(`\n   ${u.email}`);
    console.log(`     uid  ${u.uid}`);
    console.log(`     作成 ${u.metadata.creationTime}`);
    if (linked.length === 0) {
      console.log("     ★紐づくケースなし。消しても失われるものはありません");
    } else {
      for (const l of linked) {
        console.log(`     ★ケース ${l.caseId}  demo=${l.demo}  ${l.counts}`);
      }
    }
  }

  if (anyLinked > 0) {
    console.log("\n   ★ケースそのものは消しません。**紐づけが切れて、戻れなくなります。**");
  }

  if (!doDelete) {
    console.log("\n── 何もしていません（調べただけ）");
    console.log("   消すときは --delete を付けてください。");
    return;
  }

  if (anyLinked > 0 && !withCases) {
    console.log("\n── 止めました");
    console.log("   ★ケースが紐づいています。データを孤児にしないため、既定では消しません。");
    console.log("   それでも消すなら --with-cases を付けてください。");
    process.exit(1);
  }

  for (const u of users) {
    await auth.deleteUser(u.uid);
    console.log(`★消しました  ${u.email}  (${u.uid})`);
  }
  console.log(`\n${users.length}件を消しました。同じアドレスで、新しくサインアップできます。`);

  if (anyLinked > 0) {
    console.log("\n★ケースは残っています。必要なら Firestore から手で消してください。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
