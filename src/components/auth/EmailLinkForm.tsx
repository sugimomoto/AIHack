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

/** ★何が起きたのかを、利用者の言葉で説明する */
const EXPLAIN: Record<string, string> = {
  "auth/invalid-action-code":
    "このリンクはすでに使われたか、期限が切れています。もう一度お送りください。",
  "auth/expired-action-code": "リンクの期限が切れています。もう一度お送りください。",
  "auth/invalid-email": "メールアドレスが、リンクをお送りしたものと一致しません。",
  "auth/user-disabled": "このアカウントはご利用いただけません。",
};

export function EmailLinkForm({ mode }: { mode: "link" | "signin" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // ★メール内のリンクから戻ってきた場合の処理
  useEffect(() => {
    let alive = true;
    void (async () => {
      const auth = await firebaseAuth().catch(() => null);
      if (!auth || !alive) return;
      if (!isSignInWithEmailLink(auth, window.location.href)) return;

      // ★リンクを別のブラウザで開くと、送信時に保存したアドレスが無い。
      //   その場合は入力していただく（Firebase の仕様上、照合に必要）。
      const saved =
        window.localStorage.getItem(KEY) ||
        window.prompt("確認のため、リンクをお送りしたメールアドレスをご入力ください") ||
        "";
      if (!saved) {
        setMessage("メールアドレスが確認できませんでした。もう一度お試しください。");
        setState("error");
        return;
      }

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
        } else if (res.status === 404) {
          // ★本人確認は通ったが、当方に紐づく当事者がいない。
          //   「登録してから戻る」という順序を、ここで初めて知る人がいる。
          setMessage(
            "このメールアドレスに紐づくご利用が見つかりませんでした。はじめてお使いの場合は、まず「はじめる」からお進みください。",
          );
          setState("error");
        } else {
          const d = (await res.json()) as { error?: string };
          setMessage(d.error ?? "うまくいきませんでした");
          setState("error");
        }
      } catch (e) {
        // ★原因が分からないと直せない。Firebase のエラーコードを出す。
        //   コード自体に個人情報は含まれない。
        const code = (e as { code?: string })?.code ?? "";
        setMessage(EXPLAIN[code] ?? `うまくいきませんでした（${code || "原因不明"}）`);
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  const send = async () => {
    const addr = email.trim();
    if (!addr) return;
    setState("working");
    try {
      await sendSignInLinkToEmail(await firebaseAuth(), addr, {
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
