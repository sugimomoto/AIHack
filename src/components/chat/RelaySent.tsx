/**
 * 送った側に見せる取次ぎ
 *
 * ★「書いた言葉は届きません」だけを見せて、**何が届いたのかを見せていなかった。**
 *   否定の約束しか見えないと、**AI を通すと何が起きるのかが分からないまま**になる。
 *
 * ★相手側の封書（RelayMessage）と見た目を分ける。
 *   同じ形にすると、届いたものと送ったものが区別できない。
 *
 * ★誇らない。「うまく伝えました」とは書かない。
 *   事実として、渡ったものをそのまま置く。
 */
export function RelaySent({ text }: { text: string }) {
  const [body, ...rest] = text.split("\n").filter(Boolean);
  return (
    <div className="flex flex-col items-end">
      <div
        style={{
          maxWidth: "86%",
          background: "var(--surface)",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: "11px 13px",
        }}
      >
        <p style={{ fontSize: 11, color: "var(--text-sub-2)", letterSpacing: ".04em" }}>
          お相手には、こう伝わりました
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.95, marginTop: 6 }}>{body}</p>
        {rest.length > 0 && (
          <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 5 }}>
            {rest.join("\n")}
          </p>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
        お書きになった言葉そのものは、渡していません。
      </p>
    </div>
  );
}
