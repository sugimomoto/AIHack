/**
 * 進捗バー
 *
 * ★出す。ただし**数字とステップ数は出さない。**細い3分割のバーだけ。
 *   終わりが見えないほうが負担が大きいと判断した。
 *
 * ★飛ばせる画面（年収・すでにある取り決め・メールの登録）はバーの外に置く。
 *   バーは3で埋まる。**飛ばせるものを進捗に数えると、飛ばしづらくなる。**
 */
export function OnboardingProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mt-7 flex gap-1.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2,
            borderRadius: 1,
            background: i <= step ? "var(--border-strong)" : "var(--border)",
            transition: "background .3s ease",
          }}
        />
      ))}
    </div>
  );
}
