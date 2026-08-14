"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LIVING_ARRANGEMENTS, LIVING_LABEL, LIVING_PURPOSE_NOTE } from "@/domain/case/living";
import { toIncomeBand, INCOME_BAND_NOTE } from "@/domain/income/band";

/**
 * A-3 途中で伺う（お子さん・同居・年収）
 *
 * ★養育費を入力しようとしたとき、算定表に要る情報が無ければ**その場で伺う。**
 *   オンボーディングの通り道からは外した。
 *
 * ★3つを1枚に積み、いま答えるものだけを開く。
 *   答え終わった項目は上に畳まれ、これからのものは薄い。
 *   **残りが何問かが、常に見えている状態**にする。
 *
 * ★★ 出口を2つ用意する。
 *     ・この質問を飛ばす      … 次へ進む
 *     ・目安は出さずに入力へ戻る … **全部やめる**
 *   後者が無いと、入り込んだ人が抜けられない。
 *
 * ★「目安が出ないと決められません」とは書かない。**実質的な強制になる。**
 */

type Step = "CHILDREN" | "LIVING" | "INCOME";

const STEP_TITLE: Record<Step, string> = {
  CHILDREN: "お子さんのこと",
  LIVING: "いま、どちらで暮らしていますか",
  INCOME: "年収",
};

export function NeedsIntake({
  caseId,
  missing,
  backTo,
}: {
  caseId: string;
  /** ★足りないものだけを並べる。埋まっているものを聞き直さない */
  missing: Step[];
  /** ★全部やめたときの戻り先 */
  backTo: string;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Step[]>([]);

  const step = missing[i];
  const next = () => {
    // ★最後まで来たら入力へ戻す。伺いっぱなしにしない
    if (i + 1 >= missing.length) router.push(backTo);
    else setI(i + 1);
  };
  const finish = (s: Step) => {
    setDone((d) => [...d, s]);
    next();
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5">
      <div className="flex items-start gap-2.5">
        <Image
          src="/character/capybara.png"
          alt=""
          width={26}
          height={26}
          style={{ width: 26, height: 26, flexShrink: 0 }}
        />
        <p style={{ fontSize: 13.5, lineHeight: 1.9 }}>
          養育費の目安をお出しするために、いくつか伺います。
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {missing.map((s, n) => {
          const answered = done.includes(s);
          const active = s === step;
          return (
            <div
              key={s}
              style={{
                background: active ? "var(--surface)" : "var(--surface-2)",
                border: `1px solid ${active ? "var(--agree)" : "var(--border-subtle)"}`,
                borderRadius: "var(--r-md)",
                padding: active ? "15px 16px" : "12px 15px",
                // ★これからのものは薄く。残りが何問かは見えている
                opacity: !active && !answered ? 0.55 : 1,
              }}
            >
              <div className="flex items-baseline justify-between">
                <span style={{ fontSize: active ? 15 : 13.5, fontWeight: active ? 600 : 400 }}>
                  {STEP_TITLE[s]}
                </span>
                {answered && (
                  <span style={{ fontSize: 11.5, color: "var(--agree-text)" }}>伺いました</span>
                )}
              </div>

              {active && (
                <div className="mt-3">
                  {s === "CHILDREN" && (
                    <Children caseId={caseId} busy={busy} setBusy={setBusy} onDone={() => finish(s)} />
                  )}
                  {s === "LIVING" && (
                    <Living caseId={caseId} busy={busy} setBusy={setBusy} onDone={() => finish(s)} />
                  )}
                  {s === "INCOME" && (
                    <Income busy={busy} setBusy={setBusy} onDone={() => finish(s)} />
                  )}

                  {/* ★出口 その1：この質問だけ飛ばす */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={next}
                    className="mt-3 w-full"
                    style={{ fontSize: 13, color: "var(--text-sub)", minHeight: 44 }}
                  >
                    この質問を飛ばす
                  </button>
                </div>
              )}

              {!active && !answered && n === i + 1 && (
                <p style={{ fontSize: 11.5, color: "var(--text-sub)", marginTop: 4 }}>
                  このあとに伺います
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ★出口 その2：全部やめる。これが無いと、入り込んだ人が抜けられない */}
      <a
        href={backTo}
        className="mt-4 grid place-items-center"
        style={{
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          borderRadius: "var(--r-full)",
          minHeight: 46,
          fontSize: 13.5,
        }}
      >
        目安は出さずに入力へ戻る
      </a>

      {/* ★不利益として書かない */}
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
        目安が無くても、月額はお決めになれます。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

const field: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  minHeight: 44,
  fontSize: 14,
  width: "100%",
};

const primary: React.CSSProperties = {
  background: "var(--agree-bg)",
  border: "1px solid var(--agree)",
  borderRadius: "var(--r-full)",
  minHeight: 46,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--agree-text)",
  width: "100%",
};

type Sub = { busy: boolean; setBusy: (b: boolean) => void; onDone: () => void };

function Children({ caseId, busy, setBusy, onDone }: Sub & { caseId: string }) {
  const [rows, setRows] = useState([{ year: "", month: "" }]);
  const ok = rows.every(
    (r) => /^\d{4}$/.test(r.year) && /^\d{1,2}$/.test(r.month) && +r.month >= 1 && +r.month <= 12,
  );

  const save = async () => {
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/children`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          children: rows.map((r) => ({
            birthDate: `${r.year}-${String(r.month).padStart(2, "0")}-01`,
          })),
        }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)" }}>
        算定表は、人数と年齢で分かれています。お名前は伺いません。
      </p>
      {rows.map((r, n) => (
        <div key={n} className="mt-2.5">
          {rows.length > 1 && (
            <p style={{ fontSize: 11.5, color: "var(--text-sub)" }}>{n + 1}人目</p>
          )}
          {/* ★何を入れる欄なのかを、placeholder に頼らない。
                 入力すると消える文字は、ラベルの代わりにならない */}
          <div className="mt-1 flex items-end gap-2">
            <label style={{ flex: 1, fontSize: 11.5, color: "var(--text-sub)" }}>
              生まれた年
              <input
                inputMode="numeric"
                value={r.year}
                placeholder="2015"
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === n ? { ...x, year: e.target.value } : x)))
                }
                className="mt-1"
                style={field}
              />
            </label>
            <label style={{ width: 96, fontSize: 11.5, color: "var(--text-sub)" }}>
              月
              <input
                inputMode="numeric"
                value={r.month}
                placeholder="4"
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === n ? { ...x, month: e.target.value } : x)))
                }
                className="mt-1"
                style={field}
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { year: "", month: "" }])}
        className="mt-2"
        style={{ fontSize: 12.5, color: "var(--text-sub)", minHeight: 40 }}
      >
        お子さんを追加する
      </button>
      <button
        type="button"
        disabled={!ok || busy}
        onClick={() => void save()}
        className="mt-1 disabled:opacity-45"
        style={primary}
      >
        続ける
      </button>
    </>
  );
}

function Living({ caseId, busy, setBusy, onDone }: Sub & { caseId: string }) {
  const save = async (living: string) => {
    setBusy(true);
    try {
      await fetch(`/api/cases/${caseId}/living`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ living }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {LIVING_ARRANGEMENTS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={busy}
            onClick={() => void save(l)}
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              borderRadius: "var(--r-md)",
              minHeight: 46,
              fontSize: 13.5,
              padding: "0 14px",
              textAlign: "left",
            }}
          >
            {LIVING_LABEL[l]}
          </button>
        ))}
      </div>
      {/* ★用途をその一点に限る */}
      <p
        style={{
          fontSize: 11.5,
          lineHeight: 1.9,
          color: "var(--text-sub-2)",
          marginTop: 10,
          borderTop: "1px dashed var(--border-dashed)",
          paddingTop: 8,
        }}
      >
        {LIVING_PURPOSE_NOTE}
      </p>
    </>
  );
}

/** ★第2弾の帯の解をそのまま。**変換の図は必須** */
function Income({ busy, setBusy, onDone }: Sub) {
  const [raw, setRaw] = useState("");
  const yen = Number(raw.replace(/[^0-9]/g, ""));
  const band = raw !== "" && Number.isFinite(yen) && yen >= 0 ? toIncomeBand(yen) : null;

  const save = async () => {
    setBusy(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ annualIncomeYen: yen }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-sub)" }}>
        源泉徴収票の「支払金額」をご覧ください。
      </p>
      <input
        inputMode="numeric"
        value={raw}
        placeholder="4380000"
        onChange={(e) => setRaw(e.target.value)}
        className="mt-2.5"
        style={{ ...field, fontSize: 16, minHeight: 48 }}
      />

      {/* ★★ 変換の図（第2弾 C の解）。
             「安全です」と書く代わりに、**何が越えるのかを実物で見せる。** */}
      <div
        className="mt-2.5"
        style={{ background: "var(--muted-bg)", borderRadius: "var(--r-sm)", padding: "11px 13px" }}
      >
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>入力した金額</span>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            {raw === "" ? "—" : `${yen.toLocaleString("ja-JP")}円`}
          </span>
        </div>
        {/* ★★ 相談の言葉とは、約束の種類が違う（2026-08-14）。
               相談は「整えて伝える」。**年収は、そもそも渡らない**（INV-2a）。
               ★同じ「届きません」でまとめると、どちらかが嘘になる。 */}
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          この金額は、お相手には知られません
        </p>
        <div
          className="mt-2 flex items-baseline justify-between"
          style={{ borderTop: "1px dashed var(--border-dashed)", paddingTop: 8 }}
        >
          <span style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>お相手に見える形</span>
          <span style={{ fontSize: 15, color: band ? "var(--agree-text)" : "var(--muted)" }}>
            {band ? `${band.replace("-", "〜")}万円` : "—"}
          </span>
        </div>
        {/* ★区分は暫定。実装にも同じ注記を持たせてある */}
        <p style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)", marginTop: 8 }}>
          {INCOME_BAND_NOTE}
        </p>
      </div>

      <button
        type="button"
        disabled={!band || busy}
        onClick={() => void save()}
        className="mt-3 disabled:opacity-45"
        style={primary}
      >
        続ける
      </button>
    </>
  );
}
