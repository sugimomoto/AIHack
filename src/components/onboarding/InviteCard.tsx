import Image from "next/image";
import Link from "next/link";

/**
 * ホームの招待カード
 *
 * ★招待をオンボーディングから外した。
 *   通り道に置くと、**アプリが相手に伝える前提でいることが伝わる。**
 *   「話していない」を選ばせれば、次に来るのは「では伝えましょう」だと予期される。
 *
 * ★だからここに置く。開くのは本人が選んだときだけ。
 *   急かす言葉も、達成率も、未完了の印も付けない。
 */
export function InviteCard() {
  return (
    <div
      className="mx-4 mt-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: 14,
      }}
    >
      <div className="flex gap-3">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={28}
          height={28}
          style={{ width: 28, height: 28, flexShrink: 0 }} />
        <div className="min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.8 }}>
            お相手にも使っていただくとき
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 4 }}>
            ご案内をお渡しできます。お渡しになるまで、お相手には何も届きません。
          </p>
          <Link
            href="/onboarding/invite"
            style={{
              display: "inline-block",
              fontSize: 13,
              color: "var(--agree-text)",
              marginTop: 8,
            }}
          >
            ご案内を用意する ▸
          </Link>
        </div>
      </div>
    </div>
  );
}
