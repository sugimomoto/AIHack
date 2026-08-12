"use client";

import { useEffect, useState } from "react";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebaseClient";

/**
 * メールリンクでのサインイン
 *
 * ★パスワードを一切預かりません。
 *   このアプリは住所・年収・子の情報を持ちます。
 *   **漏れて困るものを、そもそも預からない。**
 *
 * @param mode "link"  … いまの当事者にアカウントを結びつける
 * @param mode "signin" … 別の端末から戻る
 */
const KEY = "aida_signin_email";

export function EmailLinkForm({ mode }: { mode: "link" | "signin" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // ★メール内のリンクから戻ってきた場合の処理
  useEffect(() => {
    const auth = firebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const saved = window.localStorage.getItem(KEY) ?? window.prompt("確認のため、メールアドレスをもう一度ご入力ください") ?? "";
    if (!saved) return;

    void (async () => {
      // ★同期的に state を触らない（cascading render を避ける）
      setState("working");
      try {
        const cred = await signInWithEmailLink(auth, saved, window.location.href);
        const idToken = await cred.user.getIdToken();
        const res = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        window.localStorage.removeItem(KEY);
        if (res.ok) {
          setState("done");
          window.location.href = "/app";
        } else {
          const d = (await res.json()) as { error?: string };
          setMessage(d.error ?? "うまくいきませんでした");
          setState("error");
        }
      } catch {
        setMessage("リンクの有効期限が切れているかもしれません");
        setState("error");
      }
    })();
  }, [mode]);

  const send = async () => {
    const addr = email.trim();
    if (!addr) return;
    setState("working");
    try {
      await sendSignInLinkToEmail(firebaseAuth(), addr, {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(KEY, addr);
      setState("sent");
    } catch {
      setMessage("送信できませんでした。アドレスをご確認ください");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p style={{ fontSize: 13.5, lineHeight: 1.95, color: "var(--text-sub)" }}>
        {email} にリンクをお送りしました。
        <br />
        メールを開いて、リンクを押してください。
        <br />
        <span style={{ fontSize: 12, color: "var(--text-sub-2)" }}>
          このメールには、お子さんの件であることは書かれていません。
        </span>
      </p>
    );
  }

  return (
    <>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        className="w-full"
        style={{
          background: "var(--surface-2)",
          borderRadius: "var(--r-md)",
          padding: "13px 15px",
          minHeight: 48,
          fontSize: 15,
        }}
      />
      <button
        type="button"
        disabled={state === "working" || !email.trim()}
        onClick={() => void send()}
        className="mt-3 w-full disabled:opacity-45"
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
        {state === "working" ? "確認しています…" : "リンクを送る"}
      </button>
      {message && (
        <p style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--attention-text)", marginTop: 10 }}>
          {message}
        </p>
      )}
      <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--text-sub-2)", marginTop: 12 }}>
        パスワードは設けません。メールに届くリンクだけでお入りいただけます。
      </p>
    </>
  );
}
