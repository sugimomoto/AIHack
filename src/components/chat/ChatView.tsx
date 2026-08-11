import type { MockEvent } from "@/mock/types";
import { AiMessage } from "./AiMessage";
import { ChoiceChips } from "./ChoiceChips";
import { Composer } from "./Composer";
import { OwnMessage } from "./OwnMessage";
import { RelayMessage } from "./RelayMessage";

/**
 * 相談（対話）画面
 *
 * ★必ず「AI と 1 対 1 で話している」画面に見えること。
 *   相手とチャットしている印象を与えたら失敗。
 */
export function ChatView({
  events,
  title,
}: {
  events: MockEvent[];
  title: string;
}) {
  const choices = events.findLast((e) => e.t === "choices");
  const stream = events.filter((e) => e.t !== "choices");

  return (
    <div className="flex h-full flex-col">
      {/* シナリオ見出し */}
      <div
        className="flex items-center justify-between px-5"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          minHeight: 52,
        }}
      >
        <span style={{ fontSize: "14.5px", color: "var(--text-sub-2)" }}>
          {title} ⌄
        </span>
        <button
          type="button"
          aria-label="メニュー"
          className="grid place-items-center"
          style={{ width: 44, height: 44, color: "var(--text-sub)" }}
        >
          ⋯
        </button>
      </div>

      {/* 会話 */}
      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-5 pt-5 pb-2">
        {stream.map((e, i) => {
          const prev = stream[i - 1];
          switch (e.t) {
            case "day":
              return (
                <p
                  key={i}
                  className="text-center"
                  style={{ fontSize: "12px", color: "var(--text-sub)" }}
                >
                  {e.label}
                </p>
              );
            case "relay":
              return <RelayMessage key={i} body={e.body} hearsay={e.hearsay} />;
            case "own":
              return <OwnMessage key={i} text={e.text} />;
            case "ai":
              return (
                <AiMessage
                  key={i}
                  lines={e.lines}
                  showMark={!(prev && prev.t === "ai")}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {choices?.t === "choices" && <ChoiceChips items={choices.items} />}
      <Composer />
    </div>
  );
}
