/**
 * 手動確認用：継続的に使えるリンクを作る
 *
 * ★このリンクは、期限まで何度でも使える。
 *   持っている人はその当事者になれるため、**確認用と印を付けたケースにしか効かない。**
 *
 * 使い方:
 *   pnpm demo-links                        … 新しい確認用ケースを作る
 *   BASE_URL=https://… pnpm demo-links
 *   DAYS=14 pnpm demo-links                … 期限を指定（既定7日）
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { signDemoLink } from "../src/domain/session/demoLink";

const BASE = process.env.BASE_URL ?? "https://aida-4n47tjpp2a-an.a.run.app";
const DAYS = Number(process.env.DAYS ?? 7);
const KEY = process.env.DEMO_LINK_SECRET ?? "";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const r = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    redirect: "manual",
  });
  const sc = r.headers.get("set-cookie");
  let body: Json = {};
  try {
    body = (await r.json()) as Json;
  } catch {
    /* 本文が無い応答 */
  }
  return { status: r.status, body, cookie: sc ? sc.split(";")[0] : null };
}

async function main() {
  if (!KEY) throw new Error("DEMO_LINK_SECRET が設定されていません");
  console.log(`対象: ${BASE}\n`);

  const start = await call("/api/cases", {
    method: "POST",
    body: { situation: "DIVORCED_NO_TERMS" },
  });
  if (start.status !== 200) throw new Error(`ケース作成に失敗: ${start.status}`);
  const caseId = start.body.caseId as string;
  const cookieA = start.cookie!;

  // ★オンボーディングを通す。
  //   これが無いと算定表に届かず、確認する側が「目安が出ない」ところで止まる。
  //   役割は同居からしか決まらない（I-2）。
  await call(`/api/cases/${caseId}/living`, {
    method: "POST",
    cookie: cookieA,
    body: { living: "APART" }, // → 作成者は非監護親
  });
  await call(`/api/cases/${caseId}/children`, {
    method: "POST",
    cookie: cookieA,
    body: { children: [{ birthDate: "2015-04-01" }, { birthDate: "2009-08-01" }] },
  });
  await call("/api/profile", {
    method: "POST",
    cookie: cookieA,
    body: { annualIncomeYen: 4_380_000 },
  });

  const inv = await call("/api/invitations", {
    method: "POST",
    cookie: cookieA,
    body: { method: "LINK", revealSenderName: true, senderName: "太郎" },
  });
  const token = String(inv.body.url).split("/invite/")[1];
  const accepted = await call(`/api/invite/${token}/accept`, {
    method: "POST",
    body: { action: "ACCEPT" },
  });

  // ★受諾した側の年収は、オンボーディングでは聞かない（H-2）。
  //   確認用のケースでは、算定表まで見えるように入れておく。
  if (accepted.cookie) {
    await call("/api/profile", {
      method: "POST",
      cookie: accepted.cookie,
      body: { annualIncomeYen: 2_100_000 },
    });
  }

  // ★確認用の印を付ける。これが無いとリンクは効かない
  if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "aida-505206" });
  const db = getFirestore();
  await db.collection("cases").doc(caseId).set({ demo: true }, { merge: true });

  const parties = await db.collection("cases").doc(caseId).collection("parties").get();
  const rows = parties.docs.map((d) => ({ id: d.id, role: d.get("role") as string }));

  const now = Date.now();
  const link = (partyId: string) =>
    `${BASE}/api/demo-session?t=${encodeURIComponent(signDemoLink({ partyId, caseId }, { key: KEY, now, days: DAYS }))}`;

  console.log("─".repeat(64));
  console.log(`ケース: ${caseId}（確認用）  期限: ${DAYS}日\n`);
  console.log("★それぞれ別のブラウザ（またはシークレットウィンドウ）で開いてください。");
  console.log("★期限まで何度でも使えます。\n");
  for (const p of rows) {
    console.log(`【${p.role === "NON_CUSTODIAL" ? "非監護親（Aさん）" : "監護親（Bさん）"}】`);
    console.log(link(p.id));
    console.log();
  }
  console.log("─".repeat(64));
  console.log("・確認用と印を付けたケースにしか効きません。実在のケースには入れません。");
  console.log("・期限が切れたら、このコマンドを再実行してください。");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
