import Image from "next/image";
import Link from "next/link";

/**
 * H-2 年収は、必要になった時点で
 *
 * ★受諾した側に、その場で年収を聞かない。
 *   「参加しない選択もできます」と伝えた直後に最も抵抗の大きい質問を置くと、
 *   **あの一文が入口の作法だったことになる。**
 *
 * ★「あとにする」と「入れなくても、話し合いは続けられます」が
 *   両方揃っていないと、実質的な強制になる。
 *
 * ★目安が出ないことを、不利益として書かない。
 *   「目安がないと話が進みません」と書いた時点で、実質的な強制になる。
 *
 * ⚠ 最終形は対話の中のカード（AIの発言の続きとして読める位置）である。
 *   いまはホームに置いている。**入れる経路が無いこと自体は塞いだ。**
 */
export function IncomeCard() {
  return (
    <div
      className="mx-4 mt-3"
      style={{
        background: "var(--bubble-ai)",
        border: "1px dashed var(--border-strong)",
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
          style={{ flexShrink: 0 }}
        />
        <div className="min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.8 }}>
            養育費の目安をお出しできます
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 4 }}>
            お出しするには、おふたりの年収が必要です。
            <br />
            入力した金額そのものは、お相手には見えません。共有されるのは幅だけです。
          </p>
          <Link
            href="/onboarding/profile?from=home"
            style={{
              display: "inline-block",
              fontSize: 13,
              color: "var(--agree-text)",
              marginTop: 8,
            }}
          >
            年収を入れる ▸
          </Link>
          <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
            入れなくても、話し合いは続けられます。
          </p>
        </div>
      </div>
    </div>
  );
}
