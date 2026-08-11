import type { AgreementStatus } from "@/mock/types";

/**
 * 合意ステータス
 *
 * ★色だけに頼らない。アイコン ＋ 枠線スタイル ＋ 色 の3信号で区別する。
 *   色を落としても判別できること（色覚特性への配慮）。
 *
 * ★「逸脱」を責める表現にしない。赤は使わない。
 */
const STYLE: Record<
  AgreementStatus,
  { label: string; mark: string; fg: string; bg: string; bd: string; dashed?: boolean }
> = {
  AGREED: { label: "合意済", mark: "✓", fg: "var(--agree-text)", bg: "var(--agree-bg)", bd: "var(--agree)" },
  IN_NEGOTIATION: { label: "係争中", mark: "△", fg: "var(--attention-text)", bg: "var(--attention-bg)", bd: "var(--attention)" },
  NOT_STARTED: { label: "未着手", mark: "○", fg: "var(--text-sub)", bg: "transparent", bd: "var(--muted)", dashed: true },
  REVISION_REQUESTED: { label: "変更申請中", mark: "⇄", fg: "var(--ai-text)", bg: "var(--surface-2)", bd: "var(--ai)" },
  DEVIATED: { label: "逸脱", mark: "!", fg: "var(--attention-text)", bg: "var(--attention-bg)", bd: "var(--attention)", dashed: true },
  ESCALATED: { label: "調停へ", mark: "→", fg: "var(--text-sub)", bg: "var(--muted-bg)", bd: "var(--muted)" },
  PLANNED: { label: "今後対応", mark: "", fg: "var(--text-sub)", bg: "transparent", bd: "transparent" },
};

export function StatusChip({ status }: { status: AgreementStatus }) {
  const s = STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-1.5"
      style={{
        color: s.fg,
        background: s.bg,
        border: `1px ${s.dashed ? "dashed" : "solid"} ${s.bd}`,
        fontSize: "12.5px",
      }}
    >
      {s.mark && <span aria-hidden>{s.mark}</span>}
      {s.label}
    </span>
  );
}
