/**
 * 手動確認用：両当事者のサインインリンクを用意する
 *
 * ★メールを送らない。Admin SDK がリンクを返すだけである。
 *   受け取った人は、リンクを開くだけでその当事者としてログインできる。
 *
 * ★リンクは1回しか使えない。作り直せば何度でも用意できる。
 *
 * 使い方:
 *   pnpm test-links                      … 新しいケースを作って2人ぶん
 *   BASE_URL=https://… pnpm test-links   … 本番に対して
 *   REUSE=<caseId> pnpm test-links       … 既存のケースのリンクを作り直す
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const BASE = process.env.BASE_URL ?? "https://aida-4n47tjpp2a-an.a.run.app";
const PROJECT = process.env.FIREBASE_PROJECT_ID || "aida-505206";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const r = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    redirect: "manual",
  });
  const sc = r.headers.get("set-cookie");
  const t = await r.text();
  let body: Json = {};
  try {
    body = JSON.parse(t) as Record<string, unknown>;
  } catch {
    body = { text: t } as Json;
  }
  return { status: r.status, body, cookie: sc ? sc.split(";")[0] : null };
}

async function signInLink(email: string): Promise<string> {
  if (!getApps().length) initializeApp({ projectId: PROJECT });
  const raw = await getAuth().generateSignInWithEmailLink(email, {
    url: `${BASE}/signin`,
    handleCodeInApp: true,
  });
  // ★アプリ側でメールアドレスを尋ねずに済むよう、クエリに載せる
  const u = new URL(raw);
  u.searchParams.set("e2eEmail", email);
  return u.toString();
}

async function main() {
  const stamp = Date.now();
  const emailA = process.env.EMAIL_A ?? `test-a-${stamp}@aida.test`;
  const emailB = process.env.EMAIL_B ?? `test-b-${stamp}@aida.test`;

  console.log(`対象: ${BASE}\n`);

  // ① 非監護親（Aさん）がケースを開始
  const start = await call("/api/cases", { method: "POST", body: { role: "NON_CUSTODIAL" } });
  if (start.status !== 200) throw new Error(`ケース作成に失敗: ${start.status}`);
  const cA = start.cookie!;
  const caseId = start.body.caseId as string;

  // ② 招待して、監護親（Bさん）が受諾
  const inv = await call("/api/invitations", {
    method: "POST",
    cookie: cA,
    body: { method: "LINK", revealSenderName: true, senderName: "太郎" },
  });
  const token = String(inv.body.url).split("/invite/")[1];
  const acc = await call(`/api/invite/${token}/accept`, { method: "POST", body: { action: "ACCEPT" } });
  const cB = acc.cookie!;

  // ③ それぞれにメールアドレスを結びつける
  for (const [cookie, email] of [
    [cA, emailA],
    [cB, emailB],
  ] as const) {
    if (!getApps().length) initializeApp({ projectId: PROJECT });
    const link = await getAuth().generateSignInWithEmailLink(email, {
      url: `${BASE}/signin`,
      handleCodeInApp: true,
    });
    const oobCode = new URL(link).searchParams.get("oobCode")!;
    const apiKey = (await (await fetch(`${BASE}/api/auth/config`)).json()).apiKey as string;
    const d = (await (
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, oobCode }),
      })
    ).json()) as { idToken?: string };
    if (!d.idToken) throw new Error(`サインインに失敗: ${email}`);
    const r = await call("/api/auth/link", { method: "POST", cookie, body: { idToken: d.idToken } });
    if (r.status !== 200) throw new Error(`結びつけに失敗: ${email} → ${r.status}`);
  }

  // ④ 手渡し用のリンクを作る（1回きり）
  console.log("─".repeat(64));
  console.log(`ケース: ${caseId}\n`);
  console.log("★それぞれ別のブラウザ（またはシークレットウィンドウ）で開いてください。\n");
  console.log(`【非監護親（Aさん）】 ${emailA}`);
  console.log(await signInLink(emailA));
  console.log(`\n【監護親（Bさん）】 ${emailB}`);
  console.log(await signInLink(emailB));
  console.log("\n" + "─".repeat(64));
  console.log("・リンクは1回だけ使えます。もう一度必要になったら、このコマンドを再実行してください。");
  console.log(`・同じケースのリンクを作り直す場合： EMAIL_A=${emailA} EMAIL_B=${emailB} pnpm test-links`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
