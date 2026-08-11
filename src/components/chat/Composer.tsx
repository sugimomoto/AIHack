/**
 * 入力欄
 *
 * ★常に開いている。トピックを選ばなくても書き始められることが必須要件。
 * （選択を強制すると、感情の受け止めが選択画面の後ろに隠れる）
 */
export function Composer() {
  return (
    <div
      className="flex items-end gap-2.5 px-4 pt-2 pb-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div
        className="flex-1 rounded-[16px] px-[14px] py-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          minHeight: 44,
          fontSize: "15px",
          color: "var(--text-sub)",
        }}
      >
        思っていることを書く
      </div>
      <button
        type="button"
        aria-label="送信"
        className="grid shrink-0 place-items-center rounded-[20px]"
        style={{ width: 44, height: 44, background: "var(--ai)" }}
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M2 10 18 3l-4.2 14-3.3-5.3L2 10Z" fill="#FFFCF5" />
        </svg>
      </button>
    </div>
  );
}
