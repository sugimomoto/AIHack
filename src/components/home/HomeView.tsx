import Image from "next/image";
import type { AgreementRow, MockEvent } from "@/mock/types";

/**
 * ホーム
 *
 * ★「開いても何もしなくていい」と感じられること。
 *   取次ぎは件数を出すが、バッジではなくカードとして静かに提示する（U-5）。
 */
export function HomeView({
  events,
  rows,
}: {
  events: MockEvent[];
  rows: AgreementRow[];
}) {
  const relays = events.filter((e) => e.t === "relay");
  const decided = rows.filter((r) => r.status === "AGREED").length;

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
      <div className="flex items-start gap-3">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={44}
          height={44}
          className="rounded-full object-cover"
          style={{ width: 44, height: 44 }}
        />
        <div>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>8月11日（月）</p>
          <p className="mt-0.5" style={{ fontSize: "20px", fontWeight: 500, lineHeight: 1.6 }}>
            {relays.length > 0 ? "今日はひとつ、お預かりしています" : "今日は、お預かりはありません"}
          </p>
        </div>
      </div>

      {relays.length > 0 && (
        <div
          className="mt-5 overflow-hidden rounded-[20px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-center justify-between px-[14px] py-[11px]"
            style={{
              background: "var(--envelope-head)",
              borderBottom: "1px dashed var(--border-dashed)",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "var(--agree-text)" }}>
              ✉ お相手からのご相談
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>
              {relays.length}件
            </span>
          </div>
          <div className="px-[14px] pt-4 pb-3">
            <p style={{ fontSize: "15.5px", lineHeight: 1.95 }}>
              {relays[0].t === "relay" ? relays[0].body : ""}
            </p>
            <p className="mt-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              お返事は、急ぎません。
            </p>
          </div>
          <div
            className="px-[14px] py-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <span style={{ fontSize: "14px", color: "var(--agree-text)" }}>
              相談を開く ▸
            </span>
          </div>
        </div>
      )}

      <div
        className="mt-4 rounded-[20px] px-4 py-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: "17px", fontWeight: 500 }}>取り決め</span>
          <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            8つのうち{decided}つ
          </span>
        </div>
        <div className="mt-2.5 flex gap-1.5" aria-hidden>
          {rows.map((r, i) => (
            <span
              key={i}
              className="h-[3px] flex-1 rounded-full"
              style={{ background: r.status === "AGREED" ? "var(--agree)" : "var(--border)" }}
            />
          ))}
        </div>
        <p className="mt-3" style={{ fontSize: "13.5px", color: "var(--text-sub-2)", lineHeight: 1.85 }}>
          養育費と面会交流は決まりました。
          <br />
          親権者は、まだ話し合っていません。
        </p>
      </div>

      <div
        className="mt-4 rounded-[20px] px-4 py-4"
        style={{ background: "var(--bubble-ai)", border: "1px dashed var(--border-dashed)" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/character/capybara.png"
            alt=""
            width={38}
            height={38}
            className="rounded-full object-cover"
            style={{ width: 38, height: 38 }}
          />
          <p style={{ fontSize: "15.5px", lineHeight: 1.9 }}>
            話したいことがあれば、
            <br />
            いつでも書いてください。
          </p>
        </div>
        <div
          className="mt-3 rounded-[16px] px-[14px] py-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: "15px",
            color: "var(--text-sub)",
            minHeight: 44,
          }}
        >
          思っていることを書く
        </div>
      </div>

      <p className="mt-5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
        直近の予定は「これから」にまとめてあります。
      </p>
    </div>
  );
}
