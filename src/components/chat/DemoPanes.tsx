"use client";

import { useState } from "react";
import { CaseChat } from "@/components/chat/CaseChat";
import { AgreementPanel } from "@/components/agreement/AgreementPanel";
import { DocumentPanel } from "@/components/document/DocumentPanel";

/**
 * 両当事者を並べて確認する画面
 *
 * ★片側だけでは C1 を検証できない。
 *   「書いた言葉が相手に届かない」は、両方を同時に見て初めて確かめられる。
 *
 * ★この画面は開発用である。
 *   当事者の切替は `x-dev-party` ヘッダで行っており、
 *   本番では効かない（→ lib/party.ts）。
 */
const CASE_ID = "case_dev_001";

export function DemoPanes() {
  const [key, setKey] = useState(0);
  const bump = () => setKey((k) => k + 1);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--surface-2)" }}>
      <div
        className="px-4 py-2 text-center"
        style={{
          background: "var(--muted-bg)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11.5,
          lineHeight: 1.7,
          color: "var(--text-sub-2)",
        }}
      >
        開発用の確認画面です。実データに接続しています。
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> </span>
        左に書いた言葉は、右には届きません。合意に必要な事実だけが取次ぎとして現れます。
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:flex-row sm:justify-center">
        {[
          { partyId: "party_dev_a", label: "非監護親（Aさん）" },
          { partyId: "party_dev_b", label: "監護親（Bさん）" },
        ].map((p) => (
          <div
            key={p.partyId}
            className="flex w-full flex-col overflow-hidden sm:w-[390px]"
            style={{
              background: "var(--bg)",
              height: "min(760px, calc(100dvh - 90px))",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--border-strong)",
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <CaseChat caseId={CASE_ID} partyId={p.partyId} label={p.label} onChanged={bump} reloadKey={key} />
            </div>
            <AgreementPanel caseId={CASE_ID} partyId={p.partyId} reloadKey={key} onChanged={bump} />
            <DocumentPanel caseId={CASE_ID} partyId={p.partyId} reloadKey={key} />
          </div>
        ))}
      </div>
    </div>
  );
}
