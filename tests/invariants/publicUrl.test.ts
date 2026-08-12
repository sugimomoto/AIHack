import { describe, expect, it } from "vitest";
import { publicUrl } from "@/lib/publicUrl";

/**
 * ★転送先が、利用者からアクセスできる場所であること
 *
 *   `req.url` はコンテナ内部のアドレス（0.0.0.0:8080）になる。
 *   これで転送先を作ると、**利用者がアクセスできない場所へ飛ばす**。
 *   実際に、確認用リンクが 0.0.0.0:8080 へ飛んでいた。
 *
 * ★このテストは、起きた不具合に対して書かれた
 */

const req = (headers: Record<string, string>) =>
  new Request("http://0.0.0.0:8080/api/demo-session?t=x", { headers });

describe("★公開URLの組み立て", () => {
  it("★転送元のホストを使う（内部アドレスを使わない）", () => {
    const u = publicUrl(req({ "x-forwarded-host": "aida.example", "x-forwarded-proto": "https" }), "/app");
    expect(u).toBe("https://aida.example/app");
    expect(u).not.toContain("0.0.0.0");
  });

  it("host しか無くても内部アドレスを使わない", () => {
    expect(publicUrl(req({ host: "aida.example" }), "/app")).toBe("https://aida.example/app");
  });

  it("既定は https", () => {
    expect(publicUrl(req({ "x-forwarded-host": "aida.example" }), "/app").startsWith("https://")).toBe(true);
  });

  it("クエリを保てる", () => {
    expect(publicUrl(req({ host: "aida.example" }), "/?e=link")).toBe("https://aida.example/?e=link");
  });

  it("ローカルでは http のまま扱える", () => {
    const u = publicUrl(req({ host: "localhost:3000", "x-forwarded-proto": "http" }), "/app");
    expect(u).toBe("http://localhost:3000/app");
  });
});
