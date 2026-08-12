/**
 * 公開されている自分のURLを組み立てる
 *
 * ★`req.url` はコンテナ内部のアドレス（0.0.0.0:8080）になる。
 *   Cloud Run のような前段に代理を置く構成では、これで転送先を作ると
 *   **利用者がアクセスできない場所へ飛ばしてしまう**（実際に起きた）。
 *
 * 転送元のヘッダを見る。
 */
export function publicUrl(req: Request, path: string): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";

  if (host) return new URL(path, `${proto}://${host}`).toString();

  // ★ヘッダが無い場合の最後の拠り所
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) return new URL(path, base).toString();

  return new URL(path, req.url).toString();
}
