# BrainClub UI 一新 — 実装プロンプト（chess.com型ナビ ＋ クラウドアカウント）

> このファイルは「BrainClub のUIを chess.com 風に一新する」ための**Claude Code向け実装指示書**です。
> ユーザーとの合意事項（下記「確定仕様」）を満たすよう、**フェーズ単位で1つずつ完成**させてください。
> 各フェーズ完了時に `npx tsc --noEmit` ＋ `npm run build` ＋ 該当 `node scripts/verify-*.mjs` を必ず通すこと。

---

## 0. ゴール（ユーザーの言葉）
chess.com のUIを参考に、**画面下部のタブバー**から `[ホーム / スコア / サブスク / 設定]` を切り替えられるようにする。
**画面左上に自分のプロフィールアイコン**を置き、ユーザー名・アイコン・プレイ履歴・スコアを確認・編集できるようにする。
各タブの中身は §3 を参照。

## 1. 確定仕様（ユーザー合意済み — 変更不可）
1. **下部タブバー**: `ホーム / スコア / サブスク / 設定` の4タブ（chess.com 風）。常時表示、現在タブをハイライト。
2. **左上プロフィール**: chess.com のようにヘッダー左にアバターアイコン。タップで自分のプロフィール画面へ。ユーザー名・アイコン・プレイ履歴・スコアを表示。
3. **ランキング表 = ティア階段**: バックエンドの他者比較ではなく、Bronze→…→Master の**段階ピラミッド**。自分の Synapse スコア/レベルが今どの段にいるかをハイライトし、次の段までの距離も見せる。
4. **プロフィールは編集可能 ＋ クラウドアカウント**: **ログインなしをやめ、Supabase によるクラウド認証**を導入。ユーザー名/アバターを編集でき、ゲームデータ（Synapse・履歴・ストリーク・所有スキン・サブスク状態）を**クラウドに保存し端末間同期**する。
5. **サブスクは Plus / Pro の2段階**: 2枚のプランカードを画面**上部に左右配置**。決済は**UIモック**（実課金なし）。
6. **設定の拡充**: BGM有無・効果音・言語設定など細かい設定を集約。
7. **ヘッダー簡素化**: 現在ヘッダーにある各トグル（テーマ🎆/🧘・音🔊・言語・ショップ🎨）は**設定画面へ集約**。上部は「左=プロフィール / 中央=ロゴ / 右=サブスク導線（💎）＋ログイン状態」だけにする。

## 2. 既存アーキテクチャ（壊さない前提）
- React 18 + Vite + TS + Tailwind、`react-router-dom`、`react-i18next`（en/ja）、PWA、Vercel 静的デプロイ。
- 状態は**pub/sub リアクティブストア**: `useSettings`/`useSynapse`/`useMonetization`/`useHowto`。命令型シングルトン: `fx`/`sound`/`haptics`。
- スコア基盤 `src/lib/synapse.ts`: 3軸（memory/logic/reflex, 各0–100）＋ `synapseScore()`（3軸平均）＋ `level/xp`。**この純関数群は再利用する**。
- テーマ/スキンは同一ルート要素の `[data-theme]`/`[data-skin]`/`[data-contrast]` トークン（`Layout.tsx`）。
- 現状ページ: `/`(Home) `/profile`(Synapseレーダー) `/premium`(1プラン) `/settings` `/play/:id[/:difficulty]`。
- ゲーム20本は `src/games/registry.ts`。各 `axes`（Synapse軸ウェイト）と `recordPlay()` 連携済み。**ゲーム本体は原則改修しない**。

## 3. 画面仕様（タブ別）

### 3.1 ホーム（`/`）
- 既存のゲームグリッドを踏襲。上部にデイリー/ストリークの帯を残す。
- 無料ユーザーには `AdSlot` を維持。下部タブバー分の `padding-bottom` を確保。

### 3.2 スコア（`/score` ＝新規）
- 上部: **大きな Synapse スコア**（0–100）＋ 現在レベル ＋ 次レベルまでの XP バー。
- 中央: **ティア・ピラミッド**（§4）。自分の段を発光ハイライト、次段までのゲージ。
- 下部: **3軸レーダー**（既存 `SynapsePanel`/自作SVG を再利用）＋ memory/logic/reflex の数値内訳。
- 「数値はゲーム内スコア（Synapse Score）であり医学/IQ指標ではない」旨の注記を小さく表示（CLAUDE.md の健全性方針）。

### 3.3 サブスク（`/premium` を改修）
- 画面**上部に Plus / Pro の2カードを左右配置**（モバイルは横スクロール or 縦積みでも可、ただし「左右」レイアウトを基本）。
  - **Plus**: 広告非表示 ＋ 全スキン解放 ＋ Zen/Arcade テーマ。
  - **Pro**: Plus の全部 ＋ Synapse 詳細統計/履歴エクスポート ＋ 限定テーマ ＋ 新ゲーム早期アクセス。
- 各カード: 月額（モック価格）・特典リスト・「現在のプラン」バッジ・`購読する/解約する`（モック）。
- 下部に特典比較表。決済は `useMonetization` を**プラン階層対応に拡張**（`plan: 'free' | 'plus' | 'pro'`）して状態のみ更新。
- `PaywallOverlay` の導線もこの2プランに合わせて更新。

### 3.4 設定（`/settings` を拡充）
- **サウンド**: BGM ON/OFF ＋ 効果音 ON/OFF ＋ マスター音量スライダー（§5でBGM追加）。
- **表示**: テーマ（Zen/Arcade）、配色（色覚配慮 high-contrast）、モーション低減の手動上書き。
- **言語**: en / ja（既存）。将来追加しやすい一覧UI。
- **アカウント**: ログイン/サインアップ/ログアウト、プロフィール編集（ユーザー名・アバター）、同期状態表示。
- **データ**: 進捗リセット（確認ダイアログ付き）、（Pro想定の）エクスポート。
- **その他**: ショップ（スキン）導線。
- ヘッダーから移設したトグルは全てここへ。

### 3.5 プロフィール（`/profile` を改修 — 左上アイコンから遷移）
- 上部: 編集可能アバター ＋ ユーザー名 ＋ 加入日 ＋ ログイン状態。
- 統計サマリ: 総プレイ数・ストリーク・現在レベル・Synapse スコア。
- **最近のプレイ履歴**（クラウド `play_history` から最新N件: ゲーム名・難易度・スコア・日時）。
- 「詳細はスコアタブへ」リンク。

## 4. ティア・ピラミッド設計
- 新規 `src/lib/tiers.ts`（純関数, 依存ゼロ）:
  - `TIERS` 定義（下→上）例: `Novice / Bronze / Silver / Gold / Platinum / Diamond / Master`。各 `{ id, nameKey, min, color }`、`min` は Synapse スコア閾値（0,15,30,45,60,75,90 等／実装時に等間隔で確定）。
  - `tierForScore(score: number): Tier`、`tierProgress(score): { tier, next, frac }`（現段内の進捗0–1と次段までの距離）。
- UI: 下が広く上が狭い**段ピラミッド**。各段にティア名。自分の段を `fx-glow` 系でハイライトし、現在スコアのマーカーと「次の段まであと N」を表示。
- **検証**: `scripts/verify-tiers.mjs`（既存 verify と同流儀・TS非import・閾値ロジックを複製）。境界値（min ちょうど/最小/最大/負値）で `tierForScore`/`tierProgress` を assert。

## 5. BGM 追加
- `src/lib/sound.ts` に **BGM**概念を追加（合成 or 軽量ループ）: `startBgm()/stopBgm()`、`setting.bgm`（既定OFF推奨, autoplay/電池配慮）、`setting.volume`（0–1）を参照。
- 効果音（既存合成音）と BGM は**独立トグル**。iOS 対策の `unlock()`/`resume()` 流儀を踏襲。reduced-motion では音は維持（視覚のみ抑制）。

## 6. クラウドアカウント（Supabase）設計
> **重要**: 静的デプロイを壊さないため、**データ層を抽象化**し、Supabase env 未設定時は**ゲスト（localStorage）モード**で従来通り動くこと。

### 6.1 依存・環境変数
- `npm i @supabase/supabase-js`。
- 環境変数（Vercel/`.env.local`）: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`。
- `src/lib/supabase.ts`: クライアント生成。env 欠如時は `null` を返し、上位でゲストモードに自動フォールバック。

### 6.2 データ層抽象 `src/lib/account.ts`（pub/sub ストア）
- `useAccount()` フックで `{ user, profile, status: 'guest' | 'authed', signIn, signUp, signInWithGoogle, signOut, updateProfile }` を提供。
- **クラウド/ゲストを同一APIで隠蔽**。authed 時は Supabase、guest 時は localStorage。
- ゲーム結果保存は既存 `recordPlay()` を**フックして** authed 時にクラウドへも書き込む（`play_history` 追記＋`synapse` スナップショット upsert）。`useMonetization`/streak も同様に同期。

### 6.3 認証
- メール＋パスワード（or マジックリンク）＋ Google OAuth（任意）。
- ログイン/サインアップ画面（モーダル or `/settings` 内 ＋ 必要なら `/auth`）。文言は i18n。

### 6.4 DB スキーマ（Supabase / RLS 必須・`auth.uid()` で本人のみ）
```sql
-- profiles: 1ユーザー1行
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  avatar text,            -- 絵文字 or プリセットID
  plan text default 'free', -- 'free' | 'plus' | 'pro'
  created_at timestamptz default now()
);
-- synapse: プロフィール集計のスナップショット
create table synapse_snapshots (
  user_id uuid primary key references auth.users on delete cascade,
  memory real, logic real, reflex real,
  plays int, xp int, level int, streak int,
  updated_at timestamptz default now()
);
-- play_history: 1プレイ1行
create table play_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  game_id text, difficulty text, quality real, score int,
  played_at timestamptz default now()
);
-- owned_skins: 所有コスメ
create table owned_skins (
  user_id uuid references auth.users on delete cascade,
  skin_id text,
  primary key (user_id, skin_id)
);
-- 各テーブルで RLS 有効化し、user_id = auth.uid() のみ select/insert/update/delete 可
```
（このSQLは `supabase/schema.sql` などにコミットし、手動適用手順を README/CLAUDE.md に追記。）

### 6.5 初回ログイン時のマイグレーション
- 既存 localStorage（synapse.profile / streak / monetization / owned skins）を、初回 authed 時にクラウドへ**ワンタイム push**（クラウドが空なら）。以降はクラウドを正とし、ローカルはキャッシュ。

## 7. ナビゲーション/レイアウト実装
- `src/components/BottomNav.tsx` 新規: 4タブ（アイコン＋ラベル, i18n）。`Layout` の `<main>` 下に固定。`/play/*` 等のゲーム中は**非表示**（没入のため）。`safe-area-inset-bottom` 対応。
- `Layout.tsx` ヘッダー改修: 左=プロフィールアバター（`useAccount` のアバター, 未ログインは汎用アイコン→タップで `/profile`）、中央=ロゴ、右=💎サブスク導線（＋必要なら `?` ヘルプは `/play` 時のみ）。テーマ/音/言語/ショップは撤去（設定へ）。
- `App.tsx` ルート追加: `/score`。`/premium` はサブスクタブとして維持。タブ↔ルート対応を BottomNav と一致させる。

## 8. i18n
- `src/i18n/en.json` / `ja.json` に新キー追加: `nav.home/score/subscription/settings`, `score.*`(tier名含む), `premium.plus/pro/perks`, `settings.bgm/sfx/volume/account/...`, `account.signIn/signUp/signOut/username/avatar/...`, `profile.history/memberSince/...`, `tier.*`。
- 既存キーは温存。新規ゲーム/画面の文言は en をデフォルト・ja を併記。

## 9. 受け入れ条件（全フェーズ共通）
- 下部タブで4画面を切替でき、現在タブがハイライトされる。ゲーム中はタブ/ヘッダーが没入用に最小化。
- 左上アバターから自分のプロフィール（ユーザー名・アイコン・履歴・スコア）に到達でき、ログイン時は編集・クラウド保存される。
- スコア画面にティア・ピラミッドが出て、自分の段がハイライトされ次段までの距離が見える。
- サブスク画面に Plus/Pro が左右に並び、購読/解約モックで `plan` 状態が変わり広告非表示等が反映。
- 設定で BGM/効果音/音量/言語/テーマ/配色/アカウントを操作でき、永続化される。
- **Supabase env 未設定でもゲストモードで全機能（同期以外）が動く**＝静的デプロイを壊さない。
- `npx tsc --noEmit` ＋ `npm run build` ＋ 全 `verify-*.mjs`（`verify-tiers.mjs` 含む）が PASS。reduced-motion で視覚モーション停止・音は維持。

## 10. 推奨フェーズ分割（1つずつ完成・各フェーズでビルド/型/verify を通す）
- **F1 ナビ骨格**: BottomNav ＋ ヘッダー簡素化 ＋ `/score` ルート ＋ 既存トグルの設定移設。（バックエンド無しで完結, まずここをレビュー）
- **F2 スコア画面 ＋ ティア**: `tiers.ts` ＋ `verify-tiers.mjs` ＋ ピラミッド ＋ レーダー再配置。
- **F3 サブスク刷新**: Plus/Pro 2カード ＋ `useMonetization` のプラン階層化 ＋ Paywall/AdSlot 反映。
- **F4 設定拡充 ＋ BGM**: サウンド/音量/言語/表示/データの整理 ＋ `sound.ts` BGM。
- **F5 クラウドアカウント**: `supabase.ts`/`account.ts` ＋ 認証UI ＋ プロフィール編集 ＋ `recordPlay` フック同期 ＋ schema.sql ＋ マイグレーション。（最大・最後・env 必要）

> 進め方: フェーズごとに実装→`npm run dev` でユーザー確認→フィードバック反映→次へ。各完了時に `claude/admiring-ritchie-N4tCx` へコミット/プッシュ。
