/**
 * 相談のスレッド（K-1）
 *
 * ★同じトピックを選び直したら、**前の会話は出てこない。**
 *
 *   「送迎をお願いしたい」を先週やって、今週また同じことを頼む。
 *   これは**別の件**であって、続きではない。
 *   先週の日付や事情が残っていると、今日の話が読めなくなる。
 *
 * ★★ 例外を無くした（2026-08-14）。**どのトピックでも、毎回新しく立てる。**
 *
 *   以前は「養育費を決める」だけを続きにしていた（kind が FORMAL）。
 *   ひとつの話し合いが続いていく、という想定だった。
 *
 *   ★その想定は、もう成り立たない。
 *   **対話から取り決めへ行く経路を断った（T1）**ため、
 *   取り決めは取り決めの画面で書く。相談は相談であって、
 *   **合意形成の本体ではない。**だとすれば、都度の相談である。
 *
 *   実害も出ていた。**先月の事情が残ったまま今月の話が始まる。**
 *   ADJUSTMENT で避けていたことが、FORMAL でだけ起きていた。
 *
 * ★過去のスレッドは、そのまま開ける。
 *   一覧は保存済みの threadId を辿るので、`th_sc_001` は残る。
 *   **新しく立てるようになるだけで、過去は失われない。**
 *
 * ★スレッドIDは**双方で同じ**。
 *   取次ぎを相手側の同じスレッドに並べるための鍵になる。
 */

export const DEFAULT_THREAD_ID = "th_default";

export function threadIdFor(input: {
  scenarioId: string | null | undefined;
  /**
   * ★件ごとに新しくする鍵。**必須にしてある。**
   *
   *   以前は省略でき、省略すると `th_{scenarioId}` になった。
   *   それは「続き」のIDそのものであり、**渡し忘れが黙って
   *   前の会話につながる**形だった。型で塞ぐ。
   */
  token: string;
}): string {
  const t = input.token.trim();
  const ok = /^[A-Za-z0-9]{4,24}$/.test(t);
  const s = (input.scenarioId ?? "").trim();

  if (!s || !/^[A-Za-z0-9_-]{1,40}$/.test(s)) {
    // ★トピックを選ばずに始めた相談も、**毎回新しく立てる。**
    //   既定のスレッドに入れると、前回の会話がそのまま続いてしまう。
    return ok ? `th_free_${t}` : DEFAULT_THREAD_ID;
  }

  // ★鍵が無ければ既定に落とす。**`th_{s}` には決して落とさない**（それは続きになる）
  if (!ok) return DEFAULT_THREAD_ID;
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
