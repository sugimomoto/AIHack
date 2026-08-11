/**
 * 今日（日本時間）
 *
 * ★`new Date().toISOString()` は常に UTC。
 *   日本前提のプロダクトで使うと、**0:00〜9:00 JST が前日になる**。
 *   TZ 環境変数を設定しても toISOString は変わらない（レビューで検出）。
 */
export function todayJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
