# タスクリスト — S3：LLM基盤・ルーティング

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s3-llm` |
| 作成日 | 2026-08-11 |
| 前提 | [requirements.md](requirements.md) |

---

## ★ テストファーストの実施記録

```
（前）  test(S3): LLM基盤のテストを実装より先に書く    ← 落ちる状態
（次）  feat(S3): LlmRouter を唯一の入口として実装
```

### テストが3件の問題を検出した

| # | 検出 |
| --- | --- |
| 1 | **設計書が自らの規約に違反していた。**architecture.md §4.1 は LARGE に<br>`openai/gpt-5.1`（推論モデル）を選びながら、M-2 が要求する<br>`reasoning_effort` を指定していなかった |
| 2 | **`.env.local` の SMALL が `openai/gpt-5-nano` のままだった。**<br>実測で原価20倍だったモデルである（§4.1a の発見が反映されていなかった） |
| 3 | `.env.example` も同様 |

> **M-2 を「設定の検査」にしたことが効いた。**コメントでの注意喚起なら見落としていた。

---

## 完了

### T1｜静的検査（先行）✅

- [x] `tests/invariants/llmRouterGuard.test.ts`
  - Router の外で `openai` SDK を import していない
  - **エンドポイント・APIキーを直接参照していない**
  - 検査対象が実在する（**テストが空振りしていないこと**も検証）

### T2｜階層設定 ✅

- [x] `src/domain/llm/tier.ts` — `isReasoningModel` / `assertTierConfig` / `TIER_CONFIG`
- [x] **起動時に検査する**（実行時まで気づかないと、その間ずっと原価が狂う）
- [x] 非推論モデルに `reasoning_effort` を付けた場合も落とす

### T3｜ログ ✅

- [x] `src/domain/llm/callLog.ts` — **`prompt` / `completion` というキーが存在しない型**
- [x] `toCallLog` は**必要なキーだけを積む**（分割代入で残りを渡さない）
- [x] `llmCallLogRepository.ts` — **記録の失敗で対話を止めない**

### T4｜単価 ✅

- [x] `src/domain/llm/pricing.ts` — レシオ方式の算出、`costJpyOf`
- [x] `pricingCatalog.ts` — `/api/pricing` から取得・24時間キャッシュ
- [x] **取得失敗でも呼び出しを止めない**（最後に成功した値を使う）
- [x] **単価が引けないとき警告を出す**（黙って0円にしない）

### T5｜Router ✅

- [x] `src/infra-adapters/llm/router.ts` — `callLlm` / `callLlmStructured`
- [x] **OpenAI SDK を使わず fetch で呼ぶ**（依存を増やさず、静的検査を単純にする）
- [x] 429 と `Retry-After`（上限10秒・2回まで）
- [x] **エラーに応答本文を載せない**（G-F）

### T6｜疎通確認 ✅

`scripts/verify-llm.ts`

```
階層設定:
  SMALL  openai/gpt-4.1-nano
  MEDIUM openai/gpt-4.1-mini
  LARGE  openai/gpt-5.1 (effort=medium)

① SMALL・素の呼び出し        入力47 / 出力 2 → 0.0008円
② SMALL・構造化出力          入力89 / 出力13 → 0.0021円
   応答: {"intent":"SCHEDULE_CHANGE","urgency":"MEDIUM"}

③ ★G-F：ログに原文が残らないこと
   プロンプトが含まれない: ✓
   応答本文が含まれない  : ✓

④ ★CT-4：ルーティングなしとの比較
   実際          : 0.0029円（2件）
   全部LARGEなら : 0.0480円
   削減率        : 93.9%
```

---

## 受け入れ条件

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **Router を経由しない呼び出しが静的検査で検出される** | ✅ |
| AC-02 | **ログにプロンプト・応答本文が含まれない** | ✅ 型＋実機で確認 |
| AC-03 | **推論モデルの設定漏れが検出される** | ✅ **実際に3件検出した** |
| AC-04 | 単価がレシオ方式から正しく算出される | ✅ 既知価格と一致 |
| AC-05 | すべての呼び出しが記録される | ✅ |
| AC-06 | 単価が `/api/pricing` から取得される | ✅ 182件 |
| AC-07 | **`json_schema` で構造化出力が得られる** | ✅ **実機で疎通** |
| AC-08 | 429 で `Retry-After` に従う | ✅ 実装（未発火） |
| AC-09 | **CT-4 が計算できる** | ✅ **93.9%** |

**テスト193件が通過。**

---

## 設計上の記録

### SDK を使わない

OrcaRouter は OpenAI 互換であり、必要なのは1エンドポイントのみである。
`fetch` で呼ぶことで依存が増えず、**「SDK を import していない」という静的検査が
単純な形で成立する。**

### toCallLog は「積む」

```ts
// ❌ 取り除く形（フィールドが増えたとき自動的に混入する）
const { prompt, completion, ...log } = record;

// ✅ 積む形（増えても混入しない）
return { caseId: r.caseId, tier: r.tier, … };
```

### /api/pricing の形

**モデル名をキーにした辞書ではなく、配列である。**

```
{ data: [{ model_name, model_ratio, completion_ratio, cache_ratio }, …] }
```

当初これを辞書と誤って実装し、**原価が黙って0円になった。**
CT-1 が狂うため、単価が引けないときは必ず警告を出すようにした。

---

## 残タスク

- [ ] `/api/pricing` の日次更新（現状は起動時＋24時間キャッシュ）
- [ ] 為替レートの見直し（C-03。現状 150円/$ 固定）
- [ ] コストのダッシュボード（S14）
