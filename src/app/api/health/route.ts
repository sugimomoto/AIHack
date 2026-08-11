export const dynamic = "force-dynamic";

/** Cloud Run のヘルスチェック用 */
export function GET() {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
}
