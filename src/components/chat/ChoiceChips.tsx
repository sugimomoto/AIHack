/**
 * AI が提示する選択肢
 *
 * ★定型文ではない。選んだものは相手に送られるのではなく、AI への入力になる。
 * 文言は AI が文脈に応じて生成する。
 */
export function ChoiceChips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 px-5 pb-2.5">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          className="rounded-full px-[15px] py-2.5"
          style={{
            border: "1px solid #E4DACA",
            background: "var(--surface)",
            color: "var(--agree-text)",
            fontSize: "13.5px",
            minHeight: 44,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
