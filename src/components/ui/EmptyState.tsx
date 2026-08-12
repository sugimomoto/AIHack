import Image from "next/image";
import type { ReactNode } from "react";
import { EMPTY_CONSULT, EMPTY_UPCOMING } from "@/domain/ui/emptyState";

/**
 * 空の状態（L-1〜L-3）
 *
 * ★空を「まだ何もしていない状態」として書かない。
 * ★イラストで空白を埋めない。カピバラを大きく置くと、慰められている感じが出る。
 * ★急かす言葉・達成率・次にすべきことの提示を置かない。
 */

/** 破線の枠。カピバラは小さく、添えるだけ */
function DashedCard({ children, capybara = 40 }: { children: ReactNode; capybara?: number }) {
  return (
    <div
      style={{
        background: "var(--bubble-ai)",
        border: "1px dashed #DCC7A6",
        borderRadius: 20,
        padding: 18,
      }}
    >
      <div className="flex items-start gap-3">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={capybara}
          height={capybara}
          className="rounded-full object-cover"
          style={{ width: capybara, height: capybara, flexShrink: 0 }}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * L-3 これからが空
 *
 * ★カレンダーに見えるが、**本人が予定を入れる場所ではない。**
 */
export function EmptyUpcoming() {
  return (
    <div className="px-5 pt-6">
      <p style={{ fontSize: 15, lineHeight: 1.8 }}>{EMPTY_UPCOMING.heading}</p>
      <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
        {EMPTY_UPCOMING.body}
      </p>

      <div
        className="mt-4"
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>入るものの例</p>
        <ul style={{ fontSize: 13, lineHeight: 2.05, color: "var(--text-sub)", marginTop: 4 }}>
          {EMPTY_UPCOMING.examples.map((e) => (
            <li key={e}>・{e}</li>
          ))}
        </ul>
      </div>

      {/* ★支払日が並ぶ画面は督促のように働きうる */}
      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 14 }}>
        {EMPTY_UPCOMING.note}
      </p>
    </div>
  );
}

/**
 * L-1 相談が空
 *
 * ★「お相手には届きません」を、**書く前に見える位置**に置く。
 *   1件目を書くときがいちばん怖い瞬間なので、約束は書いたあとでは遅い。
 */
export function EmptyConsult() {
  return (
    <div className="px-4 py-6">
      <DashedCard>
        <p style={{ fontSize: 15, lineHeight: 1.8 }}>{EMPTY_CONSULT.lead}</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
          {EMPTY_CONSULT.promise}
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 4 }}>
          {EMPTY_CONSULT.relax}
        </p>
      </DashedCard>
    </div>
  );
}
