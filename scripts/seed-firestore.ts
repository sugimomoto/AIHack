/**
 * マスタ seed の投入
 *
 *   本番:       pnpm exec tsx scripts/seed-firestore.ts
 *   エミュレータ: FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 pnpm exec tsx scripts/seed-firestore.ts
 *
 * ★seed ファイルを Git で管理し、そこから投入する（→ docs/repository-structure.md §3.1）。
 *   法的文書の定義を含むため、変更履歴が追えない状態を作らない。
 *
 * ★冪等。同じ ID には上書きする。
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "aida-505206";
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

const COLLECTIONS = [
  ["masters/topicCategories/items", "firestore/seeds/topicCategories.json"],
  ["masters/scenarios/items", "firestore/seeds/scenarios.json"],
  ["masters/payloadSchemas/items", "firestore/seeds/payloadSchemas.json"],
  ["masters/clauseTemplates/items", "firestore/seeds/clauseTemplates.json"],
] as const;

async function main() {
  if (!getApps().length) {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    initializeApp(
      key
        ? {
            credential: cert({
              projectId: PROJECT,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: key.replace(/\\n/g, "\n"),
            }),
          }
        : { projectId: PROJECT },
    );
  }
  const db = getFirestore();

  console.log(`投入先: ${EMULATOR ? `エミュレータ (${EMULATOR})` : `本番 (${PROJECT})`}`);

  for (const [path, file] of COLLECTIONS) {
    const rows: { id: string }[] = JSON.parse(readFileSync(file, "utf8"));
    const batch = db.batch();
    for (const row of rows) {
      const { id, ...rest } = row;
      batch.set(db.collection(path).doc(id), { ...rest, seededAt: new Date().toISOString() });
    }
    await batch.commit();
    console.log(`  ✓ ${path}  ${rows.length}件`);
  }

  console.log("完了");
}

main().catch((e) => {
  console.error("✗ 失敗:", e);
  process.exit(1);
});
