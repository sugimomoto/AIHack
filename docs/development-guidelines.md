# 開発ガイドライン — Aida（あいだ）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-08-11 |
| 位置づけ | コーディング規約・命名規則・スタイリング規約・テスト規約・Git 規約を定義する恒久ドキュメント |
| 前提 | [architecture.md](architecture.md) / [repository-structure.md](repository-structure.md) |

---

## 1. 絶対に守る規約（レビューで必ず確認する）

本プロダクトには、**破ると製品そのものが成立しなくなる規約**がある。通常のコーディング規約とは重みが違うため、冒頭に分離して記載する。

| # | 規約 | 根拠 |
| --- | --- | --- |
| **G-A** | **相手の `Message.content` を取得するクエリを書かない。**必要に見えたら設計が間違っている | C1 / INV-1 |
| **G-B** | **`ContactInfo` を LLM に渡すコードを書かない。**参照が必要な画面でも、LLM コンテキストには載せない | FR-09 / INV-2 |
| **G-C** | **LLM 呼び出しは `LlmRouter` 経由に限る。**SDK を直接呼ばない | architecture.md §2.2.3 |
| **G-D** | **金額を LLM に計算させない。**算定表の決定的参照を使う | P3 / NFR-03 L-2 |
| **G-E** | **条項文を LLM に生成させない。**ひな形置換のみ | P3 / NFR-03 L-1 |
| **G-F** | **原文・非開示情報をログに出さない** | architecture.md §5.5 |
| **G-G** | **クライアントから Firestore に直接アクセスしない** | architecture.md §5.2 |

> **これらは「気をつける」ではなく、CI とテストで機械的に検出する。**（→ §5.2）

---

## 2. コーディング規約

### 2.1 TypeScript

| 項目 | 規約 |
| --- | --- |
| `strict` | 有効。`any` は原則禁止（やむを得ない場合は `unknown` ＋ 絞り込み） |
| 型定義 | `interface` より `type` を優先。ユニオンで状態を表現する |
| null 安全 | オプショナルチェーンと Nullish 合体を使う。`!`（非 null アサーション）は禁止 |
| import | 絶対パス（`@/`）を使う。相対パスは同一ディレクトリ内のみ |
| export | named export を基本とする。default export はページコンポーネントのみ |

### 2.2 状態を型で表現する

**合意の状態や調整の効果種別は、文字列ではなくユニオン型で表現する。**

```ts
// ✅ 良い
type AgreementStatus =
  | 'NOT_STARTED' | 'IN_NEGOTIATION' | 'AGREED'
  | 'REVISION_REQUESTED' | 'DEVIATED' | 'ESCALATED'

type AdjustmentEffect = 'ONE_TIME' | 'PERMANENT'

// ❌ 悪い
status: string
```

**状態遷移は `domain/agreement/stateMachine.ts` に集約する。**個々の画面や API で `status` を直接書き換えない。

### 2.3 payload の扱い

payload は `PayloadSchema`（DB）で定義されるため、**静的型が付かない**（→ functional-design.md §4.9）。

```ts
// 保存前に必ず検証する
const schema = await getPayloadSchema(item.payloadSchemaId)
const result = validate(schema, payload)
if (!result.ok) throw new PayloadValidationError(result.errors)
```

| ルール |
| --- |
| **未検証の payload を保存しない** |
| **`payloadSchemaId` を伴わない `AgreementItem` を作らない** |
| 読み取り時は `payloadSchemaId` が指す版で解釈する。**過去の payload を変換しない** |

### 2.4 ドメイン層の独立

```ts
// ✅ domain/ の中
export function decideAdjustmentEffect(input: ...): AdjustmentEffect { ... }

// ❌ domain/ の中でやってはいけない
import { getFirestore } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'
```

外部アクセスはインターフェースで受け取る。

```ts
export type AgreementRepository = {
  findItem(id: string): Promise<AgreementItem | null>
  save(item: AgreementItem): Promise<void>
}
```

### 2.5 コンテキストビルダー

**用途ごとに専用のビルダーを使う。汎用の `buildContext` を使い回さない。**

| 用途 | 使うビルダー |
| --- | --- |
| 自分のセッションでの処理 | `buildContext(partyId, caseId)` |
| **相手への取次ぎ** | **`buildRelayContext(proposalId)`** |
| 双方の提案が揃った調停 | `buildMediationContext(agreementItemId)` |

> **`buildRelayContext` に `partyId` を渡せるようにしてはならない。**引数に存在しないことが C1 の担保である。

### 2.6 エラーハンドリング

| 項目 | 規約 |
| --- | --- |
| ドメインエラー | 専用のエラー型を定義する（`PayloadValidationError` など） |
| ユーザーへの表示 | 技術的な内容を出さない。**「うまくいきませんでした。もう一度お試しください」** |
| LLM の失敗 | リトライ（最大2回）→ 失敗時は「いま混み合っています」と表示し、入力内容は保持する |
| ログ | エラー種別・発生箇所は記録する。**ユーザー入力は含めない**（G-F） |

> **入力内容を失わせない。**感情的な状態で書いた文章が消えるのは、このプロダクトでは特に避けるべき体験である。

---

## 3. 命名規則

### 3.1 ドメイン用語を使う

**コード上の名前は [glossary.md](glossary.md) の用語に合わせる。**翻訳や言い換えをしない。

| 概念 | コード上の名前 | 避ける名前 |
| --- | --- | --- |
| 合意項目 | `AgreementItem` | `Topic`, `Item`, `Term` |
| 提案 | `Proposal` | `Offer`, `Request` |
| 調整（L2） | `Adjustment` | `Change`, `Update` |
| 相談 | `Consultation` | `Thread`, `Session`, `Conversation` |
| 取次ぎ | `MediationEvent` | `RelayMessage`（UIコンポーネント名としては可） |
| 監護親 | `custodialParty` | `mother`, `parentA` |
| 非監護親 | `nonCustodialParty` | `father`, `parentB` |

> **`father` / `mother` を使わない。**監護親が父であるケースは実在する。役割（監護 / 非監護）で表す。

### 3.2 一般規則

| 対象 | 規則 | 例 |
| --- | --- | --- |
| 変数・関数 | camelCase | `buildRelayContext` |
| 型・クラス | PascalCase | `AgreementItem` |
| 定数 | UPPER_SNAKE_CASE | `MAX_MEDIATION_ATTEMPTS` |
| enum の値 | UPPER_SNAKE_CASE | `CHILD_SUPPORT` |
| ブール値 | `is` / `has` / `can` で始める | `isWithinPriorityClaim` |
| 非同期関数 | 動詞で始める | `fetchAgreement`, `saveProposal` |

---

## 4. UI・スタイリング規約

> **デザイン原則・画面仕様・文言規約・デザインシステムは [ui-design.md](ui-design.md) に集約する。**
> 本節は**実装者が守る規約のみ**を扱う。二重管理を避けるため、原則の記述はここに置かない。

### 4.1 実装規約

| 項目 | 規約 |
| --- | --- |
| 基準ビューポート | **390 × 844**。モバイルファースト |
| PC 幅 | 中央に固定幅で表示。PC 専用レイアウトは作らない |
| テーマ | **単一テーマ。**ダークモードは実装しない（→ ui-design.md §6.1） |
| タップ領域 | 最小 **44 × 44 px** |
| 主要操作の位置 | **親指の届く下半分** |
| 状態表現 | **色だけに頼らない。**形・記号・文字を併用 |
| アニメーション | 最小限。`prefers-reduced-motion` を尊重 |
| Tailwind | 任意値（`w-[137px]`）を多用しない。スケールに従う |
| 配色 | ui-design.md §9 の役割つきパレットを CSS 変数で定義し、直接色を書かない |

### 4.2 実装時に必ず確認する原則

詳細は [ui-design.md §4](ui-design.md) を参照。実装で違反しやすいものだけ再掲する。

| # | 原則 | 実装上の意味 |
| --- | --- | --- |
| **U-1** | 相手の存在を最小化する | 相手の実名を画面に出さない。必ず `displayNameForOther` を経由する |
| **U-2** | 二人を色で対立させない | 当事者を色分けするコンポーネントを作らない |
| **U-5** | 急かさない | **未読バッジ・赤ドット・既読・入力中表示を実装しない** |

### 4.3 対話画面の3種別

**この描き分けが本プロダクトの中核 UI である。**必ず別コンポーネントとして実装する。

| # | 種類 | コンポーネント |
| --- | --- | --- |
| ① | 自分の発言 | `OwnMessage` |
| ② | AI自身の発言 | `AiMessage` |
| ③ | **AIによる取次ぎ** | `RelayMessage` |

> **③を①や②と同じ見た目にしてはならない。**共通コンポーネントに props で差分を付ける実装は避け、独立させる。

### 4.4 文言

**画面文言は [ui-design.md §6](ui-design.md) の規約に従う。**特に次を実装時に守る。

| 項目 | 規約 |
| --- | --- |
| 相手の呼称 | **「お相手」**（ユーザーが変更可能） |
| 法的な事柄 | 断定しない。「〜とされています」 |
| **相手の申告** | **伝聞形式。「〜とのことです」** |
| 逸脱 | 「入金が確認できていません」。**「未払い」と書かない** |
| エラー | 技術的な内容を出さない |

## 5. テスト規約

### 5.0 ★ テストを先に書く対象

**本プロジェクトは全面的な TDD を採らない。**ただし、**一部のテストは実装より先に書くことを義務とする。**

| 対象 | テストを先に書くか | 理由 |
| --- | --- | --- |
| **不変条件（INV-1〜4）** | **必須** | **プロダクトの存在条件**。後から書くと、実装に合わせたテストになる |
| **絶対規約の検出（G-A〜G-G）** | **必須** | 同上 |
| **状態遷移** | **必須** | 法的文書に関わる。全網羅は先に書けば実装漏れが即座に出る |
| ドメインロジック（`domain/` 配下） | 推奨 | 外部依存がなく、先に書きやすい |
| API・リポジトリ | 任意 | |
| **UI・画面** | **不要** | 見た目の妥当性はテストで表現できない |

#### なぜ限定するのか

**全面 TDD が向かない領域がある。**

| | |
| --- | --- |
| 向く | 状態機械、不変条件、規約違反の検出。**正解が先に決まっているもの** |
| 向かない | UI（見た目が主）、探索的な実装（設計が固まっていない段階） |

対話画面の `RelayMessage`（封書カード）を先にテストで書いても意味がない。
**「①と別種に見えるか」はテストで表現できない**ためである。

#### ★ 後から書くと、実装の穴がテストの穴になる

これが上表の3つを義務とする理由である。

```
❌ 実装 → テスト
     実装を見ながらテストを書くため、実装が見落とした経路は
     テストでも見落とされる。INV でこれをやると、C1 が破れていても気づけない。

✅ テスト → 実装
     テストが仕様の宣言になり、実装は「それを通す形」に決まる。
```

#### スライス単位でも同じ構造をとる

ロードマップの S2（分離の骨格）は、**AI を載せる前に「破れない」ことを確立する**スライスである。
これはスライス単位でのテストファーストそのものであり、
**`buildRelayContext` を実装する前に INV-1〜4 を書く。**

### 5.1 テストの分類

| 種別 | 対象 | 場所 | CI |
| --- | --- | --- | --- |
| **不変条件テスト** | INV-1〜INV-4 | `tests/invariants/` | **必須・ブロッキング** |
| ルールテスト | Firestore の default deny | `tests/rules/` | **必須・ブロッキング** |
| スキーマ整合テスト | G-3（ひな形とスキーマ） | `tests/schema/` | **必須・ブロッキング** |
| 単体テスト | `domain/` 配下 | 各ファイル隣接 | 必須 |
| E2E | 主要導線 | `tests/e2e/` | 主要導線のみ |

### 5.2 機械的に検出する規約違反

**§1 の G-A〜G-G は、レビューではなく CI で検出する。**

| 規約 | 検出方法 |
| --- | --- |
| G-A（相手の Message 取得） | `buildRelayContext` / `buildMediationContext` の戻り値に `Message` 型が含まれないことを型で保証。加えて INV テスト |
| G-B（ContactInfo を LLM へ） | LLM に渡す型に `ContactInfo` が含まれないことを型で保証。INV-2 テスト |
| G-C（LlmRouter 経由） | **静的検査**：`infra-adapters/llm/router.ts` 以外から LLM SDK を import していないこと |
| G-D / G-E（金額・条項の生成） | `SupportTable` / `DocumentBuilder` が `LlmRouter` を import していないことを検査 |
| G-F（ログ出力） | ログ関数に渡す型を制限。原文フィールドを含む型を弾く |
| G-G（クライアント直アクセス） | Firestore ルールテスト |

> **型と静的検査で防げるものは、テストより優先して型で防ぐ。**

### 5.3 テストデータ

| ルール |
| --- |
| **実際の当事者データを使わない。**合成データのみ（`tests/fixtures/`） |
| 氏名・住所は明らかに架空とわかるものにする |
| 感情的な文言のテストケースは必要。**ただし実在の人物を想起させる内容にしない** |

### 5.4 単体テストの方針

- `domain/` は外部依存を持たないため、**モックなしでテストできる**状態を保つ
- 状態遷移は**全遷移パスを網羅**する（合意の状態機械は法的文書に関わるため）
- 算定表の参照は**境界値**（年収の階段の端）をテストする

---

## 6. Git 規約

### 6.1 ブランチ

| 種別 | 命名 | 例 |
| --- | --- | --- |
| メイン | `main` | 常にデプロイ可能 |
| 機能 | `feat/<概要>` | `feat/relay-context` |
| 修正 | `fix/<概要>` | `fix/payload-validation` |
| ドキュメント | `docs/<概要>` | `docs/architecture` |
| リファクタ | `refactor/<概要>` | |

### 6.2 コミットメッセージ

Conventional Commits に従う。

```
<type>(<scope>): <subject>

<body>
```

| type | 用途 |
| --- | --- |
| `feat` | 機能追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `refactor` | 挙動を変えない変更 |
| `test` | テスト |
| `chore` | ビルド・依存関係 |
| `infra` | Terraform・CI/CD |

**例**

```
feat(mediation): 事情の抽出をホワイトリスト方式で実装

Proposal.context に背景事実を抽出する処理を追加。
抽出カテゴリは PayloadSchema ではなく固定のホワイトリストで制御し、
contextCategories に記録して INV-4c で検証できるようにした。
```

### 6.3 プルリクエスト

| 項目 | 規約 |
| --- | --- |
| サイズ | 1 PR = 1 目的。大きくなったら分割する |
| 説明 | 何を・なぜ。**§1 の規約に触れる変更は明記する** |
| CI | すべて通っていること（不変条件テストを含む） |
| マージ | Squash merge |

### 6.4 タグ・リリース

- 本番デプロイは `v*` タグ（例：`v0.1.0`）
- セマンティックバージョニングに従う

### 6.5 コミットしてはいけないもの

| 対象 |
| --- |
| `.env`（実値）、認証情報、鍵ファイル |
| 実際の当事者データ |
| 生成物（`.next/`, `node_modules/`, `*.tsbuildinfo`） |

`gitleaks` を pre-commit と CI の両方で実行する。

---

## 7. ドキュメント運用

CLAUDE.md の定義に従う。

| 種別 | 場所 | 更新タイミング |
| --- | --- | --- |
| 永続的ドキュメント | `docs/` | **基本設計が変わったときのみ** |
| 作業単位のドキュメント | `.steering/YYYYMMDD-タイトル/` | 作業ごとに新規作成 |

### 7.1 開発フロー

1. **影響分析** — `docs/` への影響を確認する
2. **ステアリングディレクトリ作成** — `.steering/YYYYMMDD-タイトル/`
3. **作業ドキュメント作成** — `requirements.md` → `design.md` → `tasklist.md`。**1ファイルごとに承認を得る**
4. **永続的ドキュメント更新**（必要な場合のみ）
5. **実装**
6. **品質チェック** — lint・型チェック・テスト

### 7.2 図表

- **Mermaid を第一選択**とし、関連ドキュメント内に直接記述する
- 独立した `diagrams/` フォルダは作らない
- 設計変更時は図も同時に更新する

---

## 8. レビュー観点

コードレビューで必ず確認する項目。

| # | 観点 |
| --- | --- |
| 1 | **§1 の G-A〜G-G に抵触していないか** |
| 1a | **§5.0 の「先に書く対象」で、テストが実装より後に書かれていないか**（コミット順で確認できる） |
| 2 | ドメインロジックが `domain/` に閉じているか。`app/` に漏れていないか |
| 3 | 状態遷移が `stateMachine.ts` を経由しているか |
| 4 | payload の検証が保存前に行われているか |
| 5 | 合意の変更が**上書きではなく追記**になっているか |
| 6 | エラー時にユーザーの入力が失われないか |
| 7 | UI が §4 の原則（特に U-1・U-5）に反していないか |
| 8 | 文言が §4.5 に沿っているか（断定していないか、責めていないか） |
