import Image from "next/image";
import {
  MOMENT_CAPTION,
  MOMENT_LEAD,
  momentFollowUp,
  momentFooter,
  momentLinesOf,
} from "@/domain/agreement/moment";

/**
 * N-1 合意が成立した瞬間
 *
 * ★祝わない。紙吹雪も、バッジも、「おめでとうございます」もない。
 *   **これは離婚の条件が決まった瞬間である。**
 *   祝われると、失ったものを思い出させる。
 *
 * ★上下に線が1本ずつ引かれて、その中に内容が置かれるだけ。
 */
export function AgreementMoment({
  payload,
  agreedOn,
  topic,
}: {
  payload: Record<string, unknown>;
  agreedOn: string;
  /** ★論点ごとに文を書き分ける（面会交流に「お支払いの日」と出ていた） */
  topic: string;
}) {
  const lines = momentLinesOf(payload);
  // ★読める行が一つも無ければ、何も出さない。空の枠を祝いの器にしない
  if (lines.length === 0) return null;

  return (
    <div className="anim-msg-in">
      <div className="flex gap-2.5">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={26}
          height={26}
          style={{ width: 26, height: 26, flexShrink: 0 }} />
        <p style={{ fontSize: 13.5, lineHeight: 1.95 }}>{MOMENT_LEAD}</p>
      </div>

      {/* ★線が1本ずつ。480msで左から引かれる */}
      <div
        className="mt-3"
        style={{
          borderTop: "1px solid var(--agree)",
          borderBottom: "1px solid var(--agree)",
          padding: "14px 2px",
          animation: "rule-in 480ms ease-out both",
        }}
      >
        <p style={{ fontSize: 11.5, color: "var(--agree-text)" }}>{MOMENT_CAPTION}</p>
        {lines.map((l) => (
          <p key={l.label} style={{ fontSize: 19, lineHeight: 1.55, marginTop: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-sub)", marginRight: 8 }}>{l.label}</span>
            {l.value}
          </p>
        ))}
        <p style={{ fontSize: 11.5, color: "var(--text-sub-2)", marginTop: 10 }}>
          {momentFooter(agreedOn)}
        </p>
      </div>

      {/* ★決まった瞬間に「もう変えられない」と感じさせない */}
      <div className="mt-3 flex gap-2.5">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={26}
          height={26}
          style={{ width: 26, height: 26, flexShrink: 0 }} />
        <p style={{ fontSize: 13, lineHeight: 1.95, color: "var(--text-sub)" }}>
          {momentFollowUp(topic)}
        </p>
      </div>
    </div>
  );
}
