/**
 * ③ AI による取次ぎ ★最重要
 *
 * 吹き出しではない。画面幅いっぱいの「封書カード」として、
 * 会話の流れから物理的に切り離す。
 *
 * ★①と別種に見える理由は、5属性が同時に反転すること：
 *     寄せ（右→幅いっぱい）／形（吹き出し→見出し付きカード）
 *     幅（78%→100%）／面（塗りのみ→枠線＋破線）／署名（なし→AIが要約しました）
 *   1つでも崩すと課題が解けなくなる。
 *
 * ★フッタの「お相手が書いた言葉そのものは含まれていません。」は
 *   プロダクトの約束を担う。削らない。
 *
 * @see design/README.md（Screens / 3. 相談 / ③）
 */
export function RelayMessage({
  body,
  hearsay,
}: {
  body: string;
  hearsay?: string;
}) {
  return (
    <div
      className="anim-msg-in w-full overflow-hidden rounded-[20px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* ヘッダ帯 — 下辺は破線 */}
      <div
        className="flex items-center justify-between px-[14px] py-[11px]"
        style={{
          background: "var(--envelope-head)",
          borderBottom: "1px dashed var(--border-dashed)",
        }}
      >
        <span
          className="flex items-center gap-2"
          style={{ fontSize: "11.5px", color: "var(--agree-text)" }}
        >
          <EnvelopeIcon />
          お相手からのご相談
        </span>
        <span style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
          AIが要約しました
        </span>
      </div>

      {/* 本文 */}
      <div className="px-[14px] pt-4 pb-[14px]">
        <p style={{ fontSize: "15.5px", lineHeight: 1.95 }}>{body}</p>
        {hearsay && (
          <p
            className="mt-2"
            style={{
              fontSize: "13.5px",
              lineHeight: 1.9,
              color: "var(--text-sub)",
            }}
          >
            {hearsay}
          </p>
        )}
      </div>

      {/* フッタ — 約束 */}
      <div
        className="px-[14px] pt-[9px] pb-3"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "11px",
          lineHeight: 1.7,
          color: "var(--text-sub)",
        }}
      >
        お相手が書いた言葉そのものは含まれていません。
      </div>
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5" y="3.5" width="13" height="9" rx="1.5"
        stroke="var(--agree)" strokeWidth="1.2"
      />
      <path
        d="M2 4.5 8 8.8l6-4.3"
        stroke="var(--agree)" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
