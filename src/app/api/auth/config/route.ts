import { NextResponse } from "next/server";

/**
 * ★実行時に返す。
 *
 *   `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、
 *   デプロイ後に環境変数を変えても反映されない。
 *   設定を変えるたびにビルドし直す運用にしない。
 *
 * ★apiKey は公開前提の識別子である（Firebase の設計）。
 *   秘密ではない。アクセス制御はセキュリティルールと当方のAPIが担う。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  });
}
