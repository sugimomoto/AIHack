"use client";

import Image from "next/image";
import { RangeBar } from "./RangeBar";
import { compare } from "@/domain/agreement/fields";

/**
 * お相手から別の案（S-4）
 *
 * ★★ 二つの金額を左右に並べない。並べた時点で交渉の卓になる。
 *
 * ★数量でない論点（面会交流など）は帯が引けない。
 *   代わりに**合っている項目を先に、多く見せる。**
 *   揃っていない項目は左右でなく上下に、同じ書式・同じ文字サイズで置く。
 *
 * ★差額を計算しない。「2万円の開き」と書けば、それが争点として立つ。
 */

const NOTE =
  "どちらかが正しい、というものではありません。事情が違えば、見ているものも違います。";

export function Divergence({
  topic,
  mine,
  theirs,
  range,
}: {
  topic: string;
  mine: Record<string, unknown>;
  theirs: Record<string, unknown>;
  range: { minYen: number; maxYen: number } | null;
}) {
  // ★養育費は帯で見せる。月額だけが数量
  const myYen = Number(mine.monthlyAmount);
  const theirYen = Number(theirs.monthlyAmount);
  const canBar =
    topic === "CHILD_SUPPORT" && range && Number.isFinite(myYen) && Number.isFinite(theirYen);

  if (canBar) {
    return (
      <div>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "18px 16px 12px",
          }}
        >
          <RangeBar
            range={range}
            marks={[
              // ★人ではなく案を主語にする。「あなた／お相手」と書かない
              { label: "お相手の案", yen: theirYen },
              { label: "はじめの案", yen: myYen },
            ]}
          />
        </div>
        <Note />
      </div>
    );
  }

  const { same, different } = compare(topic, mine, theirs);

  return (
    <div>
      {same.length > 0 && (
        <div className="flex items-start gap-2.5">
          <Image
            src="/character/capybara.png"
            alt=""
            width={24}
            height={24}
            style={{ width: 24, height: 24, flexShrink: 0 }}
          />
          <p style={{ fontSize: 13, lineHeight: 1.9 }}>
            {same.length + different.length}つのうち、{same.length}つは同じでした。
          </p>
        </div>
      )}

      <div
        className="mt-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "13px 15px",
        }}
      >
        {/* ★合っているものを先に、多く見せる */}
        {same.map((r) => (
          <div key={r.label} className="mb-2.5 flex items-baseline justify-between">
            <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{r.label}</span>
            <span style={{ fontSize: 13.5 }}>{r.value}</span>
            <span style={{ fontSize: 11.5, color: "var(--agree-text)" }}>同じ</span>
          </div>
        ))}

        {different.map((r) => (
          <div
            key={r.label}
            className="mt-3 pt-3"
            style={{ borderTop: "1px dashed var(--border-dashed)" }}
          >
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{r.label}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-sub)" }}>まだ揃っていません</span>
            </div>
            {/* ★左右でなく上下。同じ書式・同じ文字サイズ */}
            <div className="mt-1.5 pl-3">
              <div className="flex items-baseline gap-3">
                <span style={{ fontSize: 11.5, color: "var(--text-sub)", width: 56 }}>お相手</span>
                <span style={{ fontSize: 13.5 }}>{r.theirs ?? "—"}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span style={{ fontSize: 11.5, color: "var(--text-sub)", width: 56 }}>ご自身</span>
                <span style={{ fontSize: 13.5 }}>{r.mine ?? "—"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ★残りの作業量を示す */}
      {different.length > 0 && (
        <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-sub)", marginTop: 10 }}>
          揃っていない{different.length}つだけ、お話しになれば足ります。
        </p>
      )}
      <Note />
    </div>
  );
}

function Note() {
  return (
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
      {NOTE}
    </p>
  );
}
