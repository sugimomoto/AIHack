# 要求定義書 — S2：分離の骨格 ★最重要

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s2-isolation` |
| スライス | **S2**（→ [roadmap.md](../roadmap.md)） |
| 作成日 | 2026-08-11 |
| 前提 | [functional-design.md](../../docs/functional-design.md) §4.10 / §5.2 |

---

## 1. 目的

> **2つのセッションが独立して存在し、跨がないことがテストで証明されている状態を作る。**

### 1.1 なぜ最重要なのか

**AIを載せる前に「破れない」ことを確立する。**

```
❌ 機能を作ってから制約を守らせる
     実装が固まった後で C1 を後付けするのは難しい。
     そして C1 が破れたら、このプロダクトは存在意義を失う。

✅ 先に破れないことを固定する
     以降どれだけ機能を足しても、土台は崩れない。
```

### 1.2 ★ テストを先に書く

**INV-1〜4 は実装より先に書く**（→ development-guidelines.md §5.0）。

実装を見ながらテストを書くと、**実装が見落とした経路はテストでも見落とされる。**
INV でこれをやると、C1 が破れていても気づけない。

**実装順序を義務とする。**

```
1. INV-1〜4 のテストを書く（この時点では落ちる）
2. ContextBuilder を実装する
3. テストが通る
```

---

## 2. スコープ

### 2.1 実装する

| # | 項目 |
| --- | --- |
| 1 | **INV-1〜4 のテスト**（★最初に書く） |
| 2 | `Case` / `Party` / `Consultation` / `Message` の型とリポジトリ |
| 3 | `ContactInfo`（**SELF_ONLY**・ケース配下に置かない） |
| 4 | **`buildContext`**（自分のセッション用） |
| 5 | **`buildRelayContext`**（★`partyId` を引数に取らない） |
| 6 | **`buildMediationContext`**（双方の payload のみ） |
| 7 | 認証（Firebase Authentication） |
| 8 | 開発用のケース seed |

### 2.2 実装しない

| 除外 | 理由 |
| --- | --- |
| **招待フロー** | **S15。**C1 の検証は二人が存在すれば可能で、「どうやって二人になるか」を待つ必要がない |
| LLM 呼び出し | S3 |
| 対話画面 | S4 |
| 取次ぎの生成 | S5（S2 では**器と経路の遮断**まで） |

> **S2 で「二人が既にいる状態」を作り、S15 で「二人になる経路」を作る。**

---

## 3. 受け入れ条件

### ★ 中核

- [ ] **AC-01｜INV-1**：`Message.content` は、`partyId` が一致するセッション以外のLLMコンテキストに含まれない
- [ ] **AC-02｜INV-2**：`ContactInfo` の各フィールド（住所・電話・勤務先・**年収**）は、いかなるLLMコンテキストにも含まれない
- [ ] **AC-03｜INV-2a**：**精密な年収は越えない。**越えるのは `incomeBand` のみ
- [ ] **AC-04｜INV-3**：当事者間を越えられるのは5つのみ（`AgreementItem.payload` / `Proposal.payload` / `Proposal.context` / `MediationEvent.content` / `Notification.content`）
- [ ] **AC-05｜INV-4a**：越境テキストは、由来する `Message.content` と N文字以上の連続一致を持たない

### 構造

- [ ] **AC-06｜`buildRelayContext` のシグネチャに `partyId` が存在しない**（型で担保）
- [ ] AC-07｜3つのビルダーが用途ごとに分かれている
- [ ] AC-08｜LLMに渡す型に `Message` / `ContactInfo` が含まれない（型で担保）

### 運用

- [ ] AC-09｜認証済みユーザーが自分のケースにのみアクセスできる
- [ ] AC-10｜**テストが実装より先にコミットされている**（コミット順で確認できる）
- [ ] AC-11｜CI でブロッキング条件として実行される

---

## 4. 設計上の要点

### 4.1 `buildRelayContext` が C1 の実装本体

```ts
// ★partyId を引数に取らない ＝ Message へ到達する経路が型レベルで存在しない
buildRelayContext(proposalId: string): RelayContext
```

**「気をつける」ではなく「書けない」状態にする。**

### 4.2 越境できるものを型で閉じる

```ts
// 当事者間を越えてよい型の union。これ以外は越えない
type CrossableData =
  | { kind: "agreement"; payload: unknown }
  | { kind: "proposal";  payload: unknown; context?: string }
  | { kind: "mediation"; content: string }
  | { kind: "notification"; content: string }
```

### 4.3 `ContactInfo` はケース配下に置かない

`/contactInfo/{partyId}` を独立したルートコレクションとする。
**パスの設計そのものが FR-09 の実装である**（→ architecture.md §3.2）。

---

## 5. 未確定事項

| # | 内容 |
| --- | --- |
| C-01 | INV-4a の N（連続一致の閾値）。**10文字程度**を想定 |
| C-02 | 認証方式（匿名認証か、メール/パスワードか）。**S15 の招待フローに依存**するため、S2 では最小構成 |

---

## 6. 承認

- [ ] 本要求定義書の内容で実装に進む
