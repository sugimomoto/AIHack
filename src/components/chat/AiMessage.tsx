import Image from "next/image";

/**
 * ② AI 自身の発言
 *
 * カピバラ 28px 円形 ＋ 左の吹き出し（82%幅）。
 * マークは連続する塊の先頭にだけ出し、繰り返さない。
 *
 * ★カピバラに表情差分・リアクションを作らない。
 *   感情に反応して表情が変わると「見抜かれた」という監視感が生まれる。
 *
 * @see docs/ui-design.md §4
 */
export function AiMessage({
  lines,
  showMark = true,
}: {
  lines: string[];
  showMark?: boolean;
}) {
  return (
    <div className="anim-msg-in flex gap-[9px]">
      <div className="w-7 shrink-0">
        {showMark && (
          <Image
            src="/character/capybara.png"
            alt=""
            width={28}
            height={28}
            className="anim-breathe rounded-full object-cover"
            style={{ marginTop: 3, width: 28, height: 28 }}
          />
        )}
      </div>
      <div
        className="max-w-[82%] rounded-[20px] px-[15px] py-[13px]"
        style={{
          background: "var(--bubble-ai)",
          fontSize: "15.5px",
          lineHeight: 1.95,
        }}
      >
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
  );
}
