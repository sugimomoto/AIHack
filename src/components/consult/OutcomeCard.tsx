import { OUTCOME_HEADING, OUTCOME_NOTE, type Outcome } from "@/domain/agreement/outcome";

/**
 * この相談で決まること
 *
 * ★対話の最初に置く。**何が決まるのか分からないまま書かせない。**
 * ★必ず決めるものと、そうでないものを見分けられるようにする。
 * ★急かさない。「すべてを決める必要はありません」を必ず添える。
 */
export function OutcomeCard({ outcomes }: { outcomes: Outcome[] }) {
  if (outcomes.length === 0) return null;
  return (
    <div
      className="shrink-0 px-4 pt-3"
      style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}
    >
      <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>{OUTCOME_HEADING}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {outcomes.map((o) => (
          <span
            key={o.key}
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: "var(--r-full)",
              background: o.required ? "var(--agree-bg)" : "var(--surface-2)",
              border: `1px solid ${o.required ? "var(--agree)" : "var(--border)"}`,
              color: o.required ? "var(--agree-text)" : "var(--text-sub)",
            }}
          >
            {o.label}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)", marginTop: 8 }}>
        {OUTCOME_NOTE}
      </p>
    </div>
  );
}
