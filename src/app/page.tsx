import Link from "next/link";
import Image from "next/image";
import { StartButton } from "@/components/onboarding/StartButton";
import { EmailLinkForm } from "@/components/auth/EmailLinkForm";

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
 * ★★ どう進むか。**これが無いと、何をするアプリか分からない。**
 *
 *   以前は「転送しない」だけを言っていた。**しないことしか言っていなかった。**
 *   何が起きるのかが無いので、**話したあとどうなるのかが見えない。**
 */
/**
 * ★★ 3つとも「決める」の話になっていた（2026-08-14）。
 *
 *   ①話す →②決めたいことを渡す →③合意。
 *   これだと**取り決めを作るための道具**に見える。
 *
 *   ★実際の使われ方は違う。実データ（1年半・約1,080件）では
 *   **8割以上が日々の事務連絡**だった。送迎・学校・費用・体調。
 *   取り決めは要所で必要になるが、**日々の中心ではない。**
 *
 *   → **日々のこと**と**取り決め**を、別の段に分ける。
 *   ★公正証書を入口の顔にしない。**話がこじれる。**
 */
const STEPS = [
  // ★否定を単独で書かない。必ず対で（`RELAY_PROMISE_SHORT` と同じ形）
  {
    n: "1",
    label: "おひとりで、AIに話す",
    note: "書いた言葉そのままでは届きません。整えてお伝えします。",
  },
  {
    n: "2",
    label: "日々のことは、そのまま片づく",
    note: "送迎・学校・費用のご相談。決まったことは、控えに残ります。",
  },
  {
    n: "3",
    label: "決めておきたいことは、取り決めに",
    note: "おふたりの記録が同じになったとき、合意になります。金額と条項は、ご自身で書きます。",
  },
];

/**
 * ★★ 審査・確認のための入口を、**当事者の導線から分ける。**
 *
 *   以前は「お戻りになる」と同じ列に、5枚並べていた。
 *   ★「CT-1〜CT-4」「体験モック」は、**当事者には何のことか分からない。**
 *   一方でこれらは、主張の裏付けとして**審査員には必ず見ていただく**必要がある。
 *
 *   → 隠さない。**宛先を書いて分ける。**
 */
const REVIEW = [
  { href: "/context", label: "AIに渡しているもの", note: "相手の言葉を持っていないことを、そのまま表示します（はじめたあと）" },
  { href: "/metrics", label: "原価", note: "CT-1〜CT-4。ルーティングなしとの比較を実測値で" },
  { href: "/mock", label: "体験モック", note: "両当事者の視点を切り替えられます" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ★★ メールのリンクから戻ってきたときは、**説明を出さない。**
  //
  //   この人は、もう説明を読んで押した人である。
  //   もう一度読ませたうえ、確認の欄が**説明の下に埋もれる**のは筋が悪い。
  //   ★用があるのは1つだけなので、それだけを出す。
  //
  // ★★ 判定を、クライアント側（Firebase の isSignInWithEmailLink）と揃える。
  //   apiKey を見ないと、条件がずれる。
  //   ずれると、**確認だけの画面に「リンクを送る」フォームが出る**（実機で発生）。
  const q = await searchParams;
  const fromEmailLink =
    q.mode === "signIn" && typeof q.oobCode === "string" && typeof q.apiKey === "string";

  if (fromEmailLink) {
    return (
      <div
        className="grid min-h-dvh place-items-center px-5 py-10"
        style={{ background: "var(--surface-2)" }}
      >
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/character/capybara-sit.png"
              alt=""
              width={56}
              height={56}
              priority
              style={{ width: 56, height: 56 }}
            />
            <h1 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.7, marginTop: 12 }}>
              Aida（あいだ）
            </h1>
          </div>
          <div
            className="mt-6"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            {/* ★StartButton の前置き（「リンクをお送りします」）は、
                   もう送り終えたこの場面には合わない。フォームだけを出す */}
            <EmailLinkForm mode="signup" />
          </div>
        </div>
      </div>
    );
  }

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
          {/* ★★ 見出しが否定だった（2026-08-14）。
                 「メッセージを、相手に転送しません。」
                 ★**転送しないのは手段であって、目的ではない。**
                 目的は、**角の立つところを外して、決めるために要ることを伝える**こと。
                 否定を看板にすると、**届かないなら意味がない**と読まれる。

                 ★あわせて「取り決めは、ご自身で書いて残します」を外した。
                 ここに置くと、**取り決めを作るための道具**に見える。
                 実際にいちばん多いのは日々の連絡である（下の②）。 */}
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.8 }}>
            角の立つところは、こちらで外してお伝えします。
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 2.0, color: "var(--text-sub)", marginTop: 8 }}>
            思っていることは、そのまま書いていただけます。
            <br />
            <strong>書いた言葉そのものは、お相手に渡りません。</strong>
            <br />
            決めるために要ることだけが、伝わります。
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

        {/* ★★ どう進むか。「転送しない」だけでは、**しないことしか言っていない** */}
        <section className="mt-5">
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)" }}>どう進むか</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex items-start gap-3"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "13px 15px",
                }}
              >
                <span
                  className="grid shrink-0 place-items-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    background: "var(--bubble-ai)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7 }}>{s.label}</p>
                  <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 2 }}>
                    {s.note}
                  </p>
                </div>
              </div>
            ))}
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

        {/* ★★ お戻りは、**同じ欄**である。
               以前は雑多な5枚の5番目に「お戻りになる」を置いていた。**埋もれていた。**
               ★入口を2つに分けない。分けると、どちらか選ばせることになる。
               すでに登録があれば「おかえりなさい」と出る（EmailLinkForm）。
               ★選ばせずに、**こちらが見分ける。** */}
        <p
          className="mt-4"
          style={{
            background: "var(--muted-bg)",
            borderRadius: "var(--r-sm)",
            padding: "11px 13px",
            fontSize: 12.5,
            lineHeight: 1.95,
            color: "var(--text-sub)",
            textAlign: "center",
          }}
        >
          <strong>以前ご登録の方も、同じ欄からお戻りいただけます。</strong>
          <br />
          入力されたアドレスで、こちらがお見分けします。
        </p>

        <p className="mt-5" style={{ textAlign: "center" }}>
          <Link
            href="/knowledge"
            style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline" }}
          >
            取り決めについて知る
          </Link>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            （はじめる前でもご覧いただけます）
          </span>
        </p>

        {/* ★★ 宛先を書いて分ける。当事者の導線に、審査用の言葉を混ぜない */}
        <section className="mt-8" style={{ borderTop: "1px dashed var(--border-dashed)", paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub-2)" }}>
            審査・確認用（AI HACK 2026）
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {REVIEW.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "11px 14px",
                }}
              >
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{r.label}</p>
                <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--text-sub)", marginTop: 2 }}>
                  {r.note}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 20, textAlign: "center" }}>
          AI HACK 2026 提出作品。実在の人物の情報は含まれません。
        </p>
      </div>
    </div>
  );
}
