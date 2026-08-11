# Aida（あいだ）

> **離婚しても、子どもが健やかに育つための基盤になる。**

離婚する／した父母のあいだにAIが立ち、**二人を直接やりとりさせずに合意をつくり、それを守り続ける**アプリです。

---

## メッセージを転送しません

これがこのプロダクトを定義する、唯一かつ最重要の性質です。

```
【既存サービス】 父 ──[メッセージ]──▶ AIフィルタ ──[緩和済]──▶ 母
                 相手の意図・感情が透ける

【Aida】         父 ◀──個別対話──▶ AI ◀──個別対話──▶ 母
                                    │
                                    ▼
                              合意事項のみ確定
                 相手の言葉は原理的に一度も届かない
```

父が「また勝手に土曜に決めやがって」と打っても、母の画面に出るのは
**「土曜の日程について、別案の相談が来ています」** というAIからの静かな相談だけです。

感情は受け止められ、**背景となる事実だけ**が伝聞形式で相手に伝わります。

---

## なぜ必要か

| 事実 | 出典 |
| --- | --- |
| 離婚の **87.5%** は協議離婚。裁判所も代理人も介在しない | 人口動態統計 |
| 協議離婚の養育費取り決め率は **43.6%**。裁判所を経れば **81.2%** | 令和3年度全国ひとり親世帯等調査 |
| 取り決めをしない理由の**第1位は「相手と関わりたくない」** | 同上 |
| 養育費を現在も受けている母子世帯は **28.1%** | 同上 |

**第三者が介在するかどうかで、取り決め率が約2倍変わります。**
しかし最も件数の多い協議離婚では、第三者が介在しません。

> **協議離婚に、AIという第三者を介在させる。**

---

## 設計の3原則

| # | 原則 | 意味 |
| --- | --- | --- |
| **P1** | **メッセージは跨がない** | 相手の生メッセージがコンテキストに入る経路を、コード上に作らない。防御をプロンプトに依存させない |
| **P2** | **合意状態は公正証書のスキーマである** | AIの仕事は「法的文書の空欄を、双方の対話で埋める」こと |
| **P3** | **数字と条項はLLMに作らせない** | 金額は算定表の決定的参照、条項はひな形置換。**間違えてはいけない2箇所からLLMを外す** |

P3 は弁護士法72条への対応であると同時に、ハルシネーション対策でもあります。

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [product-requirements.md](docs/product-requirements.md) | プロダクト要求定義 |
| [functional-design.md](docs/functional-design.md) | 機能設計（データモデル・調停エンジン・画面・API） |
| [architecture.md](docs/architecture.md) | 技術仕様（GCP構成・LLMルーティング・セキュリティ） |
| [ui-design.md](docs/ui-design.md) | UIデザイン仕様 |
| [repository-structure.md](docs/repository-structure.md) | リポジトリ構造 |
| [development-guidelines.md](docs/development-guidelines.md) | 開発ガイドライン |
| [glossary.md](docs/glossary.md) | ユビキタス言語定義 |
| [legal-market-research.md](docs/legal-market-research.md) | 法制度・統計の調査結果 |
| [roadmap.md](.steering/roadmap.md) | 開発ロードマップ（機能スライス） |

---

## 技術スタック

| レイヤ | 技術 |
| --- | --- |
| フロントエンド | Next.js（App Router）／ TypeScript ／ Tailwind CSS |
| 実行環境 | **Google Cloud Run**（asia-northeast1） |
| データベース | **Firestore**（Native mode） |
| LLM | **OrcaRouter**（3階層ルーティング） |
| 認証 | Firebase Authentication |
| IaC | Terraform |
| CI/CD | GitHub Actions ＋ Cloud Build |

---

## セキュリティ

本プロダクトにおいてセキュリティは付加機能ではありません。**DV・つきまといの文脈が現実に存在するため、情報漏洩が生命の危険に直結しえます。**

5層で防御しています。

| 層 | 対策 |
| --- | --- |
| **L0. データストア** | Firestore セキュリティルール（**default deny**）。クライアントからの直接アクセスを全面拒否 |
| **L1. 構造** | ContextBuilder の許可リスト。**`buildRelayContext` は `partyId` を引数に取らない** |
| **L2. 入力** | 意図分類による情報照会・指示上書きの検知 |
| **L3. 境界** | ユーザー入力をデータとして扱う明示 |
| **L4. 出力** | PII検出によるブロックと再生成 |

L0 と L1 は独立しているため、**片方が破れても他方が残ります**。

さらに、破られてはならない性質を**不変条件（INV-1〜4）としてテストで検証**し、CIのブロッキング条件にしています。

---

## 開発

### 前提

- Node.js / pnpm
- Google Cloud SDK
- Firebase CLI（Emulator）
- Terraform

### セットアップ

```bash
pnpm install
cp .env.example .env.local   # 値は Secret Manager 参照
pnpm dev
```

### テスト

```bash
pnpm test                    # 単体
pnpm test:invariants         # 不変条件（★必須）
pnpm test:rules              # Firestore ルール
```

---

## ライセンス

未定
