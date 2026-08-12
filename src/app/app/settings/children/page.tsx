import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { readSession } from "@/lib/session";
import { asCaseId } from "@/domain/case/types";
import { loadChildBirthDates } from "@/infra-adapters/firestore/repositories/caseRepository";
import { ConfirmChildren } from "@/components/onboarding/ConfirmChildren";

export const dynamic = "force-dynamic";

/**
 * K-4 お子さんを直す
 *
 * ★お子さんの情報だけは相手と共有される。**直す前にそれを書く。**
 *   ここを曖昧にすると、直すことをためらう。
 */
export default async function Page() {
  const s = await readSession();
  if (!s) redirect("/");

  const births = await loadChildBirthDates(asCaseId(s.caseId)).catch(() => [] as string[]);
  if (births.length === 0) redirect("/onboarding/children");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
      <Link href="/app/settings/registered" style={{ fontSize: 13, color: "var(--text-sub)" }}>
        ‹ 登録した内容
      </Link>

      {/* ★何がどう伝わるかを、直す前に置く */}
      <div
        className="mt-3 flex gap-3"
        style={{
          background: "var(--bubble-ai)",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: 14,
        }}
      >
        <Image
          src="/character/capybara-sit.png"
          alt=""
          width={28}
          height={28}
          style={{ width: 28, height: 28, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, lineHeight: 1.95 }}>
            直すと、お相手には「変更がありました」とだけ伝わります。
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 6 }}>
            お子さんのことは、おふたりで共有している情報だからです。何をどう直したかは伝わりません。
            <br />
            お名前は共有されません。この端末でだけ表示されます。
          </p>
        </div>
      </div>

      {/* ★合意済みの金額が変わるのではという不安を、先に消す */}
      <div
        className="mt-3"
        style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 12 }}
      >
        <p style={{ fontSize: 11.5, lineHeight: 1.95, color: "var(--text-sub)" }}>
          生まれ年を直すと、養育費の目安が変わることがあります。すでに合意済みの金額は、そのまま残ります。
        </p>
      </div>

      <div className="mt-4">
        <ConfirmChildren
          caseId={s.caseId}
          births={births}
          next="/app/settings/registered"
          heading="お子さんのこと"
          lead="生まれた年と月だけを伺っています。違っているところがあれば、直してください。"
          hideClosing
        />
      </div>
    </div>
  );
}
