import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDevParty, isDevPartySwitchEnabled } from "@/lib/party";

/**
 * ★開発用の当事者切替が、本番で通らないこと
 *
 * 両当事者の画面を並べて確認するには切替が要る。
 * しかし**本番で通ると、誰でも他人の当事者になれる。**
 * C1 が無意味になる。
 *
 * ★これは利便性の問題ではなく、安全性の問題である。
 *   通らないことをテストで固定する。
 *
 * ★このテストは実装より先に書かれた
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
});

describe("★開発用の当事者切替", () => {
  it("★本番環境では、有効化されていても効かない", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_PARTY_SWITCH", "true");
    expect(isDevPartySwitchEnabled()).toBe(false);
    expect(resolveDevParty("party_dev_a")).toBeNull();
  });

  it("★開発環境でも、明示的に有効化しなければ効かない", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_PARTY_SWITCH", "");
    expect(isDevPartySwitchEnabled()).toBe(false);
    expect(resolveDevParty("party_dev_a")).toBeNull();
  });

  it("開発環境で明示的に有効化したときのみ効く", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_PARTY_SWITCH", "true");
    expect(isDevPartySwitchEnabled()).toBe(true);
    expect(resolveDevParty("party_dev_a")).toBe("party_dev_a");
  });

  it("★有効でも、空の指定は解決しない", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_PARTY_SWITCH", "true");
    expect(resolveDevParty(null)).toBeNull();
    expect(resolveDevParty("")).toBeNull();
  });

  it("★true 以外の値では有効にならない", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const v of ["1", "yes", "TRUE", "on"]) {
      vi.stubEnv("ALLOW_DEV_PARTY_SWITCH", v);
      expect(isDevPartySwitchEnabled()).toBe(false);
    }
  });
});
