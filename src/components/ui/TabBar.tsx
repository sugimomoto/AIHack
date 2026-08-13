"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * ボトムタブ
 *
 * ★設計では最初からあったのに、実装に一度も無かった。
 *   すべてを1画面に縦積みしていたため、**どこにも移動できなかった。**
 *
 * ★語の選定には理由がある（第1弾）。
 *   - 「相談」…「対話」より一人称的で、相手と話す含みがない
 *   - 「取り決め」…「合意」は成立を前提とした語。係争中の項目に使うと嘘になる
 *   - 「決まったこと」…もとは「これから」だった。
 *     中身が「これから起きること」から**「決まったことの記録」**に変わったため。
 *     「これから」のままだと**予定表だと思われる**（スコープ外にしたもの）。
 *     ★アイコンもカレンダーからチェックに変えてある。同じ理由。
 *
 * ★バッジも件数も持たない。開かせるために数を見せない。
 */
const TABS = [
  { href: "/app", label: "ホーム", icon: HomeIcon },
  { href: "/app/consult", label: "相談", icon: ConsultIcon },
  { href: "/app/agreements", label: "取り決め", icon: AgreementIcon },
  { href: "/app/upcoming", label: "決まったこと", icon: DecidedIcon },
  { href: "/app/settings", label: "設定", icon: SettingsIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0"
      style={{
        height: 78,
        paddingTop: 8,
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--surface)",
        display: "flex",
      }}
    >
      {TABS.map((t) => {
        // ★ホームだけは完全一致。前方一致にすると常に選択状態になる
        const active = t.href === "/app" ? pathname === "/app" : pathname.startsWith(t.href);
        const color = active ? "var(--ai-text)" : "var(--text-sub)";
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              paddingTop: 8,
              color,
              // ★最小 44×44
              minWidth: 44,
            }}
          >
            <t.icon color={color} />
            <span style={{ fontSize: 10.5, lineHeight: 1 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** ★アイコンは21px・線のみ。塗りつぶしも記号も使わない */
type IconProps = { color: string };
const base = (color: string) => ({
  width: 21,
  height: 21,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

function HomeIcon({ color }: IconProps) {
  return (
    <svg {...base(color)} aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function ConsultIcon({ color }: IconProps) {
  return (
    <svg {...base(color)} aria-hidden>
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AgreementIcon({ color }: IconProps) {
  return (
    <svg {...base(color)} aria-hidden>
      <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9.5 12.5l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

/** ★カレンダーではなくチェック。カレンダーのままだと予定表に見える */
function DecidedIcon({ color }: IconProps) {
  return (
    <svg {...base(color)} aria-hidden>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

function SettingsIcon({ color }: IconProps) {
  return (
    <svg {...base(color)} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
    </svg>
  );
}
