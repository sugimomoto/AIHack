import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

/**
 * 公正証書（P-1）— 今回は場所取り
 *
 * ★アプリが作るのは**原案**でしかない。
 *   実際の公正証書は公証役場で作られる紙になる。
 *   その完成物を預かれると、この画面が**正典の置き場所**になる。
 *
 * ★★ 中身を読み取らない。
 *   読み取って項目にすれば、今回やめた「AI が取り決めを作る」に逆戻りする。
 *   **書かないだけでは、あとから足したくなる。明記する。**
 *
 * ★食い違ったら、預かった公正証書が正。アプリ側は「原案」と書き続ける。
 *   画面の上下もその順に置く。
 *
 * @see Issue #6
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-4">
      <Link href="/app/agreements" style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
        ← 取り決め
      </Link>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>公正証書</h1>

      <div
        className="mt-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "15px 16px",
        }}
      >
        <p style={{ fontSize: 16 }}>まだお預かりしていません</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
          公証役場でお作りになったものを、ここに置いておけます。
          写真でも、PDFでもかまいません。
        </p>
        <button
          type="button"
          disabled
          className="mt-3.5 w-full"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            borderRadius: "var(--r-full)",
            minHeight: 46,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          選ぶ
        </button>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
          この機能は、まだご用意できていません。
        </p>
      </div>

      {/* ★食い違ったら、預かったほうが正。順番も上に置く */}
      <div
        className="mt-3"
        style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: "13px 15px" }}
      >
        <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.8 }}>
          お預かりしたものが、いちばん確かなものになります
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 6 }}>
          アプリでお作りするのは原案です。食い違いがあったときは、
          お預かりした公正証書のほうが正しいものになります。
        </p>
      </div>

      {/* ★明記する。書かないだけでは、あとから足したくなる */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--text-sub-2)",
          marginTop: 12,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 10,
        }}
      >
        中身を読み取ることはしません。お預かりするだけです。
      </p>

      {/* ★軽く扱う見た目にしない。1枠取る */}
      <div
        className="mt-3"
        style={{ background: "var(--muted-bg)", borderRadius: "var(--r-md)", padding: "12px 14px" }}
      >
        <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub-2)" }}>
          本籍・ご住所・お名前が載っているものです。
          この端末と、お預かりする場所の両方で保護されます。
          お相手には見えません。
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 22, paddingTop: 16 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>アプリでお作りするもの</p>
        <Link
          href="/app/agreements/document"
          className="mt-2.5 flex items-center justify-between"
          style={{
            border: "1px solid var(--border-strong)",
            background: "var(--surface)",
            borderRadius: "var(--r-md)",
            padding: "13px 15px",
          }}
        >
          <div>
            <p style={{ fontSize: 14 }}>原案を見る</p>
            <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>
              合意できた内容だけが入ります
            </p>
          </div>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>›</span>
        </Link>
      </div>
    </div>
  );
}
