import Link from "next/link";
import { notFound } from "next/navigation";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { GENERAL_INFO_NOTICE } from "@/domain/knowledge/article";
import { findKnowledgeArticle } from "@/infra-adapters/firestore/repositories/masterRepository";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await findKnowledgeArticle(id).catch(() => null);
  if (!a) notFound();

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-6">
        <Link href="/knowledge" style={{ fontSize: 13, color: "var(--text-sub)" }}>
          ‹ 一覧へ
        </Link>
        <h1 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.7, marginTop: 12 }}>{a.title}</h1>

        <p
          style={{
            fontSize: 11.5,
            lineHeight: 1.85,
            color: "var(--text-sub-2)",
            background: "var(--muted-bg)",
            borderRadius: "var(--r-sm)",
            padding: "9px 11px",
            marginTop: 12,
          }}
        >
          {GENERAL_INFO_NOTICE}
        </p>

        <div style={{ fontSize: 14, lineHeight: 2.05, whiteSpace: "pre-wrap", marginTop: 16 }}>{a.body}</div>

        {/* ★監修されていないことを隠さない */}
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: "var(--muted)", marginTop: 20 }}>
          {a.supervisedBy
            ? `監修：${a.supervisedBy}`
            : "この記事はまだ専門家の監修を受けていません。制度の理解の助けとしてお読みください。"}
        </p>

        {/* ★記事から相談へ戻る導線 */}
        <Link
          href="/app"
          className="mt-6 grid place-items-center"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-full)",
            minHeight: 48,
            fontSize: 14.5,
          }}
        >
          相談に戻る
        </Link>
      </div>
    </PhoneFrame>
  );
}
