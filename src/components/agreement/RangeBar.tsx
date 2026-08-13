"use client";

/**
 * 算定表の帯（S-4）
 *
 * ★★ 二つの金額を左右に並べない。**並べた時点で交渉の卓になる。**
 *   第三者の範囲の上に、両方の案を目盛として重ねる。
 *
 * ★守ること
 *   ・色も太さも同じ。どちらかを強調しない
 *   ・**差額を計算しない。**「2万円の開き」と書けば、それが争点として立つ
 *   ・ラベルは「あなた／お相手」ではなく「はじめの案／お相手の案」
 *     仮案モデルでは案に時間の順序がある。
 *     **人ではなく案を主語にすると、対立の構図が薄くなる**
 *   ・範囲外でも警告は出さない
 */

type Mark = { label: string; yen: number };

export function RangeBar({
  range,
  marks,
}: {
  range: { minYen: number; maxYen: number };
  marks: Mark[];
}) {
  // ★目盛が帯の外に出ても切り落とさない。両端に余白を取る
  const values = [range.minYen, range.maxYen, ...marks.map((m) => m.yen)];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.18, 5000);
  const from = lo - pad;
  const to = hi + pad;
  const at = (yen: number) => ((yen - from) / (to - from)) * 100;

  const man = (yen: number) =>
    yen % 10000 === 0 ? `${yen / 10000}万円` : `${yen.toLocaleString("ja-JP")}円`;

  // ★上下に振り分ける。左右に並べない
  const above = marks.filter((_, i) => i % 2 === 0);
  const below = marks.filter((_, i) => i % 2 === 1);

  return (
    <div>
      <div className="relative" style={{ height: above.length ? 44 : 0 }}>
        {above.map((m) => (
          <div
            key={m.label}
            className="absolute bottom-0"
            style={{
              left: `${at(m.yen)}%`,
              transform: "translateX(-50%)",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--text-sub)" }}>{m.label}</p>
            <p style={{ fontSize: 15.5 }}>{man(m.yen)}</p>
          </div>
        ))}
      </div>

      {/* 帯。★範囲部分だけ淡い緑 */}
      <div
        className="relative"
        style={{ height: 8, borderRadius: 4, background: "var(--border-subtle)" }}
      >
        <div
          className="absolute"
          style={{
            left: `${at(range.minYen)}%`,
            width: `${at(range.maxYen) - at(range.minYen)}%`,
            top: 0,
            bottom: 0,
            borderRadius: 4,
            background: "#CFDEC9",
          }}
        />
        {/* ★目盛。色も太さも同じ */}
        {marks.map((m) => (
          <div
            key={m.label}
            className="absolute"
            style={{
              left: `${at(m.yen)}%`,
              top: -2,
              width: 1,
              height: 12,
              background: "var(--muted)",
            }}
          />
        ))}
      </div>

      <div className="relative" style={{ height: below.length ? 44 : 0 }}>
        {below.map((m) => (
          <div
            key={m.label}
            className="absolute top-0"
            style={{
              left: `${at(m.yen)}%`,
              transform: "translateX(-50%)",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <p style={{ fontSize: 15.5 }}>{man(m.yen)}</p>
            <p style={{ fontSize: 11, color: "var(--text-sub)" }}>{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
