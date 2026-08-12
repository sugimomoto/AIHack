import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { readSession } from "@/lib/session";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { TabBar } from "@/components/ui/TabBar";

/**
 * アプリ本体の枠
 *
 * ★タブバーは設計に最初からあったのに、実装に一度も無かった。
 *   すべてを1画面に縦積みしていたため、**どこにも移動できなかった。**
 *
 * ★セッションが無ければ入れない。
 */
export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: ReactNode }) {
  const s = await readSession();
  if (!s) redirect("/");

  return (
    <PhoneFrame>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TabBar />
    </PhoneFrame>
  );
}
