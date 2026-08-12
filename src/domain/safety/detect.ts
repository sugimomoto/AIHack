/**
 * 安全の確保
 *
 * ★AIは判定しない。フラグを立てるだけである。
 *
 *   誤検知の帰結が取り消せない（通告を起点に家庭へ調査が入りうる）。
 *   見逃しも重い（子どもが危害を受け続ける）。
 *   **どちらの誤りも重いので、人が読む。**
 *
 * ★AIは説教しない。
 *   「そのような表現は不適切です」と返した瞬間、
 *   **C1の「何を書いてもいい」という約束が壊れる。**
 *   受け止めたうえで、届けない。それだけでよい。
 *
 * @see docs/legal-child-risk-research.md
 * @see docs/functional-design.md §5.9
 */

export const SAFETY_FLAGS = ["HARMFUL", "VICTIM_REPORT", "CHILD_RISK"] as const;
export type SafetyFlag = (typeof SAFETY_FLAGS)[number];

/**
 * ★排他的な「種別」ではなく、複数立ちうる「フラグ」にする。
 *
 *   児童虐待防止法2条4号：
 *   「児童が同居する家庭における配偶者に対する暴力」は児童虐待にあたる。
 *   **DVの訴えは、同時に子への危害でもありうる。**
 */
const PATTERNS: { flag: SafetyFlag; re: RegExp }[] = [
  // 加害的表現（この人が誰かを害しうる）
  { flag: "HARMFUL", re: /(殺して|殺す|死ね|殴ってやる|痛い目|後悔させて)/ },
  { flag: "HARMFUL", re: /(連れ去|さらって)/ },
  // 被害の訴え（この人が害されている）
  { flag: "VICTIM_REPORT", re: /(殴られ|叩かれ|蹴られ|暴力を(振るわれ|受け))/ },
  { flag: "VICTIM_REPORT", re: /(怖くて|恐ろしくて)[^。]{0,20}(会えな|外に出られ|眠れ)/ },
  { flag: "VICTIM_REPORT", re: /(つきまと|待ち伏せ|勝手に家に)/ },
  // 子への危害（★同居家庭でのDVを含む）
  { flag: "CHILD_RISK", re: /(子ども|子供|息子|娘)[^。]{0,15}(殴|叩|蹴|傷つけ|放置|食べさせて)/ },
  { flag: "CHILD_RISK", re: /子ども(の前|がいる前|の目の前)/ },
  { flag: "CHILD_RISK", re: /(子ども|子供|息子|娘)[^。]{0,10}(あざ|痣|やけど|怪我)/ },
];

/**
 * ★戻り値はフラグのみ。
 *   「どう応答すべきか」を返さない。返すと、AIの応答が変わり、
 *   本人に「見抜かれた」と伝わる。
 */
export function detectSafetyFlags(text: string): SafetyFlag[] {
  const hit = new Set<SafetyFlag>();
  for (const p of PATTERNS) if (p.re.test(text)) hit.add(p.flag);
  return [...hit];
}

/**
 * ★検知しても、その場では何も表示しない。
 *
 *   常設の窓口（案2）は既に出ている。検知に反応しない。
 *   反応すると、何も検知しなかった場合との差が生まれ、
 *   **「見抜かれた」という監視感になる。**
 *
 *   検知したときの提示（案3）は、**次に開いたときのホーム**に置く。
 *   本人に向けたものだとは明示しない。
 */
export function visibleChangeFor(_flags: readonly SafetyFlag[]): null {
  return null;
}

/** フラグが立てば、人が読む */
export function needsHumanReview(flags: readonly SafetyFlag[]): boolean {
  return flags.length > 0;
}

// ---------------------------------------------------------------------------

export type SafetyEvent = {
  caseId: string;
  partyId: string;
  flags: SafetyFlag[];
  /**
   * ★原文を保全する（FR-10）。
   *
   *   通告する場合、根拠が必要になる。
   *   **これは G-F（原文をログに出さない）の意図的な例外である。**
   *   ログではなく、専用の記録に置く。相手には決して越えない。
   */
  rawText: string;
  status: "PENDING_REVIEW" | "REVIEWED";
  createdAt: string;
};

/**
 * ★自動で通告する経路を作らない。
 *   通告するかどうかは、記録を読んだ人が決める。
 *   この型に「通告済み」を表すフィールドを置かないのは、
 *   **自動化の入口を作らないため**である。
 */
export function toSafetyEvent(input: {
  caseId: string;
  partyId: string;
  flags: SafetyFlag[];
  rawText: string;
  createdAt: string;
}): SafetyEvent {
  return {
    caseId: input.caseId,
    partyId: input.partyId,
    flags: input.flags,
    rawText: input.rawText,
    status: "PENDING_REVIEW",
    createdAt: input.createdAt,
  };
}
