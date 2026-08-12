import { RELAY_PROMISE_SHORT } from "@/domain/ui/emptyState";

/**
 * ① 自分の発言
 *
 * 右寄せの吹き出し。枠線なし・尻尾なし・時刻なし・既読なし。
 *
 * ★直下の一文はプロダクトの約束を担う。削らない。コントラストを落とさない。
 *
 * ★「届きません」だけにしない。
 *   直後に「お相手には、こう伝わりました」が並ぶため、
 *   **言い切ると画面の中で矛盾する。**
 *   渡らないのは**そのままの言葉**であって、内容は整えて渡る。
 *
 * @see design/README.md（Screens / 3. 相談）
 */
export function OwnMessage({ text }: { text: string }) {
  return (
    <div className="anim-msg-in flex flex-col items-end">
      <div
        className="max-w-[78%] rounded-[20px] px-[15px] py-[13px]"
        style={{
          background: "var(--bubble-self)",
          fontSize: "15.5px",
          lineHeight: 1.9,
        }}
      >
        {text}
      </div>
      <p
        className="mt-1.5 pr-1"
        style={{ fontSize: "11px", lineHeight: 1.7, color: "var(--text-sub)" }}
      >
        {RELAY_PROMISE_SHORT}
      </p>
    </div>
  );
}
