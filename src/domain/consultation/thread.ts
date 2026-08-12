/**
 * 相談のスレッド（K-1）
 *
 * ★同じトピックを選び直したら、**前の会話は出てこない。**
 *
 *   「送迎をお願いしたい」を先週やって、今週また同じことを頼む。
 *   これは**別の件**であって、続きではない。
 *   先週の日付や事情が残っていると、今日の話が読めなくなる。
 *
 * ★ただし「養育費を決める」は違う。
 *   ひとつの話し合いが続いているので、**続きでなければ意味がない。**
 *
 *   その区別は kind に既にある。
 *     FORMAL       … 取り決めそのものを決める（続く）
 *     ADJUSTMENT   … 個別の相談（都度別）
 *     NOTIFICATION … お知らせ（都度別）
 *
 * ★スレッドIDは**双方で同じ**。
 *   取次ぎを相手側の同じスレッドに並べるための鍵になる。
 */

export const DEFAULT_THREAD_ID = "th_default";

/** ★続きにするのは、取り決めそのものを決める相談だけ */
export function isContinuing(kind: string | null | undefined): boolean {
  return kind === "FORMAL";
}

export function threadIdFor(input: {
  scenarioId: string | null | undefined;
  kind: string | null | undefined;
  /** ★都度別の相談で使う。呼び出し側が生成する（同じ値なら同じスレッド） */
  token?: string | null;
}): string {
  const s = (input.scenarioId ?? "").trim();
  if (!s || !/^[A-Za-z0-9_-]{1,40}$/.test(s)) {
    // ★トピックを選ばずに始めた相談も、**毎回新しく立てる。**
    //   既定のスレッドに入れると、前回の会話がそのまま続いてしまう。
    const free = (input.token ?? "").trim();
    return /^[A-Za-z0-9]{4,24}$/.test(free) ? `th_free_${free}` : DEFAULT_THREAD_ID;
  }

  if (isContinuing(input.kind)) return `th_${s}`;

  const t = (input.token ?? "").trim();
  // ★token が無ければ続きになってしまう。無い場合は既定に落とさず、
  //   呼び出し側の誤りとして分かるように scenario だけのIDにはしない。
  if (!t || !/^[A-Za-z0-9]{4,24}$/.test(t)) return `th_${s}`;
  return `th_${s}_${t}`;
}

export function parseThreadId(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return DEFAULT_THREAD_ID;
  return /^th_[A-Za-z0-9_-]{1,60}$/.test(s) ? s : DEFAULT_THREAD_ID;
}

/**
 * その人の、そのスレッドの相談ID。
 *
 * ★接頭辞 `th_` を外して組み立てる。
 *   スレッドを入れる前の相談は `cons_{partyId}_{scenarioId}` という名前で、
 *   **そのままでは到達する URL が無くなる。**
 *   `th_{scenarioId}` → `cons_{partyId}_{scenarioId}` と対応させることで、
 *   過去に書いたものがそのまま開ける。
 *
 * ★既定のスレッドも、これまでのIDを保つ。
 */
export function consultationIdOf(partyId: string, threadId: string): string {
  if (threadId === DEFAULT_THREAD_ID) return `cons_${partyId}`;
  return `cons_${partyId}_${threadId.replace(/^th_/, "")}`;
}

/**
 * 相談IDから、そのスレッドIDを復元する。
 *
 * ★スレッドを持たない古い相談に、開くための鍵を与える。
 */
export function threadIdOfConsultation(consultationId: string, partyId: string): string {
  const prefix = `cons_${partyId}_`;
  if (!consultationId.startsWith(prefix)) return DEFAULT_THREAD_ID;
  const rest = consultationId.slice(prefix.length);
  return rest ? (rest.startsWith("th_") ? rest : `th_${rest}`) : DEFAULT_THREAD_ID;
}

/** その相談IDが、その人のものか。★他人の相談を開かせない */
export function ownsConsultationId(consultationId: string, partyId: string): boolean {
  return consultationId === `cons_${partyId}` || consultationId.startsWith(`cons_${partyId}_`);
}

/** 既定の相談（トピックを選ばずに書き始めた人のもの） */
export const DEFAULT_TITLE = "はじめのご相談";
