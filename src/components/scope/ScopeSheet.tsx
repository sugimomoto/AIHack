import Image from "next/image";

/**
 * ★「今回だけ？ 今後も？」の確認シート
 *
 * C3（合意が AI の判断基準になる）の実証。
 * 当事者は「今回だけ」か「今後も」かを区別して言わない。
 * AI が取り決めを参照しているからこそ、この問いを立てられる。
 *
 * ★二択の重さの違いが、文字を読む前に伝わること。
 *   「今後も」＝取り決めそのものの改訂であり、法的な意味が違う。
 */
export function ScopeSheet() {
  return (
    <div
      className="anim-fade rounded-t-[26px] px-5 pt-3 pb-6"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        className="mx-auto mb-4 h-1 w-9 rounded-full"
        style={{ background: "var(--border-strong)" }}
        aria-hidden
      />

      <div className="flex gap-[9px]">
        <Image
          src="/character/capybara.png"
          alt=""
          width={28}
          height={28}
          className="rounded-full object-cover"
          style={{ marginTop: 3, width: 28, height: 28 }}
        />
        <div style={{ fontSize: "15.5px", lineHeight: 1.95 }}>
          <p>取り決めでは「月1回・第2土曜」となっています。</p>
          <p style={{ color: "var(--text-sub-2)" }}>
            今回だけの変更でしょうか。それとも、今後もでしょうか。
          </p>
        </div>
      </div>

      {/* 今回だけ — 軽い。沈んだ面のみ */}
      <button
        type="button"
        className="mt-4 w-full rounded-[20px] px-4 py-4 text-left"
        style={{ background: "var(--surface-2)" }}
      >
        <p style={{ fontSize: "16px", fontWeight: 500 }}>今回だけ変更する</p>
        <p className="mt-0.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          9月13日の1回だけ。取り決めは変わりません。
        </p>
      </button>

      {/* 今後も — 重い。枠線カード ＋ アイコン ＋ 合意色 ＋ 差分 */}
      <button
        type="button"
        className="mt-3 w-full rounded-[20px] px-4 py-4 text-left"
        style={{
          background: "var(--agree-bg)",
          border: "1px solid var(--agree)",
        }}
      >
        <p
          className="flex items-center gap-2"
          style={{ fontSize: "16px", fontWeight: 500, color: "var(--agree-text)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="var(--agree)" strokeWidth="1.5" />
            <path d="M8 10h8M8 14h5" stroke="var(--agree)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          今後も変更する
        </p>
        <p className="mt-1.5" style={{ fontSize: "13.5px", lineHeight: 1.85, color: "var(--text-sub-2)" }}>
          取り決めそのものを書き換えます。お相手の同意が必要です。
          <br />
          確定の前に、変更後の条文をもう一度お見せします。
        </p>
        <p
          className="mt-3 pt-3"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "12.5px",
            color: "var(--text-sub)",
          }}
        >
          変更前：月1回・第2土曜 ／ 変更後：月1回・第3土曜
        </p>
      </button>

      <p
        className="mt-4 text-center"
        style={{ fontSize: "12.5px", color: "var(--text-sub)" }}
      >
        あとで決めることもできます
      </p>
    </div>
  );
}
