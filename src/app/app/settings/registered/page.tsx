import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/session";
import { asCaseId, asPartyId } from "@/domain/case/types";
import {
  loadChildBirthDates,
  loadForLlm,
  loadLiving,
  loadSituation,
} from "@/infra-adapters/firestore/repositories/caseRepository";
import { LIVING_LABEL, parseLiving } from "@/domain/case/living";
import { SITUATION_LABEL, parseSituation } from "@/domain/case/situation";

export const dynamic = "force-dynamic";

/**
 * K-3 設定 ＞ 登録した内容
 *
 * ★オンボーディングで4種類お預かりしているのに、あとから見る画面が無かった。
 *
 * ★お相手の年収も同じ画面に置く。
 *   自分の値だけが見えていると「相手には自分の額が見えているのでは」という疑いが残る。
 *   **幅だけが並んでいることで、対称性がその場で分かる。**
 */
function bandLabel(b: string | null): string {
  return b ? `${b.replace("-", "〜")}万円` : "まだ入力されていません";
}

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  const caseId = asCaseId(s.caseId);
  const [snap, situationRaw, livingRaw, births] = await Promise.all([
    loadForLlm(caseId).catch(() => null),
    loadSituation(caseId).catch(() => null),
    loadLiving(caseId).catch(() => null),
    loadChildBirthDates(caseId).catch(() => [] as string[]),
  ]);

  const me = snap?.parties.find((p) => p.id === asPartyId(s.partyId)) ?? null;
  const other = snap?.parties.find((p) => p.id !== asPartyId(s.partyId)) ?? null;
  const situation = parseSituation(situationRaw);
  const living = parseLiving(livingRaw);

  const rows: { label: string; value: string; href?: string; note?: string }[] = [
    {
      label: "いまの状況",
      value: situation ? SITUATION_LABEL[situation] : "まだ選ばれていません",
      href: "/start",
    },
    { label: "同居", value: living ? LIVING_LABEL[living] : "まだ答えていません", href: "/onboarding/living" },
    {
      label: "お子さん",
      value: births.length > 0 ? `${births.length}人` : "まだ登録されていません",
      href: "/app/settings/children",
    },
    {
      label: "ご自身の年収",
      value: bandLabel(me?.incomeBand ?? null),
      href: "/onboarding/profile?from=home",
      note: me?.incomeBand ? `お相手に見えるのは ${bandLabel(me.incomeBand)}` : undefined,
    },
    {
      // ★表示のみ。幅だけが並ぶことで対称性が分かる
      label: "お相手の年収",
      value: bandLabel(other?.incomeBand ?? null),
      note: "お相手が入力された幅です。こちらから直すことはできません。",
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <Link href="/app/settings" style={{ fontSize: 13, color: "var(--text-sub)" }}>
        ‹ 設定
      </Link>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 10 }}>登録した内容</h1>

      <div
        className="mt-4 overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              padding: "14px 16px",
              borderTop: i === 0 ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p style={{ fontSize: 11.5, color: "var(--text-sub)" }}>{r.label}</p>
                <p style={{ fontSize: 15, marginTop: 2 }}>{r.value}</p>
              </div>
              {r.href && (
                <Link href={r.href} style={{ fontSize: 12.5, color: "var(--agree-text)" }}>
                  直す
                </Link>
              )}
            </div>
            {r.note && (
              <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 6 }}>
                {r.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ★何を直すと相手に伝わるのかを、先に書く */}
      <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--muted)", marginTop: 16 }}>
        お子さんのこと以外は、直してもお相手にお知らせしません。
      </p>
    </div>
  );
}
