import Link from "next/link";
import { EMPTY_AGREEMENTS } from "@/domain/ui/emptyState";
import { IMPLEMENTED_TOPICS, TOPIC_LABEL } from "@/domain/agreement/topics";
import { LIST_LABEL, type ScreenState } from "@/domain/agreement/screen";

/**
 * 取り決めの一覧（A-1）
 *
 * ★数字を出さない。1/4 も ○% も作らない。**状態は1行の文。**
 *   チップも進捗バーも持たない。
 *
 * ★下書きの行だけ、地が surface-2 に沈み、鍵アイコンが付く。
 *   一覧でも詳細と同じ手法で「閉じている」ことを示す。
 *
 * ★順番はありません、を見出しの下に置く。
 *   並んでいるものを見た直後に効かせるため。
 */

export function TopicList({
  states,
}: {
  states: Record<string, ScreenState>;
}) {
  return (
    <div className="px-5 pb-10 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>取り決め</h1>
      <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 6 }}>
        公正証書に入れる内容です。順番はありません。
      </p>

      {/* ★何も無いときは L-2 を最上部に */}
      {IMPLEMENTED_TOPICS.every((t) => (states[t] ?? "EMPTY") === "EMPTY") && (
        <div
          className="mt-4"
          style={{
            background: "var(--bubble-ai)",
            border: "1px dashed #DCC7A6",
            borderRadius: 20,
            padding: "15px 17px",
          }}
        >
          <p style={{ fontSize: 14.5, lineHeight: 1.8, fontWeight: 600 }}>
            {EMPTY_AGREEMENTS.lead}
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
            {EMPTY_AGREEMENTS.body}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {IMPLEMENTED_TOPICS.map((t) => {
          const s = states[t] ?? "EMPTY";
          const closed = s === "DRAFT" || s === "WITHDRAWN";
          return (
            <Link
              key={t}
              href={`/app/agreements/${t.toLowerCase()}`}
              className="flex items-center gap-2.5"
              style={{
                // ★下書きの行だけ沈める
                background: closed ? "var(--surface-2)" : "var(--surface)",
                border: `1px solid ${closed ? "var(--border-subtle)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
                padding: "14px 15px",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {closed && <LockIcon />}
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{TOPIC_LABEL[t]}</span>
                </div>
                {/* ★状態は1行の文。チップにしない */}
                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.85,
                    marginTop: 4,
                    color: s === "AGREED" ? "var(--agree-text)" : "var(--text-sub)",
                  }}
                >
                  {LIST_LABEL[s]}
                </p>
              </div>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>›</span>
            </Link>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.95,
          color: "var(--text-sub-2)",
          marginTop: 14,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 10,
        }}
      >
        ひとつ合意できれば、それだけで書面にできます。全部が揃うのを待つ必要はありません。
      </p>

      {/* ★公正証書は、論点カードと同じ形にしない。5つ目の項目に見える */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 22, paddingTop: 16 }}>
        <Link href="/app/agreements/notarial" className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 14 }}>公正証書</p>
            <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>
              まだお預かりしていません
            </p>
          </div>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>›</span>
        </Link>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="var(--ai-text)" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--ai-text)" strokeWidth="1.8" />
    </svg>
  );
}
