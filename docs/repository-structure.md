# リポジトリ構造定義書 — Aida（あいだ）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-08-11 |
| 位置づけ | フォルダ・ファイル構成と配置ルールを定義する恒久ドキュメント |
| 前提 | [architecture.md](architecture.md) / [functional-design.md](functional-design.md) |

---

## 1. 全体構成

```
AIHack/
├── CLAUDE.md                     # プロジェクトメモリ（開発ルール）
├── README.md                     # プロダクト概要・セットアップ手順
│
├── docs/                         # 永続的ドキュメント（公開対象）
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   ├── glossary.md
│   ├── ui-design.md                  # UIデザイン仕様（デザイン依頼も兼ねる）
│   ├── legal-market-research.md      # 参考：法制度・統計の一次情報（公的資料のみ）
│   ├── hackathon-overview.md         # 参考：AI HACK 2026 要項
│   └── images/                       # 図表（Mermaid で表現できないもののみ）
│
├── .meetings/                    # ★Git管理対象外（.gitignore）
│   ├── meeting-*.md                  # ヒアリング議事録（実名を含む）
│   └── domain-reference-divorce.md   # 法律事務所提供資料に基づくドメイン知識
│
├── .steering/                    # 作業単位のドキュメント
│   └── YYYYMMDD-開発タイトル/
│       ├── requirements.md
│       ├── design.md
│       └── tasklist.md
│
├── src/                          # アプリケーション本体
├── prisma/ または firestore/     # スキーマ・ルール・シード
├── infra/                        # Terraform / Cloud Build
├── tests/                        # E2E・ルールテスト
├── scripts/                      # 運用スクリプト
└── public/                       # 静的アセット
```

---

## 2. `src/` の構成

**ドメインロジックをフレームワークから分離する。**将来のネイティブアプリ化で `app/` だけを差し替えられる状態を保つ。

```
src/
├── app/                          # Next.js App Router（画面とAPI）
│   ├── (app)/                    # アプリ本体（ボトムタブ）
│   │   ├── chat/
│   │   ├── agreement/
│   │   │   ├── [topic]/
│   │   │   └── document/
│   │   ├── obligations/
│   │   ├── settings/
│   │   └── layout.tsx            # ボトムタブ
│   ├── (onboarding)/             # 招待コード・初期設定
│   ├── api/                      # Route Handlers
│   └── layout.tsx
│
├── domain/                       # ★ドメインロジック（フレームワーク非依存）
│   ├── agreement/                # L1：合意
│   │   ├── topics.ts             # AgreementTopic enum（コード固定）
│   │   ├── stateMachine.ts       # 状態遷移
│   │   └── revision.ts           # 履歴の追記
│   ├── adjustment/               # L2：調整
│   │   └── effect.ts             # ONE_TIME / PERMANENT の分岐
│   ├── notification/             # L3：連絡
│   ├── mediation/                # 調停パイプライン
│   │   ├── engine.ts
│   │   ├── intent.ts             # 意図分類
│   │   ├── extract.ts            # 事情の抽出（ホワイトリスト）
│   │   └── relay.ts              # 相手への取次ぎ
│   ├── context/                  # ★C1の実装本体
│   │   ├── buildContext.ts
│   │   ├── buildRelayContext.ts  # partyId を引数に取らない
│   │   └── buildMediationContext.ts
│   ├── security/
│   │   ├── guard.ts              # 入力検知
│   │   └── piiFilter.ts          # 出力フィルタ
│   ├── support-table/            # 算定表（LLM不使用）
│   │   ├── lookup.ts
│   │   └── data/                 # 算定表のデータ
│   └── document/                 # 公正証書原案（LLM不使用）
│       └── builder.ts            # ひな形置換
│
├── infra-adapters/               # 外部との境界
│   ├── llm/
│   │   ├── router.ts             # ★LLM呼び出しの唯一の入口
│   │   ├── tiers.ts              # SMALL / MEDIUM / LARGE
│   │   └── costLogger.ts
│   ├── firestore/
│   │   ├── client.ts             # Admin SDK
│   │   └── repositories/         # コレクションごと
│   └── storage/
│
├── components/                   # UIコンポーネント
│   ├── chat/
│   │   ├── OwnMessage.tsx        # ①自分の発言
│   │   ├── AiMessage.tsx         # ②AI自身の発言
│   │   └── RelayMessage.tsx      # ③AIによる取次ぎ ★描き分けの要
│   ├── agreement/
│   └── ui/                       # 汎用
│
├── lib/                          # 横断ユーティリティ
└── types/                        # 共有型定義
```

### 2.1 依存の向き

```
app/  ──▶  domain/  ◀──  infra-adapters/
              ▲
              │ 依存しない
        （フレームワーク・DB・LLM）
```

| ルール |
| --- |
| **`domain/` は `app/` と `infra-adapters/` に依存しない** |
| `domain/` から Next.js・Firestore SDK・OrcaRouter SDK を import しない |
| 外部アクセスは `infra-adapters/` のインターフェース越しに行う |

> **この分離があるとネイティブアプリ化で `app/` の置き換えだけで済む。**また `domain/` の単体テストに外部依存が不要になる。

---

## 3. データ層のファイル

```
firestore/
├── firestore.rules               # ★default deny（architecture.md §5.2）
├── firestore.indexes.json
└── seeds/
    ├── topicCategories.json      # 分類マスタ
    ├── scenarios.json            # シナリオマスタ
    ├── payloadSchemas.json       # ★payload の JSON Schema
    └── clauseTemplates.json      # 条項ひな形
```

### 3.1 マスタは seed ファイルで版管理する

マスタの編集は**運営が DB を直接操作**する方針だが（→ functional-design.md §4.2）、**seed ファイルを Git で管理し、そこから投入する。**

| | |
| --- | --- |
| 目的 | 変更履歴を Git に残す。誰がいつ何を変えたかを追える |
| 運用 | seed を更新 → PR → マージ → 投入スクリプトで反映 |
| 緊急時 | DB を直接更新してよい。ただし**後で seed に戻す** |

> **法的文書の定義を含むため、変更履歴が追えない状態を作らない。**

---

## 4. `infra/` の構成

```
infra/
├── terraform/
│   ├── main.tf
│   ├── providers.tf
│   ├── backend.tf                # GCS バックエンド
│   ├── variables.tf
│   ├── cloud_run.tf
│   ├── cloud_run_jobs.tf         # 逸脱検知バッチ
│   ├── firestore.tf
│   ├── storage.tf
│   ├── secret_manager.tf
│   ├── artifact_registry.tf
│   ├── iam.tf
│   ├── monitoring.tf             # ダッシュボード・アラート
│   └── terraform.tfvars.example
│
└── cloudbuild/
    └── deploy.yaml
```

---

## 5. `tests/` の構成

```
tests/
├── invariants/                   # ★不変条件（CI必須）
│   ├── inv1-message-isolation.test.ts
│   ├── inv2-contactinfo.test.ts
│   ├── inv3-crossing-data.test.ts
│   └── inv4-relay-content.test.ts
├── rules/                        # Firestore ルール
│   └── deny-client-access.test.ts
├── schema/
│   └── clause-placeholder.test.ts   # G-3：ひな形とスキーマの整合
├── e2e/                          # Playwright
└── fixtures/                     # 合成データ（実データは置かない）
```

> **`tests/invariants/` は他のテストと分けて配置する。**これらは機能テストではなく、**プロダクトが成立する条件**の検証である。落ちたらリリースしない。

---

## 6. ファイル配置ルール

### 6.1 命名

| 対象 | 規則 | 例 |
| --- | --- | --- |
| ディレクトリ | kebab-case | `support-table/`, `infra-adapters/` |
| Reactコンポーネント | PascalCase | `RelayMessage.tsx` |
| その他の TS | camelCase | `buildRelayContext.ts` |
| テスト | `*.test.ts` | `inv1-message-isolation.test.ts` |
| ドキュメント | kebab-case | `product-requirements.md` |

### 6.2 置いてはいけないもの

| 対象 | 理由 |
| --- | --- |
| `.env`（実値） | Secret Manager で管理。`.env.example` のみコミット |
| 実際の当事者データ | テストは `tests/fixtures/` の合成データのみ |
| 認証情報・鍵ファイル | 同上 |
| 生成物（`.next/`, `node_modules/`） | `.gitignore` |
| スクリーンショット等の大容量バイナリ | 必要最小限。`docs/images/` に限る |

### 6.3 ドキュメントの置き場所

CLAUDE.md の定義に従う。

| 種別 | 場所 | 公開 | 判断基準 |
| --- | --- | --- | --- |
| **永続的ドキュメント** | `docs/` | 公開 | アプリケーション全体の「何を作るか」「どう作るか」 |
| **作業単位のドキュメント** | `.steering/YYYYMMDD-タイトル/` | 公開 | 「今回何をするか」。作業ごとに新規ディレクトリ |
| **参考資料（公的情報）** | `docs/` | 公開 | 官公庁の一次資料に基づく調査結果など |
| **★ 機密資料** | **`.meetings/`** | **非公開** | **ヒアリング議事録、第三者から提供された資料** |

> **判断に迷ったら「次の作業でも読むか」を基準にする。**読むなら `docs/`、読まないなら `.steering/`。

### 6.4 ★ `.meetings/` の運用

**本リポジトリは公開される。**したがって次のものを `docs/` に置いてはならない。

| 対象 | 理由 |
| --- | --- |
| **ヒアリング議事録** | 実名・所属・発言内容を含む。本人の同意なく公開できない |
| **第三者から提供された資料** | 法律事務所の依頼者向け配布資料など。著作権と提供元の意図の問題 |
| 個人が特定できる情報 | — |

`.gitignore` で `.meetings/` を除外する。**これらの資料から得た知見は、一般化した形で `docs/` に反映する。**

| 元資料（非公開） | 公開ドキュメントへの反映 |
| --- | --- |
| 法律事務所の配布資料 | 8論点として product-requirements.md §3.3 に一般化 |
| ヒアリング議事録 | 課題認識として product-requirements.md §2.3 に反映 |

> **知見は公開し、出所は公開しない。**引用が必要な場合は、発言者を匿名化する（→ §6.5）。

### 6.5 公開ドキュメント内の個人情報

`docs/` 配下で第三者の発言を引用する場合は、**実名を避け、属性で表記する**。

| ❌ 避ける | ✅ 使う |
| --- | --- |
| 個人名（弁護士） | **離婚案件を専門とする弁護士** |
| 個人名（協力者） | **共同養育の当事者** |
| 事務所名・所属先 | （記載しない） |

> 対応表そのものが個人を特定しうるため、**このドキュメントにも実名を書かない。**実名との対応は `.meetings/` 側で管理する。

### 6.4 図表

- **Mermaid を第一選択**とし、関連するドキュメント内に直接記述する
- 独立した `diagrams/` フォルダは作らない
- 画像が必要な場合のみ `docs/images/` に PNG / SVG で配置する

---

## 7. ルートに置くファイル

| ファイル | 用途 |
| --- | --- |
| `README.md` | プロダクト概要、セットアップ、開発の始め方 |
| `CLAUDE.md` | 開発ルール（プロジェクトメモリ） |
| `package.json` / `pnpm-lock.yaml` | 依存関係 |
| `tsconfig.json` | TypeScript 設定 |
| `next.config.ts` | Next.js 設定 |
| `eslint.config.mjs` / `.prettierrc` | Lint・整形 |
| `vitest.config.ts` / `playwright.config.ts` | テスト設定 |
| `Dockerfile` / `.dockerignore` | Cloud Run 用 |
| `.gitignore` / `.gitleaks.toml` | 除外・シークレット検出 |
| `firebase.json` / `.firebaserc` | Firestore Emulator・ルールのデプロイ |
