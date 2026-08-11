import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildContext,
  buildMediationContext,
  buildRelayContext,
} from "@/domain/context/builders";

/**
 * ★シグネチャの防御
 *
 * C1 の担保は「buildRelayContext が partyId を引数に取らない」ことに依存する。
 * 引数を1つ足すだけで担保が失われるため、シグネチャ自体を検証する。
 *
 * 「気をつける」ではなく「書けない」状態を、テストで固定する。
 */

describe("★ContextBuilder のシグネチャ", () => {
  it("buildContext は (snapshot, partyId) の2引数", () => {
    expect(buildContext.length).toBe(2);
  });

  it("★buildRelayContext は (snapshot, proposalId) の2引数。partyId を取らない", () => {
    expect(buildRelayContext.length).toBe(2);
  });

  it("★buildMediationContext は (snapshot, agreementItemId) の2引数。partyId を取らない", () => {
    expect(buildMediationContext.length).toBe(2);
  });

  describe("ソース上の防御", () => {
    const src = readFileSync("src/domain/context/builders.ts", "utf8");

    /** コメントを除去する（規約を説明するコメントに反応しないため） */
    function stripComments(code: string): string {
      return code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    }

    /** 関数定義の本体を、コメントを除いて切り出す */
    function bodyOf(name: string): string {
      const i = src.indexOf(`export function ${name}(`);
      expect(i, `${name} が見つかりません`).toBeGreaterThan(-1);
      const rest = src.slice(i);
      const end = rest.indexOf("\n}\n");
      return stripComments(rest.slice(0, end));
    }

    it("★buildRelayContext のシグネチャに partyId が現れない", () => {
      const sig = bodyOf("buildRelayContext").split(")")[0];
      expect(sig).not.toMatch(/partyId/);
    });

    it("★buildMediationContext のシグネチャに partyId が現れない", () => {
      const sig = bodyOf("buildMediationContext").split(")")[0];
      expect(sig).not.toMatch(/partyId/);
    });

    it("★どのビルダーも contactInfos を参照しない（INV-2）", () => {
      for (const n of ["buildContext", "buildRelayContext", "buildMediationContext"]) {
        expect(bodyOf(n), `${n} が contactInfos を参照しています`).not.toMatch(
          /contactInfos/,
        );
      }
    });

    it("★どのビルダーも annualIncome を参照しない（INV-2a）", () => {
      for (const n of ["buildContext", "buildRelayContext", "buildMediationContext"]) {
        expect(bodyOf(n), `${n} が annualIncome を参照しています`).not.toMatch(
          /annualIncome/,
        );
      }
    });

    it("★取次ぎ・調停は messages を参照しない（INV-1）", () => {
      for (const n of ["buildRelayContext", "buildMediationContext"]) {
        expect(bodyOf(n), `${n} が messages を参照しています`).not.toMatch(
          /snap\.messages/,
        );
      }
    });
  });
});
