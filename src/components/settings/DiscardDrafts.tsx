"use client";

import { useState } from "react";

/**
 * ご自身の下書きを消す
 *
 * ★消せるのは、**渡していない自分の仮案だけ。**
 *
 *   お渡ししたものは消さない。相手が見ている。
 *   合意済みのものは消さない。**双方が合意したものを、片方が消せてはいけない。**
 *   変えるときは、取り決めの画面から変更を申し出る（K-6）。
 *
 * ★この操作は取り消せない。だから、**押す前に何が起きるかを書く。**
 *   「削除」と赤で書かない（第1弾の規約）。
 */
export function DiscardDrafts({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/drafts`, {
        method: "DELETE",
        headers: { "x-dev-party": partyId },
      });
      const d = res.ok ? ((await res.json()) as { removed: number }) : null;
      setDone(d?.removed ?? 0);
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
      }}
    >
      <p style={{ fontSize: 15 }}>取り決めの下書きを消す</p>
      <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
        まだお渡ししていない、ご自身の下書きだけを消します。
      </p>

      {/* ★何が消えないかを、消える話と同じ場所に書く */}
      <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 8 }}>
        お渡ししたものと、合意できた取り決めは消えません。
        合意したものを変えるときは、取り決めの画面からお申し出ください。
      </p>

      {done !== null ? (
        <p style={{ fontSize: 13, color: "var(--agree-text)", marginTop: 10 }}>
          {done === 0 ? "消せる下書きはありませんでした。" : `${done}件の下書きを消しました。`}
        </p>
      ) : asking ? (
        <>
          <p style={{ fontSize: 12.5, lineHeight: 1.9, marginTop: 10 }}>
            <strong>消した下書きは、元に戻せません。</strong>
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="flex-1 rounded-full disabled:opacity-45"
              style={{
                border: "1px solid var(--border-strong)",
                background: "var(--surface)",
                minHeight: 44,
                fontSize: 13.5,
              }}
            >
              消す
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAsking(false)}
              className="flex-1"
              style={{ fontSize: 13.5, color: "var(--text-sub)", minHeight: 44 }}
            >
              やめる
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="mt-2.5"
          style={{ fontSize: 12.5, color: "var(--text-sub)", textDecoration: "underline", minHeight: 36 }}
        >
          下書きを消す
        </button>
      )}
    </div>
  );
}
