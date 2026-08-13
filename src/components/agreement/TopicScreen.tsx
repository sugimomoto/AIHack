"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Recap, TopicForm } from "./TopicForm";
import { ConfirmSheet } from "./ConfirmSheet";
import { Divergence } from "./Divergence";
import { RangeBar } from "./RangeBar";
import { TopicIntro } from "./TopicIntro";
import { AgreementMoment } from "./AgreementMoment";
import { RevisionRequestForm } from "./RevisionRequestForm";
import { TOPIC_LABEL } from "@/domain/agreement/topics";
import { CLOSED_BANNER, CLOSED_NOTE, isClosed, screenStateOf } from "@/domain/agreement/screen";
import { SHARE_CAVEAT } from "@/domain/agreement/sharing";

/**
 * 論点ごとの画面（A-2）
 *
 * ★状態は domain（screenStateOf）が決める。ここでは描くだけ。
 *   条件が画面に散ると、どの状態が抜けているのか誰にも分からなくなる。
 *
 * ★下書きは、地の色ごと閉じる。トグルや鍵アイコン1つで示さない。
 *   渡した瞬間に、地と帯の2点が同時に変わる。
 *
 * ★「お相手に見ていただく」は一方向のボタン。トグルにしない。
 *   ON/OFF のスイッチにすると、取り消せるように見える。
 *   取り下げは、渡したあとの画面にある**別の操作**である。
 */

type View = {
  topic: string;
  ownPayload: Record<string, unknown> | null;
  otherPayload: Record<string, unknown> | null;
  otherSharedOn: string | null;
  ownSharedOn: string | null;
  sharing: "NONE" | "DRAFT" | "SHARED" | "WITHDRAWN";
  agreement: { payload: Record<string, unknown>; agreedAt: string } | null;
  draft: { rangeText: string | null; notice: string | null; unverified: boolean } | null;
  range: { minYen: number; maxYen: number } | null;
};

export function TopicScreen({
  caseId,
  partyId,
  topic,
}: {
  caseId: string;
  partyId: string;
  topic: string;
}) {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"SHARE" | "APPROVE" | null>(null);
  const [editing, setEditing] = useState(false);
  const [counter, setCounter] = useState(false);
  const [asking, setAsking] = useState(false);

  const fetchView = useCallback(async (): Promise<View | null> => {
    const res = await fetch(`/api/cases/${caseId}/agreement?topic=${topic}`, {
      headers: { "x-dev-party": partyId },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as View) : null;
  }, [caseId, partyId, topic]);

  const load = useCallback(async () => {
    const r = await fetchView();
    if (r) setV(r);
  }, [fetchView]);

  useEffect(() => {
    // ★アンマウント後に書き込まない
    let alive = true;
    void fetchView().then((r) => {
      if (alive && r) setV(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchView]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/terms`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-party": partyId },
        body: JSON.stringify({ topic, ...body }),
      });
      if (!res.ok) console.error("[terms]", await res.text());
      setSheet(null);
      setEditing(false);
      setCounter(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!v) return null;

  const state = screenStateOf({
    agreed: v.agreement !== null,
    ownPayload: v.ownPayload,
    otherPayload: v.otherPayload,
    sharing: v.sharing,
  });
  const closed = isClosed(state);
  const label = TOPIC_LABEL[topic as keyof typeof TOPIC_LABEL] ?? "取り決め";

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      // ★下書きと取り下げは、地の色ごと閉じる（準備モードと同じ手法）
      style={{ background: closed ? "var(--surface-2)" : "var(--bg)" }}
    >
      <header className="px-4 pb-1 pt-4">
        <Link href="/app/agreements" style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
          ← 取り決め
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{label}</h1>
      </header>

      {/* ★S-1 / S-5：鍵つきの帯。取り下げのときだけ文言が違う */}
      {closed && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid #DCC7A6",
            borderRadius: "var(--r-md)",
            margin: "0 16px 14px",
            padding: "10px 13px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <LockIcon />
          <span style={{ fontSize: 12.5, lineHeight: 1.8 }}>
            {CLOSED_BANNER[state as "DRAFT" | "WITHDRAWN"]}
          </span>
        </div>
      )}

      <div className="px-4 pb-10">
        {/* ------------------------------------------------ 未入力／書き直し */}
        {(state === "EMPTY" || editing || counter) && (
          <TopicForm
            topic={topic}
            initial={counter ? v.otherPayload : v.ownPayload}
            busy={busy}
            intro={<TopicIntro topic={topic} />}
            onSave={(payload) => void act({ action: "SAVE", payload })}
          />
        )}

        {/* ------------------------------------------------ 下書き／取り下げ */}
        {closed && !editing && v.ownPayload && (
          <>
            <Recap topic={topic} payload={v.ownPayload} />

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
              {CLOSED_NOTE[state as "DRAFT" | "WITHDRAWN"]}
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() => setSheet("SHARE")}
              className="mt-4 w-full"
              style={{
                background: "var(--agree-bg)",
                border: "1px solid var(--agree)",
                borderRadius: "var(--r-full)",
                minHeight: 50,
                fontSize: 15,
                fontWeight: 600,
                color: "var(--agree-text)",
              }}
            >
              お相手に見ていただく
            </button>

            {/* ★「直す」と「このことを相談する」を同じ重さで並べる */}
            <div className="mt-2.5 flex gap-2">
              <SecondaryButton onClick={() => setEditing(true)}>直す</SecondaryButton>
              <ConsultLink topic={topic} />
            </div>
          </>
        )}

        {/* ------------------------------------------------ お渡ししたあと（S-2） */}
        {state === "SHARED" && v.ownPayload && (
          <>
            {v.ownSharedOn && (
              <p style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 10 }}>
                {jp(v.ownSharedOn)}にお渡ししました。
              </p>
            )}
            <Recap topic={topic} payload={v.ownPayload} />

            <div
              className="mt-3.5"
              style={{
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                padding: "13px 15px",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.9 }}>お相手のご返事をお待ちしています</p>
              {/* ★既読を持たない。持てないことを、そのまま書く */}
              <p
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.95,
                  color: "var(--text-sub-2)",
                  marginTop: 6,
                }}
              >
                ご覧になったかどうかは、こちらでは分かりません。お急ぎいただくご連絡はしません。期限もありません。
              </p>
            </div>

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
              お渡ししているあいだは、直せません。直したいときは、いったん取り下げてください。
            </p>

            {/* ★同じ枠。取り消しの操作を目立たせない */}
            <div className="mt-4 flex gap-2">
              <ConsultLink topic={topic} />
              <SecondaryButton
                onClick={() => void act({ action: "WITHDRAW" })}
                disabled={busy}
              >
                取り下げる
              </SecondaryButton>
            </div>
          </>
        )}

        {/* ------------------------------------------------ お相手の案（S-3） */}
        {state === "INCOMING" && !counter && v.otherPayload && (
          <>
            <IncomingCard
              topic={topic}
              payload={v.otherPayload}
              sharedOn={v.otherSharedOn}
            />

            {/* ★算定表の帯。範囲の中にあることが見えれば、判断材料になる */}
            {v.draft?.rangeText && (
              <div
                className="mt-3"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "12px 14px",
                }}
              >
                {v.range && typeof v.otherPayload.monthlyAmount === "number" && (
                  <div className="mb-2">
                    {/* ★案の値を目盛として重ねる。範囲外でも警告は出さない */}
                    <RangeBar
                      range={v.range}
                      marks={[{ label: "お相手の案", yen: v.otherPayload.monthlyAmount }]}
                    />
                  </div>
                )}
                <p style={{ fontSize: 12, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {v.draft.rangeText}
                </p>
              </div>
            )}

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
              いま決めなくてかまいません。ご返事があるまで、この案は残ります。
            </p>

            {/* ★枠線・面積・文字サイズをすべて同一にする。了承を強調しない */}
            <div className="mt-4 flex flex-col gap-2">
              <SecondaryButton onClick={() => setSheet("APPROVE")} disabled={busy} full>
                この内容で了承する
              </SecondaryButton>
              <SecondaryButton onClick={() => setCounter(true)} disabled={busy} full>
                別の案を出す
              </SecondaryButton>
              <Link
                href={`/app/consult/new?topic=${topic}`}
                className="w-full text-center"
                style={{ fontSize: 13, color: "var(--text-sub)", minHeight: 44, paddingTop: 12 }}
              >
                このことを相談する
              </Link>
            </div>
          </>
        )}

        {/* ------------------------------------------------ 別の案（S-4） */}
        {state === "DIVERGED" && v.ownPayload && v.otherPayload && (
          <>
            <Divergence
              topic={topic}
              mine={v.ownPayload}
              theirs={v.otherPayload}
              range={v.range}
            />
            <div className="mt-4 flex flex-col gap-2">
              <SecondaryButton onClick={() => setSheet("APPROVE")} disabled={busy} full>
                お相手の案で了承する
              </SecondaryButton>
              <ConsultLink topic={topic} full />
            </div>
          </>
        )}

        {/* ------------------------------------------------ 合意済（N-1 / K-6） */}
        {state === "AGREED" && v.agreement && (
          <>
            <AgreementMoment
              payload={v.agreement.payload}
              agreedOn={v.agreement.agreedAt}
              topic={topic}
            />
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setAsking(true)}
                style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline" }}
              >
                変更を申し出る
              </button>
              <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 6 }}>
                変更には、お相手の同意が必要です。
              </p>
            </div>
            {asking && (
              <RevisionRequestForm
                caseId={caseId}
                partyId={partyId}
                topic={topic}
                current={v.agreement.payload}
                onDone={() => {
                  setAsking(false);
                  void load();
                }}
                onCancel={() => setAsking(false)}
              />
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------ 確認シート */}
      {sheet === "SHARE" && v.ownPayload && (
        <ConfirmSheet
          topic={topic}
          payload={v.ownPayload}
          heading="この内容を、お相手にお見せします。"
          caution={<strong>{SHARE_CAVEAT}</strong>}
          confirmLabel="お見せする"
          cancelLabel="まだ渡さない"
          busy={busy}
          onConfirm={() => void act({ action: "SHARE" })}
          onCancel={() => setSheet(null)}
        />
      )}

      {sheet === "APPROVE" && v.otherPayload && (
        <ConfirmSheet
          topic={topic}
          payload={v.otherPayload}
          heading="この内容で、取り決めになります。"
          caution={
            <>
              取り決めになったあとで変えるには、お相手の同意が要ります。
              <br />
              公正証書の原案にも入ります。
            </>
          }
          confirmLabel="了承する"
          cancelLabel="まだ決めない"
          busy={busy}
          onConfirm={() => void act({ action: "APPROVE" })}
          onCancel={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/** ★お相手が作られた案は、封書カードの形で置く（第1弾③と同じ） */
function IncomingCard({
  topic,
  payload,
  sharedOn,
}: {
  topic: string;
  payload: Record<string, unknown>;
  sharedOn: string | null;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{
          background: "var(--envelope-head)",
          borderBottom: "1px dashed var(--border-dashed)",
        }}
      >
        <EnvelopeIcon />
        <span style={{ fontSize: 12.5, color: "var(--agree-text)", fontWeight: 600 }}>
          お相手が作られた案
        </span>
        {sharedOn && (
          <span style={{ fontSize: 11.5, color: "var(--text-sub)", marginLeft: "auto" }}>
            {jp(sharedOn)}
          </span>
        )}
      </div>
      <div className="px-3.5 py-3">
        <Recap topic={topic} payload={payload} />
      </div>
    </div>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : "flex-1"} rounded-full disabled:opacity-45`}
      style={{
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        minHeight: 46,
        fontSize: 13.5,
      }}
    >
      {children}
    </button>
  );
}

function ConsultLink({ topic, full }: { topic: string; full?: boolean }) {
  return (
    <Link
      href={`/app/consult/new?topic=${topic}`}
      className={`${full ? "w-full" : "flex-1"} flex items-center justify-center rounded-full`}
      style={{
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        minHeight: 46,
        fontSize: 13.5,
      }}
    >
      このことを相談する
    </Link>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="var(--ai-text)" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--ai-text)" strokeWidth="1.6" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--agree-text)" strokeWidth="1.6" />
      <path d="m3 7 9 6 9-6" stroke="var(--agree-text)" strokeWidth="1.6" />
    </svg>
  );
}

function jp(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : iso;
}
