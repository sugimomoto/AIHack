# タスクリスト — S15：招待・準備モード ★C2

| 項目 | 内容 |
| --- | --- |
| 作業ID | `20260811-s15-invitation` |
| 作成日 | 2026-08-11 |
| 前提 | [requirements.md](requirements.md) |

---

## ★ テストファーストの実施記録

規約 §5.0 に従い、**3回とも実装より先にテストをコミットした。**

```
99191e0  test(S15): 年収の帯変換・招待のテストを実装より先に書く    ← 落ちる状態
a2a1612  feat(S15): 招待・準備モード・年収の帯変換を実装
（次）    test(S15): 招待の公開ビューのテストを実装より先に書く      ← 落ちる状態
（次）    feat(S15): 招待の永続化とAPIを実装
```

### テストが2件の誤りを検出した

| 検出 | 内容 |
| --- | --- |
| **算定表の帯** | `4,380,000円` は 438万円であり、25万円刻みでは **425-450**。<br>デザイン納品物と初期ドキュメントは `400-425` と誤記していた |
| **画面の約束** | 「離婚・養育費・調停といった語も使いません」と本文についても<br>書いたため、**本文に対する禁止語テストを追加**した |

---

## 完了

### T1｜年収の帯変換 ✅

- [x] `tests/invariants/incomeBand.test.ts`（先行・15件）
- [x] `src/domain/income/band.ts` — `toIncomeBand` / `parseBand` / `INCOME_BAND_NOTE`
- [x] `src/domain/preparation/profile.ts` — **`planProfileWrite`**（どこに何を書くかを分解）
- [x] `tests/invariants/profileWrite.test.ts` — **`partyPatch` に精密な年収・住所が現れない**

### T2｜招待 ✅

- [x] `tests/domain/invitation.test.ts`（先行・24件）
- [x] `src/domain/invitation/stateMachine.ts` — 受諾・辞退・期限切れはいずれも終端
- [x] `token.ts` — 32バイトの乱数、**`hashToken`（sha256）**
- [x] `mail.ts` — **引数に本文がない。**文面はデザイン納品物の確定文言
- [x] `types.ts` / **`publicView.ts`**

### T3｜公開ビュー（A-6）✅

- [x] `tests/invariants/invitationPublicView.test.ts`（先行・10件）
- [x] **返すのは `state` と `senderName` のみ**
- [x] `DECLINED` を `USED` に丸める（辞退を相手に知らせない）
- [x] 存在しないトークンと期限切れを区別しない

### T4｜準備モード ✅

- [x] `src/domain/preparation/draft.ts` — `Proposal.status = DRAFT`
- [x] `promoteDrafts()` — 参加時に `PENDING` へ。**DRAFT 以外は触らない**
- [x] `allowedInPreparation()` — **取次ぎ・調停を生成しない**

### T5｜永続化 ✅

- [x] `invitationRepository.ts` — **`tokenHash` で保存・照会**
- [x] **ルートコレクションに置く**（未参加者にケース配下を読ませない）
- [x] `caseRepository.saveOwnContactInfo()` / `patchParty()`

### T6｜API ✅

| ルート | |
| --- | --- |
| `POST /api/invitations` | 作成＋文面のプレビュー。**再送APIは無い** |
| `GET /api/invite/[token]` | **未認証。**`toPublicView` を必ず経由 |
| `POST /api/invite/[token]/accept` | 受諾・辞退 |
| `POST /api/profile` | `planProfileWrite` 経由で分解して保存 |

### T7｜画面 ✅

| 画面 | 対応 |
| --- | --- |
| `/onboarding/invite` | A-1｜招待の作成（**2枚のカードに主従を作らない**） |
| 同（遷移） | A-2｜送信前のプレビュー・実名トグル |
| `/invite/[token]` | A-3｜受け取った側（**勧誘の言葉を置かない**） |
| `/onboarding/profile` | 年収の入力（**帯への変換をその場で見せる**） |

- [x] `PhoneFrame` — モックと寸法をそろえる
- [x] **プレビューは `buildInvitationMail` をそのまま呼ぶ**（見せた文面と送る文面がずれない）

### T8｜実データでの確認 ✅

```
入力 4,380,000円 → お相手に見える形 425〜450万円     ✓
招待メールの実名トグル（架空 太郎さま ⇄ ご関係の方）   ✓
未知のトークン → 「ご利用いただけません」            ✓
有効なトークン → {"state":"OPEN","senderName":…}     ✓
```

---

## 受け入れ条件

| # | 条件 | 状態 |
| --- | --- | --- |
| AC-01 | **精密な年収が `Party` に保存されない** | ✅ `planProfileWrite` ＋テスト |
| AC-02 | 帯が算定表の区分と一致する | ⚠️ **区分は暫定（R-18）。**S6 で確定 |
| AC-03 | **招待トークンが推測困難** | ✅ 32バイト・1000回衝突なし |
| AC-04 | **本文に当事者の入力が混入しない** | ✅ 引数に本文が無いことを検証 |
| AC-05 | 件名に禁止語が含まれない | ✅ **本文についても検証** |
| AC-06 | リンク方式でアプリが接触しない | ✅ `recipientEmail` は EMAIL のみ |
| AC-07 | 送信前に文面をそのまま確認できる | ✅ 同じ関数で生成 |
| AC-08 | 送信者名の露出を選べる | ✅ 実データで確認 |
| AC-09 | **再送のAPIが存在しない** | ✅ |
| AC-10 | 受諾・辞退・期限切れを扱える | ✅ ★ケースの `ACTIVE` 化は S16 |
| AC-11 | 参加前でも対話と下書きができる | ⚠️ **ドメインまで。**画面は S16 |
| AC-12 | **取次ぎが生成されない** | ✅ `allowedInPreparation` |
| AC-13 | 参加後に提案化できる | ✅ `promoteDrafts` |

**テスト170件が通過。**

---

## 設計上の記録

### 制約が安全性に転じている

`buildInvitationMail` の引数に本文が無い。**当事者は自由文を書けない。**
その結果、この経路で罵倒や脅迫を送ることができない。
通常のメールより安全な連絡手段になっている。

### 「断ってよい」をメールに書かない

| | |
| --- | --- |
| **メール** | 相手の職場や家庭で見られうる。情報量を最小にする |
| **A-3 の画面** | 本人が一人で見ている。**ここで初めて選択を提示する** |

メールに求めるのは「急かさないこと」までとした。

### 状態を3値に丸める

`DECLINED` をそのまま返すと、辞退したことが招待した側に伝わる。
存在しないトークンと期限切れも区別しない（**有効なトークンの探索に使える**）。

### ★環境変数の残留で別プロジェクトを読んでいた

開発中、Firestore が `makelocalpizzarecipeagent` に接続していた。
**エラーは出ない。**空のクエリ結果が返るだけである。
→ [architecture.md §4.9](../../docs/architecture.md) に記録した。

---

## 残タスク（S16 へ）

- [ ] ケースの `ACTIVE` 化（受諾時）— 対話の経路が繋がってから
- [ ] 準備モードの画面（A-4「いまは、ひとりで進めています」）
- [ ] メール送信基盤の選定（C-02）
- [ ] 招待作成画面と API の接続（認証が必要）
