"use client";

import { useState } from "react";
import { AgreementView } from "@/components/agreement/AgreementView";
import { ChatView } from "@/components/chat/ChatView";
import { HomeView } from "@/components/home/HomeView";
import { ScopeSheet } from "@/components/scope/ScopeSheet";
import { TopicPicker } from "@/components/topic/TopicPicker";
import { BottomTab } from "@/components/ui/BottomTab";
import { AGREEMENTS, CONSULTATION_TITLE, EVENTS, SCENES } from "@/mock/scenario";
import { PARTY_LABEL, viewOf, type Party, type TabId } from "@/mock/types";

/**
 * 体験モックのシェル
 *
 * ★視点切替が本モックの最重要要件。
 *   「書いた言葉が相手に届かない」は、片側だけ見せても検証できない。
 */
export default function MockPage() {
  const [i, setI] = useState(0);
  const scene = SCENES[i];

  const [party, setParty] = useState<Party>(scene.suggest);
  const [tab, setTab] = useState<TabId>(scene.tab);
  const [topic, setTopic] = useState(false);

  // シーン移動時は推奨視点とタブに追従する
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setI(next);
    setParty(SCENES[next].suggest);
    setTab(SCENES[next].tab);
    setTopic(false);
  };

  const events = viewOf(EVENTS.slice(0, scene.upto + 1), party);
  const rows = AGREEMENTS[scene.agreements];

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--surface-2)" }}>
      {/* モック告知（常時表示） */}
      <div
        className="px-4 py-2 text-center"
        style={{
          background: "var(--muted-bg)",
          borderBottom: "1px solid var(--border)",
          fontSize: "11.5px",
          lineHeight: 1.7,
          color: "var(--text-sub-2)",
        }}
      >
        これはデザイン確認用のモックです。実際には動作しません。
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> </span>
        AIの応答はあらかじめ用意した文章です。
      </div>

      {/* 端末 */}
      <div className="flex flex-1 items-center justify-center p-0 sm:p-6">
        <div
          className="flex w-full flex-col overflow-hidden sm:w-[390px]"
          style={{
            background: "var(--bg)",
            height: "min(844px, calc(100dvh - 190px))",
            borderRadius: "var(--r-device)",
            border: "1px solid var(--border-strong)",
          }}
        >
          {tab === "home" && <HomeView events={events} rows={rows} />}

          {tab === "chat" &&
            (topic ? (
              <TopicPicker />
            ) : (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <ChatView events={events} title={CONSULTATION_TITLE} />
                </div>
                {scene.sheet === "scope" && <ScopeSheet />}
              </div>
            ))}

          {tab === "agreement" && <AgreementView rows={rows} />}

          {(tab === "schedule" || tab === "settings") && (
            <div className="grid flex-1 place-items-center px-8 text-center">
              <p style={{ fontSize: "14px", color: "var(--text-sub)", lineHeight: 1.9 }}>
                この画面は準備中です。
                <br />
                今回のモックには含まれていません。
              </p>
            </div>
          )}

          <BottomTab
            active={tab}
            onChange={(t) => {
              setTab(t);
              setTopic(false);
            }}
          />
        </div>
      </div>

      {/* 操作パネル */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex max-w-[560px] flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(i - 1)}
              disabled={i === 0}
              className="grid shrink-0 place-items-center rounded-full disabled:opacity-30"
              style={{ width: 44, height: 44, border: "1px solid var(--border)" }}
              aria-label="前の場面"
            >
              ◀
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p style={{ fontSize: "14.5px", fontWeight: 500 }}>
                {scene.no}. {scene.caption}
              </p>
              {scene.note && (
                <p style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>
                  {scene.note}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => go(i + 1)}
              disabled={i === SCENES.length - 1}
              className="grid shrink-0 place-items-center rounded-full disabled:opacity-30"
              style={{ width: 44, height: 44, border: "1px solid var(--border)" }}
              aria-label="次の場面"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="shrink-0" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
              視点
            </span>
            {(["NON_CUSTODIAL", "CUSTODIAL"] as Party[]).map((p) => {
              const on = party === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setParty(p)}
                  className="flex-1 rounded-full px-3"
                  style={{
                    minHeight: 44,
                    fontSize: "13px",
                    background: on ? "var(--agree-bg)" : "var(--surface)",
                    border: `1px solid ${on ? "var(--agree)" : "var(--border)"}`,
                    color: on ? "var(--agree-text)" : "var(--text-sub)",
                    fontWeight: on ? 500 : 400,
                  }}
                  aria-pressed={on}
                >
                  {PARTY_LABEL[p]}の画面
                </button>
              );
            })}
            <span className="shrink-0" style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>
              {i + 1}/{SCENES.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
