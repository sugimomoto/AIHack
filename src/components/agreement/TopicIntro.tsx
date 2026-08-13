"use client";

/**
 * 論点ごとの前置き
 *
 * ★財産分与：「内訳を書いていただく必要はありません」を**先に**書く。
 *   不動産や預貯金を一つずつ問われるのではないと分かって、はじめて開ける。
 *
 * ★年金分割：「按分割合」という語を、**選択の前に出さない。**
 *   制度を知らない人に、知らない語で問いを立てない。
 *
 * ★年金事務所の注記は**恒久的な枠**として組む。外す前提のレイアウトにしない。
 *   （制度上の扱いを一次資料で確認できるまで、外さない）
 */

export function TopicIntro({ topic }: { topic: string }) {
  if (topic === "PROPERTY_DIVISION") {
    return (
      <>
        <Card>
          <p style={{ fontSize: 13, lineHeight: 1.95 }}>
            内訳を書いていただく必要はありません。
          </p>
          <p
            style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 6 }}
          >
            不動産や預貯金を一つずつ挙げるのではなく、どうされるかだけをお決めください。
          </p>
        </Card>
        <Note>
          「別途協議する」も、記録として残ります。決まっていないことを決まっていないまま書面にできます。
        </Note>
      </>
    );
  }

  if (topic === "PENSION_SPLIT") {
    return (
      <>
        <Card>
          <p style={{ fontSize: 13, lineHeight: 1.95 }}>
            結婚していたあいだに納めた厚生年金の記録を、おふたりで分けるかどうか、という話です。
          </p>
          {/* ★誤解が最も多い点 */}
          <p style={{ fontSize: 13, lineHeight: 1.95, marginTop: 8 }}>
            いま受け取っている額が動くわけではありません。
          </p>
          <p
            style={{ fontSize: 12.5, lineHeight: 1.95, color: "var(--text-sub-2)", marginTop: 4 }}
          >
            将来受け取る年金の計算に使う記録を、分けるということです。
          </p>
        </Card>

        {/* ★恒久的な枠。外す前提にしない */}
        <div
          className="mt-3"
          style={{
            background: "var(--muted-bg)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
          }}
        >
          <p style={{ fontSize: 12, lineHeight: 1.95, color: "var(--text-sub-2)" }}>
            お手続きは年金事務所でご確認ください。期限や必要な書類があるとされています。
            ここでの記録は、おふたりの合意を残すためのものです。
          </p>
        </div>
      </>
    );
  }

  return null;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderRadius: "var(--r-md)",
        padding: "13px 15px",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11.5,
        lineHeight: 1.95,
        color: "var(--text-sub-2)",
        marginTop: 10,
        borderTop: "1px dashed var(--border-dashed)",
        paddingTop: 10,
      }}
    >
      {children}
    </p>
  );
}
