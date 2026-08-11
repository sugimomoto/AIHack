"use client";

import type { TabId } from "@/mock/types";

/** ★未読バッジ・赤ドットを実装しない（U-5 急かさない） */
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "ホーム", icon: <IconHome /> },
  { id: "chat", label: "相談", icon: <IconChat /> },
  { id: "agreement", label: "取り決め", icon: <IconDoc /> },
  { id: "schedule", label: "これから", icon: <IconCal /> },
  { id: "settings", label: "設定", icon: <IconGear /> },
];

export function BottomTab({
  active,
  onChange,
}: {
  active: TabId;
  onChange?: (t: TabId) => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-stretch"
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--surface)",
      }}
    >
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            className="flex flex-1 flex-col items-center justify-center gap-1"
            style={{
              minHeight: 56,
              color: on ? "var(--ai-text)" : "var(--text-sub)",
            }}
            aria-current={on ? "page" : undefined}
          >
            <span style={{ opacity: on ? 1 : 0.75 }}>{t.icon}</span>
            <span style={{ fontSize: "11px" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const S = { stroke: "currentColor", strokeWidth: 1.4, fill: "none" } as const;
function IconHome() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...S}>
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...S}>
      <path d="M4 5h16v11H9l-5 4V5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...S}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 10h8M8 14h5" strokeLinecap="round" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...S}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 4v4M15 4v4" strokeLinecap="round" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" strokeLinecap="round" />
    </svg>
  );
}
