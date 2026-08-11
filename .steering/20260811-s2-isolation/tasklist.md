# タスクリスト — S2：分離の骨格 ★最重要

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s2-isolation` |
| 作成日 | 2026-08-11 |
| 前提 | [requirements.md](requirements.md) |

---

## ★ テストファーストの実施記録

**規約 §5.0 に従い、テストを先にコミットした。**コミット履歴で確認できる。

```
4a079f8  test(S2): INV-1〜4 の不変条件テストを実装より先に書く    ← 落ちる状態
a252110  feat(S2): ContextBuilder を実装し、INV テストを通す
（次）    test(S2): API層のスコープ規約テストを実装より先に書く   ← 落ちる状態
（次）    feat(S2): スコープ規約・リポジトリ・認証を実装
```

**テストは実際に機能した。**シグネチャ検証テストが `buildMediationContext` の
コメントに書いた規約説明（`ContactInfo.annualIncome は参照しない`）を検出したため、
コードのみを検査するよう修正している。

---

## 完了

### T1｜INV テスト（先行）✅

- [x] `tests/invariants/contextIsolation.test.ts` — INV-1 / 2 / 2a / 3 / 4a
- [x] `tests/invariants/signatureGuard.test.ts` — **シグネチャとソース上の防御**
- [x] `tests/invariants/README.md` — 位置づけの明記

### T2｜型定義 ✅

- [x] `src/domain/case/types.ts` — ブランド型、`ContactInfo`、`CrossableData`
- [x] `src/domain/context/snapshot.ts` — `CaseSnapshot`

### T3｜ContextBuilder ✅

- [x] `buildContext(snap, partyId)` — 自分のセッション用
- [x] **`buildRelayContext(snap, proposalId)`** — **`partyId` を引数に取らない**
- [x] `buildMediationContext(snap, agreementItemId)` — 双方の payload と帯のみ

### T4｜スコープ規約 ✅

- [x] `tests/invariants/apiScope.test.ts`（先行）
- [x] `src/domain/case/scope.ts` — `assertOwnParty` / `scopedMessages` / `scopedInbound` / `otherPartyView`
- [x] 退会済みの当事者を拒否

### T5｜リポジトリ ✅

- [x] `caseRepository.loadForLlm()` — **contactInfos を読み込まない**
- [x] `findPartyByAuthUid()`
- [x] `loadOwnContactInfo()` — **本人の設定画面専用。LLM 経路から呼ばない**

### T6｜認証 ✅

- [x] `src/lib/auth.ts` — ID トークン検証 → 当事者の解決
- [x] 検証失敗の詳細をユーザーに返さない

### T7｜開発用 seed ✅

- [x] `scripts/seed-dev-case.ts`（架空データ・二人が既にいる状態）
- [x] **本番へ投入し、実データで C1 を検証**

---

## 実データでの検証結果

```
読み込んだメッセージ数: 2
contactInfos を読み込んでいない: ✓
Aのコンテキストに自分の原文がある: ✓
★Aのコンテキストに相手の原文がない: ✓
★Bのコンテキストに相手の原文がない: ✓
★住所が含まれない: ✓
★精密な年収が含まれない: ✓
★Aへの取次ぎのみ届く: ✓
```

---

## 受け入れ条件

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **INV-1**：相手の原文が入らない | ✅ |
| AC-02 | **INV-2**：`ContactInfo` が入らない | ✅ |
| AC-03 | **INV-2a**：精密な年収が越えない | ✅ |
| AC-04 | **INV-3**：越境できるのは5つのみ | ✅ |
| AC-05 | **INV-4a**：原文と10文字以上一致しない | ✅ |
| AC-06 | **`buildRelayContext` に `partyId` が存在しない** | ✅ シグネチャ＋ソースを検証 |
| AC-07 | 3つのビルダーが用途ごとに分かれている | ✅ |
| AC-08 | LLMに渡す型に `Message` / `ContactInfo` が含まれない | ✅ |
| AC-09 | 認証済みユーザーが自分のケースにのみアクセスできる | ✅ `assertOwnParty` |
| AC-10 | **テストが実装より先にコミットされている** | ✅ 履歴で確認可能 |
| AC-11 | CI でブロッキング条件として実行される | ✅ |

**テスト118件が通過。**

---

## 設計上の記録

### 二重の防御にした

`contactInfos` を `CaseSnapshot` の**任意**フィールドとした。

| | |
| --- | --- |
| **読み込まない** | `loadForLlm()` が取得しない。漏れる材料がそもそも無い |
| **漏らさない** | 材料があっても出さない（INV-2 が検証） |

テストでは**意図的に混入させ、それでも漏れないこと**を確認している。
片方が破れても、もう片方が残る。

### Admin SDK はルールをバイパスする

Firestore のセキュリティルール（L0）は、**サーバー側の動作には効かない**。
したがって**アクセス制御の責任は `scope.ts` にある**。
L0 が効くのは「クライアントが直接叩いてきた」最悪ケースのみ。

### 招待を S15 に分離した

C1 の検証は二人が存在すれば可能であり、「どうやって二人になるか」を待つ必要がない。
S2 では seed で二人を作り、分離だけを固めた。

---

## 残タスク

### T8｜API ルート 〔S3以降で追加〕

- [ ] `scope.ts` を使う Route Handler の実装

> S2 ではドメイン層まで。**画面と API は S4 以降**で追加する。
> スコープ規約は実装済みなので、ルートを足すときに経由させるだけでよい。
