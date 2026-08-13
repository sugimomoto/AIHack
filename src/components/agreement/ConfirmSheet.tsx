"use client";

import Image from "next/image";
import { Recap } from "./TopicForm";

/**
 * 渡す前・了承する前の確認シート（S-1b / S-3b）
 *
 * ★押し間違いを防ぐ一段だが、**重々しくしない。**
 *   警告色も感嘆符も赤も使わない。確認は**内容の再掲**が主である。
 *   何が渡るのかを、渡る形のまま見せる。
 *
 * ★★「取り消せません」は、このシートの中に置く。
 *   ボタンの下に小さく書いても、押す前には読まれない。
 *
 * ★渡すときと了承するときで、同じ作法にする。
 *   （内容の再掲 ＋ 戻せない旨 ＋ 2択）
 *
 * ★取りやめる側は枠なし。**可逆な操作なので、重さを揃える必要がない。**
 *   （不可逆な選択肢どうしとは扱いが違う）
 */

export function ConfirmSheet({
  topic,
  payload,
  heading,
  caution,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  topic: string;
  payload: Record<string, unknown>;
  heading: string;
  caution: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(58,52,46,.28)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[420px] overflow-y-auto"
        style={{
          background: "var(--bg)",
          borderTopLeftRadius: "var(--r-xl)",
          borderTopRightRadius: "var(--r-xl)",
          padding: "20px 18px 24px",
          maxHeight: "86%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <Image
            src="/character/capybara.png"
            alt=""
            width={28}
            height={28}
            style={{ width: 28, height: 28, flexShrink: 0 }}
          />
          <p style={{ fontSize: 14.5, lineHeight: 1.85, fontWeight: 600 }}>{heading}</p>
        </div>

        <div className="mt-3.5">
          <Recap topic={topic} payload={payload} />
        </div>

        {/* ★戻せない旨。ボタンの下ではなく、ここに置く */}
        <div
          className="mt-3.5"
          style={{
            background: "var(--bubble-ai)",
            border: "1px solid #DCC7A6",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            fontSize: 12.5,
            lineHeight: 1.95,
          }}
        >
          {caution}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="mt-4 w-full disabled:opacity-45"
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
          {confirmLabel}
        </button>

        {/* ★枠なし。可逆な操作なので、重さを揃える必要がない */}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="mt-2 w-full"
          style={{ fontSize: 13.5, color: "var(--text-sub)", minHeight: 44 }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
