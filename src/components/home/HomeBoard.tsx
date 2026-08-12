"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { todayJst } from "@/lib/today";

/**
 * ホーム
 *
 * ★用がなければ何もしなくてよい画面。
 *   件数は**文言に埋める。バッジは使わない**（U-5）。
 *
 * ★進捗バーは、1件でも決まってから出す（L-2）。
 *   0/2 のバーは、開くたびに何も進んでいないことを突きつける。
 */
type Home = {
  inboundCount: number;
  latestInbound: string | null;
  topics: { topic: string; label: string; status: string }[];
  decided: number;
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];

export function HomeBoard({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [h, setH] = useState<Home | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/cases/${caseId}/home`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<Home>) : null))
      .then((r) => alive && r && setH(r));
    return () => {
      alive = false;
    };
  }, [caseId, partyId]);

  const today = todayJst();
  const d = new Date(`${today}T00:00:00+09:00`);
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

  return (
    <div className="px-5 pt-6">
      <div className="flex items-start gap-3">
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={44}
          height={44}
          className="rounded-full object-cover"
          style={{ width: 44, height: 44 }}
        />
        <div>
          <p style={{ fontSize: 13, color: "var(--text-sub)" }}>{dateLabel}</p>
          {/* ★件数を文言に埋める */}
          <p className="mt-0.5" style={{ fontSize: 15, lineHeight: 1.7 }}>
            {h === null
              ? " "
              : h.inboundCount === 0
                ? "今日は、お預かりはありません"
                : h.inboundCount === 1
                  ? "今日はひとつ、お預かりしています"
                  : `${h.inboundCount}つ、お預かりしています`}
          </p>
        </div>
      </div>

      {h && h.inboundCount > 0 && h.latestInbound && (
        <div
          className="mt-5 overflow-hidden"
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
            <span
              style={{ fontSize: 11.5, color: "var(--agree-text)", letterSpacing: ".06em" }}
            >
              お相手からのご相談
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-sub)" }}>{h.inboundCount}件</span>
          </div>
          <div style={{ padding: "14px" }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.95 }}>{h.latestInbound}</p>
            {/* ★相手を待たせている感覚を打ち消す一文。削らない */}
            <p style={{ fontSize: 12.5, color: "var(--text-sub)", marginTop: 10 }}>
              お返事は、急ぎません。
            </p>
          </div>
          <Link
            href="/app/consult"
            className="block"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: "12px 14px",
              fontSize: 13.5,
              color: "var(--agree-text)",
            }}
          >
            相談を開く ▸
          </Link>
        </div>
      )}

      {h && (
        <Link
          href="/app/agreements"
          className="mt-3.5 block"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: 16,
          }}
        >
          <div className="flex items-baseline justify-between">
            <span style={{ fontSize: 15, fontWeight: 600 }}>取り決め</span>
            <span style={{ fontSize: 13, color: "var(--text-sub)" }}>
              {h.decided > 0
                ? `${h.topics.length}つのうち${h.decided}つ`
                : "話し合うことがある項目"}
            </span>
          </div>

          {/* ★1件でも決まってから出す。0本のバーを突きつけない（L-2） */}
          {h.decided > 0 && (
            <div className="mt-2.5 flex gap-[3px]">
              {h.topics.map((t) => (
                <div
                  key={t.topic}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: t.status === "AGREED" ? "var(--agree)" : "#E8DCCB",
                  }}
                />
              ))}
            </div>
          )}

          <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 10 }}>
            全部を決める必要は、ありません。
            <br />
            ひとつ決まれば、それだけで書面にできます。
          </p>
        </Link>
      )}

      {/* ★書きはじめる入口 */}
      <Link
        href="/app/consult"
        className="mt-3.5 block"
        style={{
          background: "var(--bubble-ai)",
          border: "1px dashed #DCC7A6",
          borderRadius: 20,
          padding: 18,
        }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/character/capybara-sit.png"
            alt=""
            width={40}
            height={40}
            className="rounded-full object-cover"
            style={{ width: 40, height: 40 }}
          />
          <p style={{ fontSize: 15, lineHeight: 1.7 }}>
            話したいことがあれば、いつでも書いてください。
          </p>
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

      <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 14 }}>
        直近の予定は「これから」にまとめてあります。
      </p>
    </div>
  );
}
