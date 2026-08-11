/**
 * 開発用｜招待を1件作る
 *
 * ★架空のデータのみ。実在の人物の情報を入れない。
 */
import { saveInvitation } from "../src/infra-adapters/firestore/repositories/invitationRepository";
import { expiresAt, generateInvitationToken } from "../src/domain/invitation/token";

async function main() {
  const token = generateInvitationToken();
  const now = new Date();
  await saveInvitation({
    id: `inv_dev_${token.slice(0, 8)}`,
    caseId: "case_dev_001",
    createdByPartyId: "party_dev_a",
    token,
    method: "LINK",
    senderName: "架空 太郎",
    revealSenderName: true,
    status: "PENDING",
    expiresAt: expiresAt(now),
    createdAt: now.toISOString(),
  });
  console.log(`/invite/${token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
