import Image from "next/image";
import { EMPTY_AGREEMENTS } from "@/domain/ui/emptyState";
import { IMPLEMENTED_TOPICS, TOPIC_LABEL } from "@/domain/agreement/topics";

/**
 * L-2 取り決めが空 ← いちばん重要
 *
 * ★進捗バーを出さない。
 *   0/2 のバーは、**開くたびに何も進んでいないことを突きつける。**
 *   1件でも決まった時点から出す。
 *
 * ★項目を `surface-2` に沈め、ステータスチップを付けない。
 *   「未着手」を並べると宿題の一覧になる。
 *
 * ★「全部を決める必要は、ありません」を最上部に置くのは、
 *   項目の数を見た直後に効かせるため。
 */
export function EmptyAgreements() {
  return (
    <div className="px-5 pt-6">
      <p style={{ fontSize: 15, lineHeight: 1.8 }}>{EMPTY_AGREEMENTS.heading}</p>

      <div
        className="mt-4"
        style={{
          background: "var(--bubble-ai)",
          border: "1px dashed #DCC7A6",
          borderRadius: 20,
          padding: 18,
        }}
      >
        <div className="flex items-start gap-3">
          <Image
            src="/character/capybara-sit.png"
            alt=""
            width={40}
            height={40}
            className="rounded-full object-cover"
            style={{ width: 40, height: 40, flexShrink: 0 }} />
          <div className="min-w-0">
            <p style={{ fontSize: 15, lineHeight: 1.8, fontWeight: 600 }}>
              {EMPTY_AGREEMENTS.lead}
            </p>
            <p
              style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}
            >
              {EMPTY_AGREEMENTS.body}
            </p>
          </div>
        </div>
      </div>

      {/* ★沈める。ステータスチップは付けない */}
      <p style={{ fontSize: 11.5, color: "var(--text-sub-2)", marginTop: 18 }}>
        {EMPTY_AGREEMENTS.listHeading}
      </p>
      <div
        className="mt-2 overflow-hidden"
        style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)" }}
      >
        {IMPLEMENTED_TOPICS.map((t, i) => (
          <p
            key={t}
            style={{
              fontSize: 14,
              padding: "13px 14px",
              color: "var(--text-sub)",
              borderTop: i === 0 ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            {TOPIC_LABEL[t]}
          </p>
        ))}
      </div>
    </div>
  );
}
