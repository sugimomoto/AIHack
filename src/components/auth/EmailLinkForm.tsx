"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import Link from "next/link";
import { firebaseAuth } from "@/lib/firebaseClient";

/**
 * メールリンクでのサインイン／サインアップ
 *
 * ★パスワードを一切預かりません。
 *   このアプリは住所・年収・子の情報を持ちます。
 *   **漏れて困るものを、そもそも預からない。**
 *
 * @param mode "signup" … ★はじめる。**本人確認が済んでからケースを作る**
 * @param mode "accept" … ★招待を受ける。**確認が済んでから参加が成立する**
 * @param mode "link"   … いまの当事者にアカウントを結びつける
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

export function EmailLinkForm({
  mode,
  acceptToken,
}: {
  mode: "signup" | "accept" | "link" | "signin";
  /** ★accept のときの招待トークン */
  acceptToken?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    "idle" | "sent" | "working" | "needEmail" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  /**
   * ★★ 入ったアドレスを、必ず見せる。
   *
   *   打ち間違えると、**新しい空のケースが作られる。**
   *   「データが消えた」ように見えるが、実際は**別人として入っている。**
   *   ★見せないと、本人にも気づけない。
   */
  const [entered, setEntered] = useState<{ email: string; resumed: boolean } | null>(null);

  /**
   * リンクを完了させる。
   *
   * ★★ Firebase の仕様上、**アドレスの照合は省けない。**
   *   リンクを拾った人が、宛先を知らないまま入れてしまうのを防ぐ仕組みである。
   *
   * ★だが以前は `window.prompt` で聞いていた。**素のダイアログは、この場に合わない。**
   *   そして**間違えたときにやり直せなかった**（prompt は一度きり）。
   *   → 画面の中で聞き、**違っていたら同じ場所で直せる**ようにした。
   */
  const complete = useCallback(
    async (addr: string) => {
      const auth = await firebaseAuth().catch(() => null);
      if (!auth) return;

      setState("working");
      setMessage(null);
      try {
        const cred = await signInWithEmailLink(auth, addr, window.location.href);
        const idToken = await cred.user.getIdToken();
        // ★リンクに載せたトークン。Cookie が無いときの拠り所になる
        const linkToken = new URLSearchParams(window.location.search).get("lt");

        // ★招待の受諾は、招待の API へ送る（本人確認つき）
        const at = acceptToken ?? new URLSearchParams(window.location.search).get("at");
        const url = mode === "accept" && at ? `/api/invite/${at}/accept` : `/api/auth/${mode}`;
        const body =
          mode === "accept"
            ? { action: "ACCEPT", idToken }
            : { idToken, ...(linkToken ? { linkToken } : {}) };

        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        window.localStorage.removeItem(KEY);

        if (res.ok) {
          setState("done");
          const d = (await res.json().catch(() => ({}))) as { resumed?: boolean };
          // ★★ はじめる／参加のときは、**入ったアドレスを見せてから進む。**
          //   黙って進むと、打ち間違いに気づけない
          if (mode === "signup" || mode === "accept") {
            setEntered({ email: cred.user.email ?? addr, resumed: Boolean(d.resumed) });
            return;
          }
          window.location.href = "/app";
          return;
        }

        if (res.status === 404) {
          // ★本人確認は通ったが、当方に紐づく当事者がいない
          setMessage(
            "このメールアドレスでのご利用が見つかりませんでした。はじめてお使いの場合は、トップの「はじめる」からお進みください。",
          );
          setState("error");
          return;
        }
        const d = (await res.json()) as { error?: string };
        setMessage(d.error ?? "うまくいきませんでした");
        setState("error");
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "";
        // ★★ アドレス違いは、やり直せる誤りである。**行き止まりにしない**
        if (code === "auth/invalid-email") {
          setMessage("リンクをお送りしたアドレスと一致しません。もう一度ご入力ください。");
          setState("needEmail");
          return;
        }
        // ★原因が分からないと直せない。Firebase のエラーコードを出す
        setMessage(EXPLAIN[code] ?? `うまくいきませんでした（${code || "原因不明"}）`);
        setState("error");
      }
    },
    [mode, acceptToken],
  );

  // ★メール内のリンクから戻ってきた場合の処理
  useEffect(() => {
    let alive = true;
    void (async () => {
      const auth = await firebaseAuth().catch(() => null);
      if (!auth || !alive) return;
      if (!isSignInWithEmailLink(auth, window.location.href)) return;

      // ★リンクを別のブラウザで開くと、送信時に保存したアドレスが無い。
      //   ★確認用リンクは e2eEmail を載せている。手動確認のたびに入力させない
      const known =
        new URLSearchParams(window.location.search).get("e2eEmail") ||
        window.localStorage.getItem(KEY);

      // ★分かっていれば、そのまま進む。無ければ**画面の中で伺う**
      if (known) void complete(known);
      else if (alive) setState("needEmail");
    })();
    return () => {
      alive = false;
    };
  }, [complete]);

  const send = async () => {
    const addr = email.trim();
    if (!addr) return;
    setState("working");
    try {
      // ★★ 結びつけのときは、当事者を指す短命トークンをリンクに載せる。
      //   リンクは**別のブラウザで開かれることがある**（メールアプリの内蔵ブラウザ等）。
      //   Cookie が無くても「誰の当事者か」が分かるようにしておく。
      //   ★トークン単体では何もできない。oobCode と揃って初めて結びつく。
      let back = `${window.location.origin}${window.location.pathname}`;
      // ★受諾のときは、戻り先に招待トークンを載せる（別のブラウザで開かれても続く）
      if (mode === "accept" && acceptToken) back += `?at=${encodeURIComponent(acceptToken)}`;
      if (mode === "link") {
        const t = await fetch("/api/auth/link-token", { method: "POST" })
          .then((r) => (r.ok ? (r.json() as Promise<{ token: string }>) : null))
          .catch(() => null);
        if (t?.token) back += `?lt=${encodeURIComponent(t.token)}`;
      }

      await sendSignInLinkToEmail(await firebaseAuth(), addr, {
        url: back,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(KEY, addr);
      setState("sent");
    } catch {
      setMessage("送信できませんでした。アドレスをご確認ください");
      setState("error");
    }
  };

  // ★★ 入ったアドレスを見せる。**打ち間違いに、ここで気づける**
  if (entered) {
    return (
      <div>
        <p style={{ fontSize: 15, lineHeight: 1.85, fontWeight: 600 }}>
          {entered.resumed ? "おかえりなさい。" : "はじめまして。"}
        </p>
        <div
          className="mt-3"
          style={{
            background: "var(--surface-2)",
            borderRadius: "var(--r-md)",
            padding: "13px 15px",
          }}
        >
          <p style={{ fontSize: 11.5, color: "var(--text-sub-2)" }}>お入りになったアドレス</p>
          <p style={{ fontSize: 15, marginTop: 4, wordBreak: "break-all" }}>{entered.email}</p>
        </div>

        {/* ★新規のときだけ言う。**打ち間違いは、ここでしか気づけない** */}
        {!entered.resumed && (
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.95,
              color: "var(--text-sub-2)",
              marginTop: 10,
              borderTop: "1px dashed var(--border-dashed)",
              paddingTop: 10,
            }}
          >
            このアドレスで、新しくはじめます。
            <br />
            <strong>以前お使いのアドレスと違う場合は、そちらでお入りください。</strong>
            前のご利用は、そのまま残っています。
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            // ★★ はじめた人は、3枚目（お相手を招待しますか）へ。
            //   第4弾の設計はオンボーディング3枚である。
            //   サインアップを1枚目に統合したとき、ここの接続が切れていた。
            //
            // ★受諾した人は、招待する相手がいない。そのままアプリへ。
            window.location.href = mode === "accept" ? "/app" : "/onboarding/invite";
          }}
          className="mt-4 w-full"
          style={{
            background: "var(--agree-bg)",
            border: "1px solid var(--agree)",
            borderRadius: "var(--r-full)",
            minHeight: 48,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--agree-text)",
          }}
        >
          続ける
        </button>

        {!entered.resumed && (
          <Link
            href="/"
            className="mt-2 grid place-items-center"
            style={{ fontSize: 13, color: "var(--text-sub)", minHeight: 44 }}
          >
            別のアドレスで入り直す
          </Link>
        )}
      </div>
    );
  }

  /**
   * ★リンクをお送りしたアドレスの確認
   *
   *   Firebase の仕様上、照合は省けない。
   *   **リンクを拾った人が、宛先を知らないまま入れるのを防ぐ仕組み**である。
   *   ★だから「なぜ聞くのか」を、その場に書く。
   */
  if (state === "needEmail") {
    return (
      <div>
        <p style={{ fontSize: 14.5, lineHeight: 1.85, fontWeight: 600 }}>
          リンクをお送りしたアドレスを、ご入力ください
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 8 }}>
          リンクを開いた画面が、お送りになった画面と違うためです。
          <br />
          ★ほかの方がリンクを開いても入れないように、確かめています。
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="mt-4 w-full"
          style={{
            background: "var(--surface-2)",
            borderRadius: "var(--r-md)",
            padding: "13px 15px",
            minHeight: 48,
            fontSize: 15,
          }}
        />
        {/* ★間違えても行き止まりにしない。同じ場所で直せる */}
        {message && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.9,
              color: "var(--attention-text)",
              marginTop: 10,
            }}
          >
            {message}
          </p>
        )}
        <button
          type="button"
          disabled={!email.trim()}
          onClick={() => void complete(email.trim())}
          className="mt-4 w-full disabled:opacity-45"
          style={{
            background: "var(--agree-bg)",
            border: "1px solid var(--agree)",
            borderRadius: "var(--r-full)",
            minHeight: 48,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--agree-text)",
          }}
        >
          確かめる
        </button>
        <p style={{ fontSize: 11.5, lineHeight: 1.9, color: "var(--muted)", marginTop: 10 }}>
          何度でもお試しいただけます。このリンクは、まだ使えます。
        </p>
      </div>
    );
  }

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
