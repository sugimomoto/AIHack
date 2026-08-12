import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { computeMetrics } from "@/services/metrics";

/**
 * 原価の可視化（CT-1〜CT-4）
 *
 * ★CT-4 は実測値である。保存されたログのトークン数に LARGE の単価を
 *   掛け直して算出している。「削減した」を推測で言わない。
 */
export const dynamic = "force-dynamic";

const jpy = (n: number) => `${n.toFixed(4)}円`;

/** ★設計を変える前のログが混ざると、CT-4 が実態を表さない */
const SINCE = process.env.METRICS_SINCE || undefined;

export default async function Page() {
  const m = await computeMetrics({ since: SINCE }).catch(() => null);

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>原価</h1>
        {!m && <p style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 12 }}>読み込めませんでした。</p>}
        {m && (
          <>
            {m.since && <Row label="集計期間" value={`${m.since} 以降`} />}
            <Row label="呼び出し" value={`${m.calls}回`} />
            <Row label="入力／出力トークン" value={`${m.inputTokens.toLocaleString()} / ${m.outputTokens.toLocaleString()}`} />
            <Row label="合計" value={jpy(m.totalJpy)} />
            <Row label="CT-1 メッセージ単価" value={m.perMessageJpy === null ? "—" : jpy(m.perMessageJpy)} />

            <div
              className="mt-4"
              style={{
                background: "var(--agree-bg)",
                border: "1px solid var(--agree)",
                borderRadius: "var(--r-md)",
                padding: 14,
              }}
            >
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agree-text)" }}>
                CT-4｜ルーティングなしとの比較
              </p>
              <p style={{ fontSize: 12.5, lineHeight: 1.95, marginTop: 6 }}>
                実際 {jpy(m.totalJpy)} ／ 全部 LARGE なら {m.asLargeJpy === null ? "—" : jpy(m.asLargeJpy)}
              </p>
              <p style={{ fontSize: 20, fontWeight: 600, color: "var(--agree-text)", marginTop: 4 }}>
                {m.reductionRate === null ? "—" : `${(m.reductionRate * 100).toFixed(1)}% 削減`}
              </p>
              <p style={{ fontSize: 11, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 6 }}>
                保存されたログのトークン数に、LARGE の単価を掛け直して算出しています。推測値ではありません。
              </p>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 20 }}>階層別</p>
            {Object.entries(m.byTier).map(([k, v]) => (
              <Row key={k} label={k} value={`${v.calls}回 ／ ${jpy(v.jpy)}`} />
            ))}
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 16 }}>用途別</p>
            {Object.entries(m.byPurpose).map(([k, v]) => (
              <Row key={k} label={k} value={`${v.calls}回 ／ ${jpy(v.jpy)}`} />
            ))}
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3"
      style={{ padding: "9px 0", borderTop: "1px solid var(--border-subtle)" }}
    >
      <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{label}</span>
      <span style={{ fontSize: 13.5 }}>{value}</span>
    </div>
  );
}
