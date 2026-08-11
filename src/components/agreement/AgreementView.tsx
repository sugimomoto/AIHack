import type { AgreementRow } from "@/mock/types";
import { StatusChip } from "./StatusChip";

export function AgreementView({ rows }: { rows: AgreementRow[] }) {
  const decided = rows.filter((r) => r.status === "AGREED").length;
  const active = rows.filter((r) => r.status !== "PLANNED");
  const planned = rows.filter((r) => r.status === "PLANNED");

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
      <h1 style={{ fontSize: "24px", fontWeight: 500, lineHeight: 1.5 }}>
        取り決めの状況
      </h1>
      <p className="mt-1" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
        8つのうち、{decided}つが決まりました
      </p>

      <div className="mt-3 flex gap-1.5" aria-hidden>
        {rows.map((r, i) => (
          <span
            key={i}
            className="h-[3px] flex-1 rounded-full"
            style={{
              background: r.status === "AGREED" ? "var(--agree)" : "var(--border)",
            }}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {active.map((r) => (
          <div
            key={r.topic}
            className="rounded-[20px] px-4 py-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <span style={{ fontSize: "17px", fontWeight: 500 }}>{r.label}</span>
              <StatusChip status={r.status} />
            </div>
            {r.detail && (
              <p className="mt-1.5" style={{ fontSize: "13.5px", color: "var(--text-sub)" }}>
                {r.detail}
              </p>
            )}
            {r.exception && (
              <p
                className="mt-2 rounded-[11px] px-3 py-2"
                style={{
                  background: "var(--surface-2)",
                  fontSize: "12.5px",
                  color: "var(--text-sub-2)",
                }}
              >
                {r.exception}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
        今後対応する項目
      </p>
      <div className="rounded-[20px] px-4" style={{ background: "var(--surface-2)" }}>
        {planned.map((r, i) => (
          <div
            key={r.topic}
            className="py-3.5"
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
              fontSize: "15px",
              color: "var(--text-sub-2)",
            }}
          >
            {r.label}
          </div>
        ))}
      </div>

      <div
        className="mt-5 rounded-[20px] px-4 py-5 text-center"
        style={{ background: "var(--surface-2)", color: "var(--text-sub)" }}
      >
        <p style={{ fontSize: "16px" }}>公正証書の原案を見る</p>
        <p className="mt-1" style={{ fontSize: "12.5px" }}>
          すべての項目が決まると開けます
        </p>
      </div>
    </div>
  );
}
