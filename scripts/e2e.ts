/**
 * E2E：一連の流れを、実際のAPIとLLMを通して確認する
 *
 * ★メールを送らずにメールリンク認証まで通す。
 *   Admin SDK の generateSignInWithEmailLink はリンクを**返すだけ**で、
 *   送信しない。そこから oobCode を取り出し、Identity Toolkit の
 *   REST で ID トークンに交換する。**人手を介さずに確認できる。**
 *
 * 使い方:
 *   pnpm e2e                      … localhost:3000 に対して
 *   BASE_URL=https://… pnpm e2e   … 本番に対して
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PROJECT = process.env.FIREBASE_PROJECT_ID || "aida-505206";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failed++;
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
};
const section = (t: string) => console.log(`\n${"─".repeat(58)}\n${t}`);

/** ★スクリプトなので、応答の型はゆるく扱う */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Res = { status: number; body: Json; cookie: string | null };
async function call(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string | null } = {},
): Promise<Res> {
  const r = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    redirect: "manual",
  });
  const setCookie = r.headers.get("set-cookie");
  const text = await r.text();
  let body: Json = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { text } as Json;
  }
  return { status: r.status, body, cookie: setCookie ? setCookie.split(";")[0] : null };
}

/**
 * ★メールを送らずに ID トークンを得る。
 *   generateSignInWithEmailLink はリンクを返すだけで送信しない。
 */
async function idTokenFor(email: string): Promise<string> {
  if (!getApps().length) initializeApp({ projectId: PROJECT });
  const link = await getAuth().generateSignInWithEmailLink(email, {
    url: `${BASE}/signin`,
    handleCodeInApp: true,
  });
  const oobCode = new URL(link).searchParams.get("oobCode");
  if (!oobCode) throw new Error("oobCode を取り出せませんでした");

  const apiKey = (await (await fetch(`${BASE}/api/auth/config`)).json()).apiKey as string;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, oobCode }),
    },
  );
  const d = (await r.json()) as { idToken?: string; error?: { message?: string } };
  if (!d.idToken) throw new Error(`サインインに失敗: ${d.error?.message ?? JSON.stringify(d)}`);
  return d.idToken;
}

const stamp = Date.now();
const EMAIL_A = `e2e-a-${stamp}@example.test`;
const EMAIL_B = `e2e-b-${stamp}@example.test`;

async function main() {
  console.log(`E2E: ${BASE}`);

  // ─────────────────────────────────────────────
  section("① オンボーディング（I-1 → I-2 → I-3 → I-4）");
  const start = await call("/api/cases", {
    method: "POST",
    body: { situation: "DIVORCED_NO_TERMS" },
  });
  ok("ケースが作られる", start.status === 200);
  ok("セッションが発行される", Boolean(start.cookie));
  const cA = start.cookie!;
  const caseId = start.body.caseId as string;

  // ★I-2 同居。役割はここでだけ決まる
  const livingBad = await call(`/api/cases/${caseId}/living`, {
    method: "POST",
    cookie: cA,
    body: { living: "SOMETIMES" },
  });
  ok("★知らない答えは受け付けない", livingBad.status === 400);

  const varies = await call(`/api/cases/${caseId}/living`, {
    method: "POST",
    cookie: cA,
    body: { living: "VARIES" },
  });
  ok("★お子さんによって違う場合、役割を決めない", varies.body.roleConfirmed === false);

  const living = await call(`/api/cases/${caseId}/living`, {
    method: "POST",
    cookie: cA,
    body: { living: "APART" },
  });
  ok("同居の答えから役割が決まる", living.body.roleConfirmed === true);

  // ★I-3 お子さん。算定表は人数と年齢で表を選ぶ
  const tooMany = await call(`/api/cases/${caseId}/children`, {
    method: "POST",
    cookie: cA,
    body: { children: [1, 2, 3, 4].map((i) => ({ birthDate: `201${i}-04-01` })) },
  });
  ok("★4人以上は受け付けない（算定表が公表されていない）", tooMany.status === 400);

  const kids = await call(`/api/cases/${caseId}/children`, {
    method: "POST",
    cookie: cA,
    body: { children: [{ birthDate: "2009-08-01" }, { birthDate: "2015-04-01" }] },
  });
  ok("お子さんを登録できる", kids.status === 200 && kids.body.count === 2);

  // ★I-4 年収。飛ばせる画面だが、目安を出すには要る
  const income = await call("/api/profile", {
    method: "POST",
    cookie: cA,
    body: { annualIncomeYen: 4_380_000 },
  });
  ok("年収を登録できる", income.status === 200);

  // ─────────────────────────────────────────────
  section("② 招待する");
  const noAuth = await call("/api/invitations", { method: "POST", body: { method: "LINK" } });
  ok("★未認証では招待を作れない", noAuth.status === 401);

  const inv = await call("/api/invitations", {
    method: "POST",
    cookie: cA,
    body: { method: "LINK", revealSenderName: true, senderName: "太郎" },
  });
  ok("招待が発行される", inv.status === 200);
  const token = String(inv.body.url).split("/invite/")[1];

  const pub = await call(`/api/invite/${token}`);
  ok("公開ビューが開く", pub.status === 200 && pub.body.state === "OPEN");
  ok("★内部の識別子が漏れない", !JSON.stringify(pub.body).includes(caseId));

  // ─────────────────────────────────────────────
  section("③ 相手が受諾する");
  const accept = await call(`/api/invite/${token}/accept`, {
    method: "POST",
    body: { action: "ACCEPT" },
  });
  ok("受諾できる", accept.status === 200);
  ok("セッションが発行される", Boolean(accept.cookie));
  const cB = accept.cookie!;

  const sA = await call("/api/session", { cookie: cA });
  const sB = await call("/api/session", { cookie: cB });
  ok("同じケースの当事者になる", sA.body.caseId === sB.body.caseId);
  ok("★別の当事者である", sA.body.partyId !== sB.body.partyId);

  // ★H-1：受諾した側にうかがうのは、お子さんの確認1枚だけ。
  //   名前は返さない（共有しない情報である）
  const kidsB = await call(`/api/cases/${caseId}/view`, { cookie: cB });
  ok("★受諾した側にお子さんの呼び名が渡らない", !JSON.stringify(kidsB.body).includes("name"));

  // ★年収は受諾直後に聞かない。必要になった時点で対話の中でうかがう（H-2）
  const incomeB = await call("/api/profile", {
    method: "POST",
    cookie: cB,
    body: { annualIncomeYen: 2_100_000 },
  });
  ok("受諾した側も年収を登録できる", incomeB.status === 200);

  // ─────────────────────────────────────────────
  section("④ ★C1：書いた言葉が相手に届かない");
  const RAW = "月3万が限界。こっちだって仕事切られて必死なんだよ。少しは考えろ";
  const post = await call(`/api/cases/${caseId}/messages`, {
    method: "POST",
    cookie: cA,
    body: { text: RAW },
  });
  ok("投稿できる", post.status === 200);
  console.log(`     受け止め: ${String(post.body.reply).slice(0, 40)}…`);
  console.log(`     取次ぎ  : ${String(post.body.relayed ?? "（届かず）").split("\n")[0]}`);

  const viewB = await call(`/api/cases/${caseId}/view`, { cookie: cB });
  const vb = JSON.stringify(viewB.body);
  ok("★相手の画面に原文が無い", !vb.includes("必死") && !vb.includes("少しは考えろ"));
  ok("★受け止めの応答も無い", !vb.includes(String(post.body.reply).slice(0, 15)));
  ok("取次ぎは届いている", (viewB.body.inbound?.length ?? 0) > 0);

  const ctx = await call(`/api/cases/${caseId}/context`, { cookie: cB });
  ok("★AIに渡すものにも原文が無い", !JSON.stringify(ctx.body).includes("必死"));

  // ─────────────────────────────────────────────
  section("⑤ ★メールリンクで登録し、別の端末から戻る");
  const linkNoAuth = await call("/api/auth/link", { method: "POST", body: { idToken: "forged" } });
  ok("★セッション無しでは結びつけられない", linkNoAuth.status === 401);

  const forged = await call("/api/auth/link", {
    method: "POST",
    cookie: cA,
    body: { idToken: "forged.token" },
  });
  ok("★偽のトークンは通らない", forged.status === 401);

  const tokenA = await idTokenFor(EMAIL_A);
  const link = await call("/api/auth/link", { method: "POST", cookie: cA, body: { idToken: tokenA } });
  ok("メールアドレスを登録できる", link.status === 200);

  const unknown = await idTokenFor(`e2e-unknown-${stamp}@example.test`);
  const bad = await call("/api/auth/signin", { method: "POST", body: { idToken: unknown } });
  ok("★未登録のアカウントでは戻れない", bad.status === 404);

  // ★Cookie を持たない＝別の端末から
  const again = await idTokenFor(EMAIL_A);
  const back = await call("/api/auth/signin", { method: "POST", body: { idToken: again } });
  ok("★別の端末から戻れる", back.status === 200 && Boolean(back.cookie));
  const cA2 = back.cookie!;
  const sA2 = await call("/api/session", { cookie: cA2 });
  ok("★同じ当事者に戻る", sA2.body.partyId === sA.body.partyId);

  // 相手も登録して、付け替えができないことを確かめる
  const tokenB = await idTokenFor(EMAIL_B);
  await call("/api/auth/link", { method: "POST", cookie: cB, body: { idToken: tokenB } });
  const steal = await call("/api/auth/link", { method: "POST", cookie: cA2, body: { idToken: tokenB } });
  ok("★別のアカウントに付け替えられない", steal.status === 409);

  // ─────────────────────────────────────────────
  section("⑥ 合意形成");
  for (const [cookie, text] of [
    [cA2, "養育費は月3万円、毎月25日、20歳までにしたい"],
    [cB, "養育費は月3万円、毎月25日、20歳までにしたい"],
  ] as const) {
    await call(`/api/cases/${caseId}/messages`, { method: "POST", cookie, body: { text } });
  }
  const ag = await call(`/api/cases/${caseId}/agreement?topic=CHILD_SUPPORT`, { cookie: cA2 });
  ok("合意の状況が取れる", ag.status === 200);
  console.log(`     ready=${ag.body.ready} converged=${ag.body.converged} state=${ag.body.state}`);
  if (ag.body.draft?.rangeText) console.log(`     算定表: ${String(ag.body.draft.rangeText).split("\n")[0]}`);

  // ─────────────────────────────────────────────
  section("⑦ ★N-1／K-6：成立と、そのあとの変更");
  for (const cookie of [cA2, cB]) {
    await call(`/api/cases/${caseId}/agreement`, {
      method: "POST",
      cookie,
      body: { topic: "CHILD_SUPPORT", status: "ACCEPTED" },
    });
  }
  const agreed = await call(`/api/cases/${caseId}/agreement?topic=CHILD_SUPPORT`, { cookie: cA2 });
  ok("★合意が成立する", agreed.body.state === "AGREED" && agreed.body.agreement !== null);

  // ★自由記述を送りつけても、越えない
  const reqRev = await call(`/api/cases/${caseId}/revision`, {
    method: "POST",
    cookie: cA2,
    body: {
      topic: "CHILD_SUPPORT",
      change: { payDay: "DAY_10" },
      reasonCode: "土曜に出勤しろと急に言われて、もう本当にどうにもならない",
    },
  });
  ok("変更を申し出られる", reqRev.status === 200);

  const raw = await call(`/api/cases/${caseId}/revision?topic=CHILD_SUPPORT`, { cookie: cB });
  ok("★一覧に無い背景は渡らない", raw.body.reason === null);

  // ★選ばれたカテゴリは、定型の伝聞文になって渡る
  await call(`/api/cases/${caseId}/revision`, {
    method: "POST",
    cookie: cA2,
    body: {
      topic: "CHILD_SUPPORT",
      change: { payDay: "DAY_10" },
      reasonCode: "SCHEDULE_CONSTRAINT",
    },
  });

  const seen = await call(`/api/cases/${caseId}/revision?topic=CHILD_SUPPORT`, { cookie: cB });
  ok("★相手に申し出が届く", seen.body.isOwn === false);
  ok("★申し出た本人には、自分の申し出と分かる", (
    await call(`/api/cases/${caseId}/revision?topic=CHILD_SUPPORT`, { cookie: cA2 })
  ).body.isOwn === true);
  ok("★背景は伝聞形で渡る", String(seen.body.reason ?? "").endsWith("とのことです。"));
  ok("★何が変わらないかが言葉になっている", String(seen.body.description?.sentence).length > 0);

  // ★お返事があるまで、いまの取り決めが続く
  const during = await call(`/api/cases/${caseId}/document`, { cookie: cB });
  ok("★変更申請中でも、いまの取り決めが書面に残る", during.status === 200);

  const keep = await call(`/api/cases/${caseId}/revision`, {
    method: "POST",
    cookie: cB,
    body: { topic: "CHILD_SUPPORT", action: "KEEP" },
  });
  ok("★「いまのままにしたい」で合意済に戻る", keep.body.status === "AGREED");

  const after = await call(`/api/cases/${caseId}/agreement?topic=CHILD_SUPPORT`, { cookie: cB });
  ok("★断っても、いまの取り決めを失わない", after.body.agreement !== null);

  // ─────────────────────────────────────────────
  section("⑧ 安全・運用");
  const metricsNoAuth = await call("/api/metrics");
  ok("★原価は未認証で見られない", metricsNoAuth.status === 401);
  const safety = await call("/api/safety");
  ok("★安全の記録は運営トークン無しで見られない", safety.status === 403);

  const m = await call("/api/metrics", { cookie: cA2 });
  if (m.status === 200) {
    console.log(
      `     ${m.body.calls}回 / CT-1 ${m.body.perMessageJpy?.toFixed(2)}円 / CT-4 ${
        m.body.reductionRate !== null ? (m.body.reductionRate * 100).toFixed(1) + "%" : "—"
      }`,
    );
  }

  // ─────────────────────────────────────────────
  console.log(`\n${"─".repeat(58)}`);
  console.log(failed === 0 ? "★すべて通りました" : `✗ ${failed}件が失敗しました`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\n✗ E2E が中断しました:", e instanceof Error ? e.message : e);
  process.exit(1);
});
