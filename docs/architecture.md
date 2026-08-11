# 技術仕様書（Architecture） — Aida（あいだ）

| 項目 | 内容 |
| --- | --- |
| プロダクト名 | **Aida（あいだ）** ※仮称 |
| 作成日 | 2026-08-11 |
| 位置づけ | テクノロジースタック・開発ツール・技術制約・パフォーマンス要件を定義する恒久ドキュメント |
| 前提 | [product-requirements.md](product-requirements.md) / [functional-design.md](functional-design.md) |

---

## 1. 技術選定の方針

### 1.1 選定原則

1. **C1（メッセージを跨がせない）を、アプリ層だけでなくインフラ層でも担保する** — データストアのアクセス制御を独立した防御層として使う
2. **LLM の入口を1箇所に集約する** — OrcaRouter を唯一のゲートウェイとし、モデル選択・コスト計測・監査をそこで完結させる
3. **金額と法的条項の生成経路に LLM を置かない** — 算定表参照とひな形置換は決定的処理として実装する（P3）
4. **10年運用に耐えるデータ設計を優先する** — 合意は法的文書であり、マイグレーションで書き換えてはならない
5. **スマートフォン前提。将来のネイティブアプリ化で再設計しない** — API 境界を最初から分離する
6. **個人〜小規模チームで運用できる範囲に収める** — マネージドサービスを優先し、常時稼働リソースを持たない

### 1.2 採用 / 不採用の判断基準

| 判断軸 | 採用条件 |
| --- | --- |
| C1・非開示情報保護への寄与 | 直接寄与するなら優先的に採用 |
| マネージド度 | 運用者がゼロでも回ること |
| コスト | **月額500円の市場アンカー下で粗利が成立すること**（→ §7） |
| 学習コスト | 既知技術の組合せを優先 |
| ネイティブ化への影響 | 将来の iOS / Android 移行を妨げないこと |

---

## 2. テクノロジースタック

### 2.1 全体図

```mermaid
flowchart TB
    subgraph Client["クライアント（スマートフォン）"]
        BR["Web（PWA）<br/>Next.js / React"]
        NA["将来: iOS / Android<br/>ネイティブ"]
    end

    subgraph Run["Cloud Run"]
        WEB["Next.js<br/>App Router + Route Handlers"]
        JOB["Cloud Run Jobs<br/>逸脱検知バッチ"]
    end

    subgraph App["アプリケーション層（Cloud Run 内）"]
        CTX["ContextBuilder"]
        ENG["MediationEngine"]
        GUARD["SecurityGuard"]
        CALC["SupportTable<br/>※LLM不使用"]
        DOC["DocumentBuilder<br/>※LLM不使用"]
        ROUTE["LlmRouter"]
    end

    subgraph LLM["LLM"]
        OR["OrcaRouter<br/>（唯一のゲートウェイ）"]
        MODELS["SMALL / MEDIUM / LARGE"]
    end

    subgraph Data["データ層"]
        FA["Firebase Authentication"]
        FS["Firestore<br/>Native mode"]
        CS["Cloud Storage<br/>画像・添付"]
        SM["Secret Manager"]
    end

    subgraph Obs["可観測性"]
        CL["Cloud Logging"]
        CM["Cloud Monitoring"]
        CT["Cloud Trace"]
        ER["Error Reporting"]
    end

    subgraph DevOps["DevOps"]
        GH["GitHub"]
        GHA["GitHub Actions"]
        AR["Artifact Registry"]
        CB["Cloud Build"]
        TF["Terraform"]
    end

    BR --> WEB
    NA -. 将来 .-> WEB
    BR --> FA
    WEB --> CTX --> ENG
    ENG --> GUARD & CALC & ROUTE
    ROUTE --> OR --> MODELS
    WEB -->|"Admin SDK"| FS
    WEB --> CS
    WEB -. read .-> SM
    JOB --> FS
    ENG --> DOC
    WEB & JOB --> CL & CT
    CL --> CM & ER
    GH --> GHA --> CB --> AR --> WEB
    TF -. provisions .-> Run & Data & Obs
```

### 2.2 レイヤ別技術一覧

#### 2.2.1 フロントエンド

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| フレームワーク | **Next.js（App Router）** | UI と API を1リポジトリで扱う |
| 言語 | **TypeScript** | strict |
| スタイル | **Tailwind CSS** | モバイル前提（390×844 基準） |
| 配信形態 | **Web（PWA）** | ホーム画面追加・プッシュ通知に対応 |
| テーマ | **単一テーマ**（クリーム基調） | ダークモードは対象外（→ ui-design.md §6.1） |
| 将来 | iOS / Android ネイティブ | API 境界を維持し再設計を避ける |

#### 2.2.2 サーバー（BFF 兼アプリケーション層）

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| 実行環境 | **Cloud Run** | 最小インスタンス 0。常時稼働コストを持たない |
| API 実装 | Route Handlers ＋ Server Actions | §7 の API 設計に対応 |
| リージョン | **asia-northeast1（東京）** | |
| バッチ | **Cloud Run Jobs ＋ Cloud Scheduler** | 逸脱検知・リマインダー送信（日次） |

#### 2.2.3 LLM レイヤ

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| ゲートウェイ | **OrcaRouter** | **唯一の LLM 入口。**モデル選択・コスト計測・監査を集約 |
| ルーティング | 自前の `LlmRouter` | 用途 → 階層（SMALL/MEDIUM/LARGE）を決定（→ §4） |
| 構造化出力 | JSON Schema（`PayloadSchema.schema`） | payload 生成時の型指定 |
| 金額算定 | **LLM 不使用**（算定表の決定的参照） | P3 |
| 条項生成 | **LLM 不使用**（ひな形置換） | P3 / NFR-03 L-1 |

> **LLM 呼び出しは `LlmRouter` を経由しないものを一切作らない。**直接呼び出しを禁止することで、コスト計測（CT-1〜CT-4）と監査ログの欠落を防ぐ。

#### 2.2.4 データ層

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| 認証 | **Firebase Authentication** | 招待コード＋認証。当事者の本人性はアプリ側で管理 |
| データベース | **Firestore（Native mode）** | ドキュメント指向。**セキュリティルールを独立した防御層として利用**（→ §5） |
| オブジェクトストレージ | **Cloud Storage** | 面会時の写真、学校からの連絡の画像など |
| Secret 管理 | **Secret Manager** | OrcaRouter API キー、Firebase Admin 鍵 |
| クライアントからの直接アクセス | **禁止（default deny）** | すべてサーバー経由（→ §5.2） |

#### 2.2.5 DevOps・可観測性

| 項目 | 採用技術 | 補足 |
| --- | --- | --- |
| バージョン管理 | **GitHub** | |
| CI | **GitHub Actions** | lint / typecheck / test / **不変条件テスト**（→ §5.3） |
| CD | **Cloud Build** | ビルド → Artifact Registry → Cloud Run |
| コンテナレジストリ | **Artifact Registry** | |
| IaC | **Terraform** | 状態は GCS バックエンド |
| ロギング | **Cloud Logging** | 構造化ログ |
| メトリクス | **Cloud Monitoring** | レイテンシ・エラー率・**LLM 階層別コスト** |
| トレース | **Cloud Trace** ＋ OpenTelemetry | 調停パイプラインの各ステップを可視化 |
| エラー追跡 | **Error Reporting** | |

#### 2.2.6 開発ツール

| 項目 | 採用技術 |
| --- | --- |
| パッケージ管理 | **pnpm** |
| Lint | ESLint（Next.js Strict ＋ @typescript-eslint） |
| フォーマット | Prettier |
| 型チェック | `tsc --noEmit` |
| テスト | Vitest（単体・不変条件） / Playwright（E2E） |
| Firestore ルールのテスト | `@firebase/rules-unit-testing` |

---

## 3. データストア設計（Firestore）

### 3.1 コレクション構造

```
/cases/{caseId}
   ├ /parties/{partyId}
   ├ /children/{childId}
   ├ /consultations/{consultationId}
   │     └ /messages/{messageId}        ← partyId フィールドを持つ
   ├ /agreementItems/{itemId}
   │     └ /revisions/{revisionId}
   ├ /proposals/{proposalId}
   ├ /adjustments/{adjustmentId}
   ├ /mediationEvents/{eventId}         ← toPartyId フィールドを持つ
   ├ /notifications/{notificationId}
   └ /obligations/{obligationId}
         ├ /fulfillments/{id}
         └ /deviations/{id}

/contactInfo/{partyId}                  ← ★ケース配下に置かない（§3.2）

/masters/topicCategories/{id}
/masters/scenarios/{id}
/masters/payloadSchemas/{id}
/masters/clauseTemplates/{id}

/llmCallLogs/{id}                       ← コスト計測（§4.3）
```

### 3.2 ★ ContactInfo をケース配下に置かない

非開示情報（住所・電話・勤務先）を `/cases/{caseId}/...` の下に置くと、**ケースへのアクセス権が誤って広がった瞬間に相手の個人情報まで到達可能になる。**

そこで `/contactInfo/{partyId}` を**独立したルートコレクション**とし、`partyId` 本人以外はいかなる経路でも到達できないようにする。

> **パスの設計そのものが FR-09（非開示情報の分離）の実装である。**

### 3.3 リレーショナルモデルからの写像

[functional-design.md §4](functional-design.md) の ER をドキュメント指向に写す際の方針。

| 元の関係 | Firestore での表現 | 理由 |
| --- | --- | --- |
| Case → Party / Child / Consultation | **サブコレクション** | 常にケース単位で読む |
| Consultation → Message | **サブコレクション** | 相談単位でコンテキストを組む（§4.2） |
| AgreementItem → Revision | **サブコレクション** | 履歴は追記のみ |
| Proposal / Adjustment | ケース直下のコレクション ＋ `agreementItemId` フィールド | 論点横断で引くことがある |
| マスタ類 | **ルートの `/masters`** | ケースに依存しない。全ケースで共有 |
| PayloadSchema の参照 | `payloadSchemaId` を**文字列で保持** | 参照整合はアプリ層とテストで担保 |

**トランザクションが必要な箇所**

| 操作 | 理由 |
| --- | --- |
| 恒久的変更の確定 | `AgreementItem` 更新 ＋ `AgreementRevision` 追加 ＋ `Obligation` 再生成を不可分に行う |
| 合意の確定 | `AgreementItem` 更新 ＋ `Obligation` 生成 |

Firestore のトランザクションは同一データベース内で成立するため、いずれも1トランザクションで完結する。

---

## 4. LLM ルーティングとコスト計測

### 4.0 OrcaRouter の仕様（2026-08-11 調査）

| 項目 | 内容 |
| --- | --- |
| 提供元 | Continuum AI |
| エンドポイント | **`https://api.orcarouter.ai/v1`** |
| API 互換性 | **OpenAI 互換。**`base_url` を差し替えるだけで既存 SDK がそのまま動く |
| 対応プロバイダ | OpenAI / Anthropic / Google / DeepSeek / xAI / Qwen / Kimi / MiniMax / Z.ai ほか（**200+ モデル**） |
| モデルID | プロバイダ接頭辞つき（`openai/`, `google/`, `anthropic/` …） |
| 課金 | **ゼロマークアップ。**プロバイダの公表価格をそのまま支払う |
| プラン | **Hacker（無料・永年）** / Team $49/mo / Enterprise |
| **構造化出力** | **対応。**`response_format` の `json_object` / `json_schema` |
| レート制限 | **ワークスペース単位**（キー単位ではない）。超過時 `429` ＋ `Retry-After` |
| 価格カタログ | **公開API：`https://api.orcarouter.ai/api/pricing`**。<br>応答は `{ data: [{ model_name, model_ratio, completion_ratio, cache_ratio }, …] }` の**配列**（182件・2026-08-11 実測）。<br>モデル名をキーにした辞書ではない |
| その他機能 | Auto Router / Fusion / Model Fallbacks / Routing DSL / Guardrails / Agent Firewall |

#### 構造化出力のプロバイダ別対応

| プロバイダ | `json_object` | `json_schema` | 備考 |
| --- | --- | --- | --- |
| OpenAI | ✅ | ✅ | ネイティブ |
| Google Gemini | ✅ | ✅ | `responseMimeType` ＋ `responseSchema` に変換される |
| xAI Grok | ✅ | ✅ | OpenAI 互換 |
| DeepSeek | ✅ | ⚠️ | モデルごとに要確認 |
| **Anthropic** | ドキュメント上 ❌ | **実測 ✅** | **公式ドキュメントは非対応とするが、実機では `json_schema` が通った**（2026-08-11 検証）。ゲートウェイが変換していると見られる |

#### ★ strict モードの制約（2026-08-11 実測）

**`strict: true` の `json_schema` は、全プロパティが `required` であることを要求する。**
一部を省いて送ると `400` が返る。

これは P3（数字と条項をLLMに作らせない）と衝突する。
提案は部分的であり、「月3万」しか書かれていない入力に対して支払日や終期まで
`required` にすると、**モデルは値を埋めるしかなくなる。**

**解：全項目を `required` にしたうえで、型と enum に `null` を許す。**

```
type: "integer"            →  type: ["integer", "null"]
enum: ["LAST_DAY","DAY_5"] →  enum: ["LAST_DAY","DAY_5", null]
```

モデルは「書かれていない」と答えられるようになり、
受け取った側で `null` を落とせば、書かれた項目だけが残る。

> **nullable にすることが P3 の担保そのものである。**
> null を返せないと、モデルは値を埋めるしかない。

> ✅ **実測で解決（2026-08-11）。**`anthropic/claude-sonnet-5` に `json_schema` を指定したところ、スキーマに準拠した JSON が返った。
> 公式ドキュメントの対応表は「非対応」としているが、**OrcaRouter 側で `tool_use` に変換していると見られる**。
> ただし**ドキュメントの保証がない挙動**であるため、依存する場合は定期的に再検証すること。

#### 価格の読み方

`/api/pricing` はレシオ方式で価格を返す。

```
入力単価（$/1Mトークン） = model_ratio × 2
出力単価（$/1Mトークン） = 入力単価 × completion_ratio
キャッシュ入力          = 入力単価 × cache_ratio
```

既知の公開価格と照合して検算済み（`openai/gpt-5.1` → $1.25 / $10.00、`google/gemini-2.5-flash` → $0.30 / $2.50）。

> **★単価が引けないと原価が黙って0円になり、CT-1 が狂う。**必ず警告を出すこと（S3 で実際に踏んだ）。

> **単価をハードコードせず、`/api/pricing` から取得してキャッシュする。**プロバイダの値下げが自動的に反映され、CT-1〜CT-4 が常に正確になる。

### 4.1 階層の抽象化

```ts
enum ModelTier { SMALL, MEDIUM, LARGE }

type TierConfig = {
  model: string
  requiresStructuredOutput: boolean
}
// 単価は /api/pricing から動的取得する（ハードコードしない）
```

#### 割り当て（2026-08-11 時点の候補）

| 階層 | 採用モデル | 入力 $/1M | 出力 $/1M | 構造化 | 選定理由 |
| --- | --- | --- | --- | --- | --- |
| **SMALL** | **`openai/gpt-4.1-nano`** | 0.10 | 0.40 | ✅ | **非推論モデル。**実測で最安（→ §4.1a） |
| **MEDIUM** | `openai/gpt-4.1-mini` | 0.40 | **1.60** | ✅ | 応答が長いため**出力単価**を重視 |
| **LARGE** | `openai/gpt-5.1`<br>**＋ `reasoning_effort=medium`** | 1.25 | 10.00 | ✅ | フロンティア級で最安帯。低頻度のため単価より品質を優先。<br>★**推論モデルのため effort の明示が必須**（M-2） |

### 4.1a ★ 推論モデルの罠（2026-08-11 実測）

**同一タスクを各モデルで実行し、実際のトークン数と原価を計測した。**

| モデル | 入力 | 出力 | 円/回 |
| --- | --- | --- | --- |
| `gpt-5-nano`（既定） | 98 | **1,358** | **0.0822** |
| `gpt-5-nano`（`reasoning_effort=minimal`） | 98 | 54 | 0.0040 |
| **`gpt-4.1-nano`（非推論）** | 99 | 29 | **0.0032** |
| `gpt-4o-mini`（非推論） | 99 | 37 | 0.0056 |
| `gemini-2.5-flash-lite`（非推論） | 40 | 68 | 0.0047 |

> **推論モデルは、既定設定のままだと思考トークンが出力に計上され、原価が20倍になる。**
> 単価表だけを見て `gpt-5-nano`（入力 $0.05）を選ぶと、実際には `gpt-4.1-nano`（入力 $0.10）より高くつく。

#### 規約

| # | 規約 |
| --- | --- |
| **M-1** | **高頻度の処理（SMALL）には非推論モデルを使う。**分類・抽出に思考は要らない |
| **M-2** | **推論モデルを使う場合は `reasoning_effort` を必ず明示する。**既定値に任せない |
| **M-3** | 階層を変更したら、**採用前に実測する。**単価表だけで判断しない |

> **M-3 は実際にこの計測で救われた。**机上計算では気づけない差である。

**代替候補**

| 階層 | 代替 | 入力 / 出力 | 備考 |
| --- | --- | --- | --- |
| SMALL | `openai/gpt-5-nano` ＋ `reasoning_effort=minimal` | 0.05 / 0.40 | 設定を忘れると20倍になる |
| SMALL | `google/gemini-2.5-flash-lite` | 0.10 / 0.40 | GCP との親和性 |
| MEDIUM | `openai/gpt-5-mini` | 0.25 / 2.00 | 入力重視ならこちら |
| LARGE | `anthropic/claude-sonnet-5` | 2.00 / 10.00 | 日本語の自然さで優位の可能性。**構造化出力は要検証** |

> **モデルIDは設定値とする。**`/api/pricing` の内容は変動するため、定期的に見直す。

### 4.2 用途と階層の割り当て

| 用途 | 階層 | 頻度 | 備考 |
| --- | --- | --- | --- |
| 意図分類・危険検知 | **SMALL** | 全メッセージ（最高） | 出力が短く定型 |
| 提案の構造化 | **SMALL** | 高 | JSON Schema による構造化出力 |
| 感情の受け止め | **MEDIUM** | 中 | 相手に届かない領域 |
| 事情の抽出・再構成 | **MEDIUM** | 中 | ホワイトリスト適用（§5.1a） |
| 相手への中立文の生成 | **MEDIUM** | 中 | |
| 調停案の生成 | **LARGE** | **低**（論点ごとに1〜数回） | 説明文のみ生成。金額は算定表由来 |
| 条項の生成 | **なし** | — | ひな形置換 |
| 金額の算定 | **なし** | — | 算定表参照 |

**1メッセージあたりの標準的な呼び出し**

| 階層 | 回数 |
| --- | --- |
| SMALL | 2 |
| MEDIUM | 2 |
| **LARGE** | **0** |

> **頻度と単価が逆相関する。**LARGE は論点ごとに数回しか発生しないため、往復が増えても原価はほぼ SMALL / MEDIUM で決まる。

### 4.3 コスト計測

すべての LLM 呼び出しを `/llmCallLogs` に記録する。

| フィールド | 内容 |
| --- | --- |
| `caseId` / `consultationId` | どの相談か |
| `purpose` | 用途（意図分類、調停案生成 …） |
| `tier` | SMALL / MEDIUM / LARGE |
| `inputTokens` / `outputTokens` | 実測値 |
| `costJpy` | 単価から算出 |

| 目標 | 算出方法 |
| --- | --- |
| **CT-1** メッセージ単価 | `SUM(costJpy) / COUNT(message)` |
| **CT-2** 世帯あたり月額原価 | ケース単位の月次集計 |
| **CT-3** 月額500円下での粗利 | 課金額 − CT-2 |
| **CT-4** ルーティングなしとの比較 | **同じログの `inputTokens` / `outputTokens` に LARGE の単価を掛け直す**。実測ベースで削減率を出せる |

> **CT-4 が実測で出せることが重要。**「ルーティングにより原価を◯%削減」を推測ではなく計測値として提示できる。

### 4.3a ★ S3 での実測（2026-08-11）

疎通確認スクリプト（`scripts/verify-llm.ts`）による実測値。

| # | 呼び出し | 入力 | 出力 | 原価 |
| --- | --- | --- | --- | --- |
| ① | SMALL・素の呼び出し | 47 | 2 | 0.0008円 |
| ② | **SMALL・構造化出力**（`json_schema`） | 89 | 13 | 0.0021円 |

**CT-4（ルーティングなしとの比較）**

| | |
| --- | --- |
| 実際 | **0.0029円** |
| 全部 LARGE なら | 0.0480円 |
| **削減率** | **93.9%** |

> **CT-4 が実測で出せることを確認した。**保存されたログの `inputTokens` / `outputTokens` に
> LARGE の単価を掛け直すだけで算出できる。**推測ではなく計測値として提示できる。**

構造化出力は `openai/gpt-4.1-nano` で正しく動作した（`{"intent":"SCHEDULE_CHANGE","urgency":"MEDIUM"}`）。

---

### 4.4 事前試算（2026-08-11）

**§4.1 の割り当てと、以下のトークン数の想定に基づく机上計算。**実測は S3・S14 で行う。

#### 1メッセージあたり

| 処理 | 階層 | 入力 | 出力 | 原価 |
| --- | --- | --- | --- | --- |
| 意図分類 | SMALL | 1,500 | 100 | 0.029円 |
| 提案の構造化 | SMALL | 1,500 | 200 | 0.035円 |
| 感情の受け止め | MEDIUM | 2,000 | 300 | 0.192円 |
| 取次ぎ | MEDIUM | 800 | 250 | 0.108円 |
| **合計** | | | | **約0.36円** |

調停案の生成（LARGE、入力3,000 / 出力800）は **1回あたり約1.76円**。論点ごとに数回のみ発生する。

#### CT-4：ルーティングの効果

| | 1メッセージあたり |
| --- | --- |
| 3階層ルーティング | **0.36円** |
| 全処理を LARGE で実行 | 2.36円 |
| **削減率** | **約85%** |

#### CT-2・CT-3：世帯あたり月額原価

| 局面 | 想定 | 月額原価 | 月額500円に対する粗利率 |
| --- | --- | --- | --- |
| **運用期** | 月20通 ＋ 調停1回 | **約9円** | 98% |
| **協議期**（最繁忙） | 月100通 ＋ 調停6回 | **約47円** | 91% |

> **市場アンカーである月額500円に対し、最繁忙期でも原価は約45円。CT-3 は十分な余裕をもって成立する。**
>
> ⚠️ ただしこれは**トークン数を仮定した机上計算**である。実際の会話は想定より長くなりうる。**S3 で実測に置き換える。**

#### 試算から導かれる設計上の含意

| # | 含意 |
| --- | --- |
| 1 | **原価の8割超を MEDIUM が占める**（感情の受け止め ＋ 取次ぎ）。コスト最適化の余地はここに集中している |
| 2 | 意図分類は全メッセージで走るが、原価への寄与は5%未満。**SMALL に寄せた判断は正しい** |
| 3 | LARGE は低頻度のため、品質のために上位モデルを選ぶ余地が大きい |
| 4 | **原価より応答速度が制約になる可能性が高い**（→ §7.1） |

---

### 4.9 環境変数の残留による誤接続 ★実際に踏んだ

**`GOOGLE_CLOUD_PROJECT` はシェル環境に残りやすい。**
別プロジェクトの作業で export したものが残っていると、`.env.local` に書いても効かない。

> **Next.js は、既に設定済みの環境変数を `.env` ファイルで上書きしない。**

開発中、Firestore が別プロジェクト（`makelocalpizzarecipeagent`）を読みに行き、
招待が「見つからない」状態になった。**エラーは出ない。**空のクエリ結果が返るだけである。

| 対策 | |
| --- | --- |
| **アプリ固有名を優先** | `FIREBASE_PROJECT_ID` → `GOOGLE_CLOUD_PROJECT` → 既定値 の順に解決する |
| **接続先をログに出す** | `[firestore] 接続先プロジェクト: …` を毎回出す。黙って別プロジェクトを読ませない |
| **空文字を未設定として扱う** | `??` ではなく `||`。`VAR=` と書くと空文字が入り、`??` は既定値に落ちない |

本番（Cloud Run）では `FIREBASE_PROJECT_ID` を設定しないため、
ランタイムが与える `GOOGLE_CLOUD_PROJECT` が使われる。

---

## 5. セキュリティ

### 5.1 5層防御

C1 と非開示情報保護を、**アプリ層だけに依存させない**。

| 層 | 対策 | 実装場所 |
| --- | --- | --- |
| **L0. データストア** | **Firestore セキュリティルール（default deny）** | `firestore.rules` |
| **L1. 構造** | ContextBuilder の許可リスト。`buildRelayContext` は `partyId` を引数に取らない | アプリ |
| **L2. 入力** | 意図分類による `INFO_QUERY` 検知、指示上書き試行のパターン検知 | アプリ |
| **L3. 境界** | ユーザー入力を区切りで囲み、データとして扱うことを明示 | プロンプト |
| **L4. 出力** | PII 検出（正規表現 ＋ DB 既知値との照合）。検出時はブロックして再生成 | アプリ |

### 5.2 ★ L0：クライアントからの直接アクセスを禁止する

**Firestore へのクライアント直アクセスは一切許可しない。**Firebase SDK は**認証のみ**に使用し、データ操作はすべて Cloud Run 上の Admin SDK 経由とする。

```
// firestore.rules（方針）
match /{document=**} {
  allow read, write: if false;     // クライアントからは全面拒否
}
```

**この設計の意味**

| | |
| --- | --- |
| 通常時 | すべてのアクセスが API 層を通り、スコープ規約 A-1〜A-4（→ functional-design.md §7.6）が適用される |
| **最悪ケース** | モバイルアプリから Firebase 設定値を抽出して直接クエリしても、**ルールが拒否するため相手のデータに到達できない** |

> **アプリ層のバグが即座に情報漏洩にならない。**L0 と L1 が独立しているため、片方が破れても他方が残る。

### 5.2a OrcaRouter Guardrails を追加の防御層として使う

OrcaRouter は**ゲートウェイ側でプロンプト・応答を検査する機能**を持つ（2026-08-11 調査）。

| 機能 | 内容 | 本プロダクトでの用途 |
| --- | --- | --- |
| **PII Shield** | メールアドレス・電話番号・カード番号等を**マスクまたはブロック** | **L4（出力フィルタ）の二重化** |
| **Prompt Injection 検知** | 直接・間接のインジェクションをゲートウェイで検知 | **L2（入力検知）の二重化** |
| Secrets Blocker | APIキー・JWT・秘密鍵の混入を検知 | 誤ってシークレットを送らない保険 |
| Cost Guardrails | リクエスト／レスポンスのサイズ上限 | denial-of-wallet 対策 |
| 適用モード | observe / shadow / enforce の3段階 | 段階的に有効化できる |

**採用方針**

| # | 方針 |
| --- | --- |
| 1 | **自前実装（L1〜L4）を主とし、Guardrails は独立した追加層として併用する** |
| 2 | **Guardrails に依存しない。**本プロダクトの中核防御は L0（Firestore default deny）と L1（ContextBuilder）であり、これらはゲートウェイの外にある |
| 3 | 導入は `observe` から始め、誤検知の傾向を見てから `enforce` に上げる |

> **依存させない理由：**Guardrails はプロンプトが**ゲートウェイに到達してから**検査する。本プロダクトの設計は「非開示情報をそもそもコンテキストに載せない」ことが本質であり、**送ってから止めるのでは遅い**。
>
> ただし、実装バグで万一載ってしまった場合の**最後の網**としては価値がある。**独立した事業者による検査**である点も、防御層としての独立性を高める。

### 5.3 CI に組み込む検証

以下を GitHub Actions の必須ジョブとする。**通らなければマージできない。**

| # | 検証 | 対応 |
| --- | --- | --- |
| 1 | **不変条件テスト** INV-1〜INV-4 | functional-design.md §4.10 |
| 2 | **Firestore ルールのテスト**（クライアントから全コレクションが読めないこと） | §5.2 |
| 3 | **`ClauseTemplate` のプレースホルダ整合**（G-3） | functional-design.md §4.9 |
| 4 | `LlmRouter` を経由しない LLM 呼び出しがないこと（静的検査） | §2.2.3 |
| 5 | シークレットのコミット検出（gitleaks 等） | — |

### 5.4 シークレット管理

- すべて **Secret Manager**。Cloud Run 起動時にサービスアカウント経由で読み込む
- リポジトリに `.env` を含めない。`.env.example` のみ
- OrcaRouter API キーは**サーバー側のみ**。クライアントに渡さない

### 5.5 ログの取り扱い

| 対象 | 方針 |
| --- | --- |
| `Message.content`（原文） | **ログに出力しない。**Firestore にのみ保存 |
| `ContactInfo` | **ログに出力しない** |
| LLM のプロンプト・応答 | **本文を出さない。**トークン数・階層・用途・所要時間のみ記録 |
| エラー | スタックトレースは記録。ユーザー入力は含めない |

> **可観測性のためにプライバシーを犠牲にしない。**デバッグに本文が必要な場合は、開発環境の合成データで再現する。

---

## 6. 環境構成

### 6.1 環境一覧

| 環境 | 用途 | デプロイ | 備考 |
| --- | --- | --- | --- |
| local | 開発 | — | Firestore Emulator ＋ OrcaRouter のモック |
| dev | 動作確認 | `main` への push | Cloud Run（最小 0） |
| prod | 本番 | `v*` タグ | Cloud Run（最小 0） |

### 6.2 主要な環境変数

| 変数名 | 用途 | 配置 |
| --- | --- | --- |
| `GOOGLE_CLOUD_PROJECT` | プロジェクト ID | server |
| `ORCAROUTER_API_KEY` | OrcaRouter 認証（`sk-orca-...`） | **server のみ**（Secret Manager） |
| `ORCAROUTER_BASE_URL` | `https://api.orcarouter.ai/v1` | server |
| `MODEL_TIER_SMALL` / `_MEDIUM` / `_LARGE` | 階層 → モデル ID | server |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK | server |
| `NEXT_PUBLIC_FIREBASE_*` | クライアント認証設定 | client（公開可） |

### 6.3 リージョン

- **asia-northeast1（東京）**
- 個人情報を扱うため、データの所在地を国内に限定する

---

## 7. パフォーマンス・コスト要件

### 7.1 応答時間

| 操作 | 目標 |
| --- | --- |
| 意図分類 ＋ 感情の受け止め（初回応答） | **3秒以内** |
| 相手への取次ぎ生成 | 10秒以内（非同期でよい） |
| 調停案の生成 | 30秒以内（「検討中」表示を出す） |
| 合意状態の表示 | 1秒以内 |

> **初回応答の速さを最優先する。**感情的な状態で入力した直後に無反応だと、体験が崩れる。取次ぎと調停は非同期でよい。

### 7.2 コスト設計

| 前提 | 値 |
| --- | --- |
| 市場の価格アンカー | **月額500円**（→ product-requirements.md §5.2） |
| 収益構造 | 入口の一時課金 ＋ 継続の月額（二階建て） |

**継続課金層で粗利が成立する原価に収めることを設計目標とする（CT-3）。**

| コスト要素 | 抑制方法 |
| --- | --- |
| LLM | 階層ルーティング（§4.2）。高頻度処理を SMALL に寄せる |
| コンピュート | Cloud Run 最小インスタンス 0 |
| データベース | Firestore の従量課金。相談単位でコンテキストを絞り読み取り量を抑える |
| バッチ | Cloud Run Jobs（日次のみ） |

### 7.3 スケーラビリティ

- Cloud Run のオートスケール（最大インスタンス数で上限を設定）
- Firestore はケース単位でシャーディングされるため、ケース数の増加に対して線形

---

## 8. 可観測性

### 8.1 トレース設計

調停パイプラインの各ステップをスパンとして記録する。

```
consultation.postMessage
 ├─ classify.intent          [SMALL]
 ├─ respond.emotional        [MEDIUM]
 ├─ extract.context          [MEDIUM]
 ├─ structure.proposal       [SMALL]
 └─ relay.generate           [MEDIUM]

agreement.mediate
 ├─ supportTable.lookup      [LLM不使用]
 └─ generate.mediation       [LARGE]
```

**どのステップで時間と費用がかかっているかを、階層とセットで可視化する。**

### 8.2 メトリクス

| メトリクス | 用途 |
| --- | --- |
| LLM 階層別の呼び出し回数・トークン数・費用 | CT-1〜CT-4 |
| 合意成立率 | product-requirements.md §4.2 |
| 調停エスカレーション率 | 同上 |
| PII 検出によるブロック回数 | **0 でないなら設計を見直す** |
| INV 違反の検出回数 | **常に 0 であるべき** |

### 8.3 アラート

| 条件 | 通知 |
| --- | --- |
| PII 出力フィルタ（L4）が発火 | **即時**。L0〜L1 が破れている可能性 |
| 5xx 率の上昇 | 通常 |
| LLM 原価が想定を超過 | 日次 |

---

## 9. 技術的制約と未確定事項

### 9.1 制約

| # | 制約 |
| --- | --- |
| 1 | **LLM 呼び出しは OrcaRouter 経由に限る。**直接呼び出しを作らない |
| 1a | **単価をハードコードしない。**`/api/pricing` から取得してキャッシュする |
| 2 | **金額と条項の生成に LLM を使わない**（P3 / NFR-03 L-1） |
| 3 | **クライアントから Firestore へ直接アクセスしない**（§5.2） |
| 4 | **原文と非開示情報をログに出さない**（§5.5） |
| 5 | データの所在地を国内（asia-northeast1）に限定する |

### 9.2 未確定事項

| # | 内容 | 影響 |
| --- | --- | --- |
| ~~A-01~~ | ~~OrcaRouter の利用可能モデル・単価・レート制限~~ | ✅ **解決**（2026-08-11 / → §4.0・§4.4） |
| ~~A-02~~ | ~~OrcaRouter の構造化出力（JSON Schema）対応可否~~ | ✅ **解決**：`response_format` で対応 |
| ~~A-06~~ | ~~Anthropic の `response_format` 実機検証~~ | ✅ **解決**（2026-08-11 実測）：**Anthropic でも `json_schema` が通った。**公式ドキュメントの記載と異なり、ゲートウェイが変換していると見られる |
| ~~A-07~~ | ~~レート制限の具体値~~ | ✅ **解決**（2026-08-11 実測）：`x-ratelimit-limit-requests: 30000` / `x-ratelimit-limit-tokens: 150,000,000`。**本プロダクトの規模では制約にならない** |
| **A-08** | **MEDIUM / LARGE の推論設定**（`gpt-4.1-mini` は非推論だが `gpt-5.1` は推論モデル。`reasoning_effort` の指定が必要か） | §4.1a M-2 |
| A-03 | 本人確認の方式（招待コードのみか、eKYC を要するか） | §2.2.4 認証 |
| A-04 | プッシュ通知の実装（Web Push / FCM） | 通知に本文を出さない要件との整合 |
| A-05 | 添付ファイル（写真）のスキャン方針 | Cloud Storage の運用 |

> **A-01 は最優先。**これが確定しないと §4 のコスト設計が数値として成立しない。
