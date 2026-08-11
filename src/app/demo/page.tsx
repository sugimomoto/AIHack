import { DemoPanes } from "@/components/chat/DemoPanes";
import { isDevPartySwitchEnabled } from "@/lib/party";

/**
 * 両当事者を並べて確認する画面
 *
 * ★本番では動かない。
 *   当事者の切替は開発用であり、本番で通ると誰でも他人の当事者になれる。
 *   黙って空の画面を出すのではなく、**動かない理由を書く。**
 */
export const dynamic = "force-dynamic";

export default function Page() {
  if (!isDevPartySwitchEnabled()) return <Unavailable />;
  return <DemoPanes />;
}

function Unavailable() {
  return (
    <div className="grid min-h-dvh place-items-center px-8" style={{ background: "var(--surface-2)" }}>
      <div
        className="w-full max-w-[520px]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>この画面は本番では動きません</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.95, color: "var(--text-sub)", marginTop: 10 }}>
          両当事者を並べて確認するには、当事者を切り替える必要があります。
          <br />
          この切替が本番で使えると、<strong>誰でも他人の当事者になれます。</strong>
          その時点で、このプロダクトの中心にある「相手の言葉が届かない」という保証が意味を失います。
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 12 }}>
          そのため、切替は開発環境でのみ、かつ明示的に有効化したときだけ効くようにしています。
          本番での確認には、招待からの登録を経た通常のログインが必要です。
        </p>
      </div>
    </div>
  );
}
