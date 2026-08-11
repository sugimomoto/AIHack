import Link from "next/link";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { GENERAL_INFO_NOTICE } from "@/domain/knowledge/article";
import { listKnowledgeArticles } from "@/infra-adapters/firestore/repositories/masterRepository";

/**
 * ナレッジの一覧
 *
 * ★「一般情報」と「個別助言」を画面レベルで分離する（非弁対策の構造）。
 *   この画面には、当事者の事情が一切現れない。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await listKnowledgeArticles().catch(() => []);

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>取り決めについて知る</h1>
        <p
          style={{
            fontSize: 11.5,
            lineHeight: 1.85,
            color: "var(--text-sub-2)",
            background: "var(--muted-bg)",
            borderRadius: "var(--r-sm)",
            padding: "9px 11px",
            marginTop: 10,
          }}
        >
          {GENERAL_INFO_NOTICE}
        </p>

        <div className="mt-4 flex flex-col gap-2.5">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/knowledge/${a.id}`}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</p>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 5 }}>
                {a.summary}
              </p>
            </Link>
          ))}
          {items.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-sub)" }}>記事を読み込めませんでした。</p>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
