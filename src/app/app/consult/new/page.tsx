import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { NewConsult } from "@/components/consult/NewConsult";

/**
 * 相談の開始（設計 #4）
 *
 * ★選択を必須にしない。**選ばずに書き始められることが必須要件である。**
 *   強制すると、感情の受け止めが選択画面の後ろに隠れる。
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");
  return <NewConsult />;
}
