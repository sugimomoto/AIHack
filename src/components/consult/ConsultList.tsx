"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * K-1 相談の一覧
 *
 * ★相談タブは対話に直行しない。一覧に着地する。
 *   「養育費」「面会の日程」「塾の費用」が同時に進む。
 *
 * ★見出しの下に「どれから話しても、順番はありません。」
 *   **上から片づけるものに見せない。**
 *
 * ★日付は右端に小さく置くだけ。**未読の印も件数バッジも持たない。**
 * ★「お話しが済んだもの」は沈めるが、**消さない。**
 */
type Item = {
  id: string;
  title: string;
  scenarioId: string | null;
  threadId: string | null;
  status: string;
  updatedAt: string;
};
type Data = { items: Item[]; inbound: { id: string; content: string }[] };

function md(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function ConsultList({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/cases/${caseId}/consultations`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : null))
      .then((r) => alive && r && setD(r));
    return () => {
      alive = false;
    };
  }, [caseId, partyId]);

  if (!d) return null;

  const open = d.items.filter((i) => i.status !== "CLOSED");
  const closed = d.items.filter((i) => i.status === "CLOSED");
  // ★一覧からは、そのスレッドをそのまま開く（新しく立てない）
  const href = (i: Item) => {
    const q = new URLSearchParams();
    if (i.threadId) q.set("t", i.threadId);
    if (i.scenarioId) q.set("s", i.scenarioId);
    const qs = q.toString();
    return qs ? `/app/consult/talk?${qs}` : "/app/consult/talk";
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>相談</h1>
      {/* ★上から片づけるものに見せない */}
      <p style={{ fontSize: 12.5, color: "var(--text-sub)", marginTop: 6 }}>
        どれから話しても、順番はありません。
      </p>

      {/* ★届いているご相談。相手の言葉ではないため封書として描く */}
      {d.inbound.length > 0 && (
        <div
          className="mt-4 overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 20,
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              background: "var(--envelope-head)",
              borderBottom: "1px dashed var(--border-dashed)",
              padding: "11px 14px",
            }}
          >
            <span style={{ fontSize: 11.5, color: "var(--agree-text)", letterSpacing: ".06em" }}>
              お相手からのご相談
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-sub)" }}>{d.inbound.length}件</span>
          </div>
          <div style={{ padding: 14 }}>
            <p style={{ fontSize: 14.5, lineHeight: 1.95 }}>
              {d.inbound[d.inbound.length - 1].content.split("\n")[0]}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--text-sub)", marginTop: 8 }}>
              お返事は、急ぎません。
            </p>
          </div>
        </div>
      )}

      {/* ★1件目を書くときがいちばん怖い。
             「お相手には届きません」は、書いたあとではなく**書く前**に要る（L-1） */}
      {d.items.length === 0 && d.inbound.length === 0 && (
        <Link
          href="/app/consult/start"
          className="mt-4 block"
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
              style={{ width: 40, height: 40, flexShrink: 0 }}
            />
            <div className="min-w-0">
              <p style={{ fontSize: 15, lineHeight: 1.8 }}>
                思っていることから、書いていただけます。
              </p>
              <p
                style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}
              >
                ここに書いたことは、お相手には届きません。整えなくても、まとまっていなくてもかまいません。
              </p>
            </div>
          </div>
          <div
            className="mt-3 flex items-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              minHeight: 44,
              padding: "0 14px",
            }}
          >
            <span style={{ fontSize: 15, color: "var(--text-sub)" }}>思っていることを書く</span>
          </div>
        </Link>
      )}

      {open.length > 0 && (
        <div
          className="mt-3.5 overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          {open.map((i, n) => (
            <Link
              key={i.id}
              href={href(i)}
              className="flex items-center justify-between gap-3"
              style={{
                padding: "14px 16px",
                borderTop: n === 0 ? undefined : "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: 15 }}>{i.title}</span>
              {/* ★日付は右端に小さく置くだけ */}
              <span style={{ fontSize: 11, color: "var(--text-sub-2)", flexShrink: 0 }}>
                {md(i.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ★沈めるが、消さない */}
      {closed.length > 0 && (
        <>
          <p style={{ fontSize: 11.5, color: "var(--text-sub-2)", marginTop: 18 }}>
            お話しが済んだもの
          </p>
          <div
            className="mt-2 overflow-hidden"
            style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)" }}
          >
            {closed.map((i, n) => (
              <Link
                key={i.id}
                href={href(i)}
                className="flex items-center justify-between gap-3"
                style={{
                  padding: "12px 14px",
                  borderTop: n === 0 ? undefined : "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ fontSize: 13.5, color: "var(--text-sub)" }}>{i.title}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{md(i.updatedAt)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ★別のことを話す → 相談の開始（設計 #4） */}
      <Link
        href="/app/consult/new"
        className="mt-4 flex items-center gap-3"
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: 20,
          padding: 16,
        }}
      >
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={34}
          height={34}
          className="rounded-full object-cover"
          style={{ width: 34, height: 34, flexShrink: 0 }}
        />
        <span style={{ fontSize: 14.5, flex: 1 }}>別のことを話す</span>
        <span style={{ color: "var(--text-sub)" }}>▸</span>
      </Link>
    </div>
  );
}
