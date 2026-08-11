import { describe, expect, it } from "vitest";
import {
  AGREEMENT_EVENTS,
  AGREEMENT_STATUSES,
  InvalidTransitionError,
  allowedEvents,
  canTransition,
  isDocumentable,
  isTerminal,
  transition,
  type AgreementEvent,
  type AgreementStatus,
} from "@/domain/agreement/stateMachine";

/**
 * ★合意は法的文書の基礎であるため、状態遷移は全パスを網羅して検証する。
 * @see .steering/20260811-s1-data/requirements.md AC-04 / AC-05
 */

/** 仕様上あるべき遷移（設計書の状態遷移図と1対1に対応させる） */
const EXPECTED: [AgreementStatus, AgreementEvent, AgreementStatus][] = [
  ["NOT_STARTED", "PROPOSE", "IN_NEGOTIATION"],
  ["IN_NEGOTIATION", "COUNTER", "IN_NEGOTIATION"],
  ["IN_NEGOTIATION", "ACCEPT", "AGREED"],
  ["IN_NEGOTIATION", "ESCALATE", "ESCALATED"],
  ["AGREED", "REQUEST_REVISION", "REVISION_REQUESTED"],
  ["AGREED", "DETECT_DEVIATION", "DEVIATED"],
  ["REVISION_REQUESTED", "AGREE_REVISION", "AGREED"],
  ["REVISION_REQUESTED", "REVISION_FAILED", "IN_NEGOTIATION"],
  ["DEVIATED", "RECOVER", "AGREED"],
];

describe("合意の状態機械", () => {
  describe("正当な遷移", () => {
    it.each(EXPECTED)("%s --%s--> %s", (from, event, to) => {
      expect(transition(from, event)).toBe(to);
      expect(canTransition(from, event)).toBe(true);
    });
  });

  describe("★全組み合わせの網羅（仕様外はすべて拒否される）", () => {
    const allowed = new Set(EXPECTED.map(([f, e]) => `${f}|${e}`));

    it.each(
      AGREEMENT_STATUSES.flatMap((from) =>
        AGREEMENT_EVENTS.map((event) => [from, event] as const),
      ).filter(([from, event]) => !allowed.has(`${from}|${event}`)),
    )("%s --%s--> は拒否される", (from, event) => {
      expect(canTransition(from, event)).toBe(false);
      expect(() => transition(from, event)).toThrow(InvalidTransitionError);
    });

    it("検証した組み合わせが 状態数 × イベント数 と一致する", () => {
      expect(AGREEMENT_STATUSES.length * AGREEMENT_EVENTS.length).toBe(54);
    });
  });

  describe("終端状態", () => {
    it("ESCALATED は終端である（調停へ引き継いだ後はアプリ内で戻さない）", () => {
      expect(isTerminal("ESCALATED")).toBe(true);
      expect(allowedEvents("ESCALATED")).toEqual([]);
    });

    it("ESCALATED 以外は終端ではない", () => {
      for (const s of AGREEMENT_STATUSES.filter((x) => x !== "ESCALATED")) {
        expect(isTerminal(s)).toBe(false);
      }
    });
  });

  describe("到達可能性", () => {
    it("NOT_STARTED からすべての状態に到達できる", () => {
      const seen = new Set<AgreementStatus>(["NOT_STARTED"]);
      const queue: AgreementStatus[] = ["NOT_STARTED"];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const ev of allowedEvents(cur)) {
          const next = transition(cur, ev);
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect([...seen].sort()).toEqual([...AGREEMENT_STATUSES].sort());
    });
  });

  describe("公正証書に載る状態", () => {
    it("AGREED と DEVIATED のみ（逸脱中でも合意は有効である）", () => {
      expect(AGREEMENT_STATUSES.filter(isDocumentable).sort()).toEqual([
        "AGREED",
        "DEVIATED",
      ]);
    });
  });
});
