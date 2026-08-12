/**
 * 静かな提示（案3）
 *
 * ★検知したときのみ、**次に開いたとき**に1枚出る。
 *   その場では出さない。書いた直後に出すと「見抜かれた」になる。
 *
 * ★本人に向けたものだと明示しない。
 *   「あなたは危険な状態です」とは言わない。AIが判定してよい事柄ではない。
 *   他のカードと同じ形にし、**読み飛ばせるようにする。**
 *
 * ★閉じられる。無視しても責められた感じがしないこと。
 *
 * @see docs/ui-design.md §5.2（案2＋案3）
 */
export function QuietCard() {
  return (
    <div
      className="mx-4 mt-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 14,
      }}
    >
      <p style={{ fontSize: 13.5, fontWeight: 600 }}>相談できる場所について</p>
      <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
        お子さんのことやご自身の安全について、公的な窓口があります。
        話すかどうかは、ご自身で決めていただけます。
      </p>
      <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub-2)", marginTop: 8 }}>
        入力欄の横の 🛡 から、いつでもご覧いただけます。
      </p>
    </div>
  );
}
