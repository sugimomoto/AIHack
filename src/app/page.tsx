import Link from "next/link";
import Image from "next/image";
import { StartButton } from "@/components/onboarding/StartButton";

/**
 * 入口
 *
 * ★何をするアプリかを、最初の1画面で言い切る。
 *   「メッセージを転送しない」は説明を要する主張であり、
 *   **先に言わないと、ただのチャットアプリに見える。**
 */
export const metadata = {
  title: "Aida（あいだ）",
  description: "離婚しても、子どもが健やかに育つための基盤になる。",
};

/**
 * ★「はじめる」はここには置かない（StartButton が担う）。
 *   以下は、はじめる前でも見られるもの。
 */
const ROUTES = [
  {
    href: "/context",
    label: "AIに渡しているもの",
    note: "相手の言葉を持っていないことを、そのまま表示します。★はじめたあとにご覧いただけます。",
  },
  { href: "/metrics", label: "原価", note: "CT-1〜CT-4。ルーティングなしとの比較を実測値で出します。" },
  { href: "/knowledge", label: "取り決めについて知る", note: "制度の一般的な説明。個別の助言はしません。" },
  { href: "/mock", label: "体験モック", note: "デザイン確認用。両当事者の視点を切り替えられます。" },
  { href: "/signin", label: "お戻りになる", note: "ご登録済みのメールアドレスにリンクをお送りします。" },
];

export default function Page() {
  return (
    <div className="min-h-dvh px-5 py-10" style={{ background: "var(--surface-2)" }}>
      <div className="mx-auto w-full max-w-[560px]">
        <div className="flex flex-col items-center text-center">
          <div
            className="grid place-items-center overflow-hidden"
            style={{ width: 76, height: 76, borderRadius: 22, background: "var(--bubble-ai)" }}
          >
            <Image src="/character/capybara-sit.png" alt="" width={62} height={62} priority style={{ width: 62, height: 62, flexShrink: 0 }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.6, marginTop: 16 }}>Aida（あいだ）</h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
            離婚しても、子どもが健やかに育つための基盤になる。
          </p>
        </div>

        <section
          className="mt-7"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: 20,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.8 }}>
            メッセージを、相手に転送しません。
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 2.0, color: "var(--text-sub)", marginTop: 8 }}>
            思っていることは、そのまま書いていただけます。
            <br />
            {/* ★取り決めの作られ方を、ここで先に言う。
                   言っておかないと、取り決めの画面が唐突になる */}
            <strong>取り決めは、ご自身で書いて残します。</strong>
            <br />
            おふたりの記録が同じになったとき、合意になります。
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 10 }}>
            おふたりが直接やりとりすることには、なりません。
          </p>
          <div
            className="mt-4"
            style={{
              background: "var(--muted-bg)",
              borderRadius: "var(--r-sm)",
              padding: "11px 13px",
              fontSize: 12.5,
              lineHeight: 1.95,
              color: "var(--text-sub-2)",
            }}
          >
            <p>
              入力：<span style={{ color: "var(--text)" }}>月3万が限界。こっちだって仕事切られて必死なんだよ。少しは考えろ</span>
            </p>
            <p style={{ marginTop: 6 }}>
              相手に届くもの：
              <br />
              <span style={{ color: "var(--agree-text)" }}>
                養育費について、月額3万円までを希望されているそうです。
                <br />
                背景として、現在は職を失っているとのことです。
              </span>
            </p>
          </div>
        </section>

        {/* ★お名前もご連絡先も要らない。状況もうかがわない */}
        <StartButton />
        {/* ★★「ご連絡先も要りません」と書いていた。**サインアップ必須にしたので撤回する。**
               できないことを書かないのと同じで、**しなくなったことも書かない。** */}
        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 10, textAlign: "center" }}>
          お名前は要りません。ご関係の状態も、うかがいません。
          <br />
          メールアドレスは、<strong>次にお戻りいただくためだけ</strong>に使います。
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {ROUTES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                {r.label}
              </p>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 4 }}>
                {r.note}
              </p>
            </Link>
          ))}
        </div>

        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 20, textAlign: "center" }}>
          AI HACK 2026 提出作品。実在の人物の情報は含まれません。
        </p>
      </div>
    </div>
  );
}
