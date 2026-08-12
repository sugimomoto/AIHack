import type { ReactNode } from "react";

/** 端末の枠。モックと本実装で寸法をそろえる */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-0 sm:p-6"
      style={{ background: "var(--surface-2)" }}
    >
      <div
        // ★ボトムシート（K-6）はこの枠の中に収める。端末の外にはみ出させない
        className="relative flex w-full flex-col overflow-hidden sm:w-[390px]"
        style={{
          background: "var(--bg)",
          height: "min(844px, 100dvh)",
          borderRadius: "var(--r-device)",
          border: "1px solid var(--border-strong)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
