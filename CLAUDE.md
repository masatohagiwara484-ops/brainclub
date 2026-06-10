# CLAUDE.md — BrainClub プロジェクト引き継ぎ

> このファイルは新しいセッションのClaudeが**最初に読む**ための引き継ぎ資料です。
> プロジェクトの全体像・決定事項・現状・次の一手をここに集約しています。

## 🎯 プロジェクトの本質
**BrainClub** = 世界の脳トレ・知育ゲームを統合したWebプラットフォーム。
コンセプトは『世界のアソビ大全51（Clubhouse Games）』×『NYT Games』のWeb版。
**英語圏ファースト**（北米が脳トレ市場の36.4%）。インストール不要・ログイン不要。

戦略の背骨: 単なるゲーム詰め合わせ✗ → **「毎日の習慣（デイリー・リチュアル）」**を作る（NYT/Wordleモデル）。
長期目標: chess.com級。短期方針: **1本ずつ完璧に**仕上げて回す（30本同時開発は禁物）。

> 詳細な事業構想書（市場規模・収益化・バイラル戦略・30ゲームのポートフォリオ）は
> ユーザーが別途docxで保有。必要なら再共有を依頼すること。

## 🛠 技術スタック（確定）
- **React + Vite + TypeScript + Tailwind CSS**
- ゲームは `<canvas>` 描画（キューブはThree.js）
- PWA対応（インストール可・オフライン）
- バックエンドなし（現状は全てクライアントサイド＝静的デプロイ）
- デプロイ先: **Vercel**
- **アニメ/演出ライブラリ**: `framer-motion`, `canvas-confetti`, `@react-three/fiber@^8` + `@react-three/drei@^9`
  （※ R3F は **React 18 互換の v8 系で固定**。最新 v9 は React 19 必須なので不可。drei は重いので**実際に使う機能だけ import**＝未使用なら本番バンドルに載らない）

## 🎨 HOLO 2.0 デザインシステム（全面刷新・現行）
> **2026年の全面リニューアル**: 「人に使えるレベルではない」という指摘を受け、UI/UXを **HOLO 2.0（ホログラフィック・プレミアム）** へ全面刷新。
> **契約書 = `.claude/skills/holo-design/SKILL.md`**（UIを触る前に必読・全エージェント拘束）。アートディレクション=深宇宙の闇＋フロストガラス＋虹色スイープ(cyan→violet→magenta)。
- **新技術スタック**: `lucide-react`(アイコン), `@use-gesture/react`, `clsx`+`tailwind-merge`(`lib/cn.ts`), `class-variance-authority`(Buttonのvariant), `@react-three/postprocessing`。表示フォント=**Space Grotesk**(`.font-display`)。
- **トークン**（`styles/index.css` `:root` → `tailwind.config.js`）: 背景 `space-0..3`、虹色 `iris-cyan/violet/magenta`、`--iris-sweep`、グロー `shadow-glow-sm/glow/glow-lg`、ガラス `--glass-*`。
- **ユーティリティ**: `.glass-panel`(全カード/シート), `.text-iris`(ヒーロー見出し1画面1つ), `.holo-border`(回転虹枠・画面の主役1つ), `.bg-aurora`(非ゲーム背景), `.holo-halo`, `.pt-safe/.pb-safe/.px-safe`(セーフエリア必須), `.tap-target`(44px必須)。
- **共通部品**（再利用必須・複製禁止）: `components/Button.tsx`(CVA・全サイズ≥44px), `components/Icons.tsx`(`<Icon name>`=lucide・**絵文字をUIアイコンに使わない**), `components/Skeleton.tsx`(全非同期ローディング), `components/GameTile.tsx`(ホームの統一ゲームカード), `components/DailyRitual.tsx`。
- **鉄則**: 絵文字アイコン禁止/タッチ44px/セーフエリア/1画面1ヒーロー/reduced-motion対応/全文言i18n(en+ja・`defaultValue`残さない)/全非同期にSkeleton＋空状態。
- **レガシー**: 旧 `.font-cyber`/`.font-dot`(DotGothic16ピクセル) は **Space Grotesk へ再ポイント済**（11ゲームHUDが一括モダン化、クラス名は互換維持）。新規は `.font-display` を使う。`GAME_BG`(GameShell)とスプラッシュ/結果画面も深宇宙パレットへ移行済。

### 旧プレミアム路線（参考・一部トークンは併存）
> **方針転換**: 当初の「chess.com風・低アセット」から、**Cygamesインスパイアの濃く鮮やかなプレミアム路線**へ全面刷新中。
> 「安っぽいゲーム感」ではなく「上質でモダン」を目指す。色遷移・余白・タイポ階層すべてを“高級”に。
- **ブランド色 = プレミアム・インディゴ `#6366F1`**（旧 `#2563eb` 青から変更）。
  - **再スキンは1箇所**: `src/styles/index.css` の `--brand-rgb`（RGBチャンネル形式→Tailwindの不透明度修飾子 `bg-brand/10` 等が動く）。
  - これを変えるだけで全30ファイル・約62箇所の `brand` 系ユーティリティが一括で再色付けされる。
- **デザイントークン**（`tailwind.config.js` + `:root` の CSS変数, すべて var 駆動）:
  - 色: `primary`/`accent-cyan`/`accent-pink`/`success`/`warning`/`danger`/`surface`/`surface-2`
  - 影: `shadow-game`(柔), `shadow-elevated`(深), `shadow-premium`(インディゴ・グロー)
  - 角丸: `rounded-card`(1rem)/`rounded-panel`(1.25rem)
- **タイポ**: **Inter**（`index.html` で読込, body既定フォント）。見出しは `.font-display`（800/タイトトラッキング）。`.font-cyber`/`.font-dot`(DotGothic16) はロゴ/特殊見出し用に残置。
- **テーマ機構**: `src/lib/theme.ts` の `useTheme()` が `<html>` に `data-theme="premium"` を付与（Layout内ルートの `data-theme="zen"`=FXエンジンと衝突しないよう **html側**に付ける）。premium層は `--success`/`--surface` を深色へ上書き。
  - 型付き `palette`/`color()` は CSS変数を読めない canvas/Three/confetti 用の生hex供給源。
- **演出系の基盤**: 要素単位は `lib/feedback.ts`（correct/incorrect/solve）、画面単位は `lib/fx.ts`（confetti/flash/shake, `--fx-accent`もインディゴ化済み）。`.transition-premium`(スプリング風イージング)・`.bg-neural`(微細シナプス模様) も用意。reduced-motion 厳守。

## 📐 アーキテクチャ
```
src/
  games/registry.ts      ゲームカタログ（cube/sudoku/solitaire/watersort/gomoku/wordle が稼働、他はavailable:falseで"Coming soon"）
  games/cube/            cubeEngine.ts（Three.js本体＋バグ修正）＋ CubeGame.tsx（React UI）
  games/wordle/          wordGuess.ts（単語リスト/採点ロジック）＋ WordleGame.tsx（Word Guess本体・難易度＝文字数4〜7・デイリー＋練習）
  components/            Layout, GameCard, Button（共通ボタン＝唯一の真実）, TierPyramid（ティア階段）, SynapseRadar, Rotating3DGameSelector（ホームの3D回転扉セレクター）等
  pages/                 Home（=3D回転扉ゲームセレクター。旧パネル/グリッド選択は廃止）, GamePage, Score（Synapseスコア＋ティア）
  lib/                   haptics, storage, daily, share, theme（プレミアムトークン+useTheme）,
                         feedback（要素単位の手応え）, fx（画面単位の演出）, tiers（ティア純関数）, synapse, monetization
  i18n/                  en.json（デフォルト）, ja.json
scripts/verify-cube.mjs    キューブ崩壊バグの自動検証（node scripts/verify-cube.mjs）
scripts/verify-wordle.mjs  Word Guessの単語リスト＆採点ロジック検証（node scripts/verify-wordle.mjs）
scripts/verify-tiers.mjs   ティア閾値/進捗ロジックの境界値検証（node scripts/verify-tiers.mjs）
scripts/verify-hex.mjs     ヘックスの隣接/接続判定/接続距離AI/自己対戦の決着保証を検証（node scripts/verify-hex.mjs）
scripts/verify-ludo.mjs    ルドーの経路/捕獲/安全マス/合法手/勝利判定を検証（node scripts/verify-ludo.mjs）
scripts/verify-yacht.mjs   ヨット(ヤッツィー式)の全13役の採点＋上段ボーナス＋合計を検証（node scripts/verify-yacht.mjs）
scripts/verify-blackjack.mjs ブラックジャックの手の点数/BJ判定/ディーラー方針/ベーシック戦略/精算を検証
scripts/verify-poker.mjs   ポーカーの役判定/ストレート・ホイール/キッカー/7枚最強5枚/サイドポット精算を検証
scripts/verify-tetris.mjs  テトリスのピース定義/回転/衝突/ライン消去＋重力/スコアを検証
scripts/verify-elo.mjs     オンライン対戦のEloレート計算（期待値/ゼロサム/アップセット/表示ランク境界）を検証
```

### オンライン対戦レイヤ（Phase 3）
```
supabase/online.sql        matches/matchmaking_queue/elo列＋RPC群（Supabaseで要実行）
src/lib/realtime.ts        マッチRPC＋Supabase Realtime購読のラッパ（find/queue/private/move/result/subscribe）
src/lib/elo.ts             純Elo（expected/update/applyResult＋表示ランク eloRank）
src/pages/OnlineGamePage.tsx  サインインゲート→ロビー→対局（購読所有・OnlineController生成）
src/components/OnlineLobby.tsx クイックマッチ＋フレンドルーム（コード発行/参加）
src/games/types.ts         GameProps.online（OnlineController：moves権威/sendMove/reportResult/resign/leave）
```

## 🆕 新ゲーム追加バッチ（進行中・確定）
ユーザー指示で6本を**1本ずつ完璧に仕上げて**追加中（30本同時開発はしない方針）。
順番: **①ヘックス ②ルドー ③ヨット ④ブラックジャック ⑤テキサスポーカー ⑥テトリス**。
- **対戦相手**: 現状は全てAI。**オンライン対戦実装完了後**に、これら（BJ/ポーカー等）含む全ゲームをオンライン対応へ。→AIは将来オンラインへ差し替えやすい**純ロジック**で実装する。
- **難易度4段階(EASY/MEDIUM/HARD/EXPERT)を付ける**: ヘックス/ルドー/ポーカー・BJ/テトリス。**ヨットは一人用スコアアタックなので難易度なし**。
- **①ヘックス = 実装完了 ✅**（`games/hex/`）。N×N菱形盤(7/9/11/13＝難易度)。人間=上下のシアン辺、AI=左右のローズ辺。AIは**接続距離ヒューリスティック**（Dial法0-1 BFSで「接続に必要な残り石数」を評価）＋難易度別（easy:乱択多め / medium:貪欲+ジッタ / hard:確定貪欲 / expert:上位手で2-ply minimax）。`hasConnection`はフラッドフィル。引き分けは原理的に無い。canvas描画（`HexGame.tsx`）はGomoku流。`node scripts/verify-hex.mjs`で全PASS。
- **②ルドー = 実装完了 ✅**（`games/ludo/`）。クラシックルール（各色4駒・出すのに6・捕獲で振り出し・安全マス★・全4駒ゴールで勝ち・6/捕獲/ゴールで追加手番・6が3回でスキップ）。人間=赤(color0)、AI=緑/黄/青。`ludoEngine.ts`=純ロジック（リング52マス`START_OFFSET=[0,13,26,39]`／進行度 -1=base,0..50=ring,51..56=home,56=goal／合法手・捕獲・勝利・難易度別AI〔easy乱択/medium貪欲/hard&expertは捕獲される位置回避の危険読み〕）。`ludoBoard.ts`=15×15盤ジオメトリ（`RING_CELLS`52座標＋4色のホームレーン＋ベース）。`LudoGame.tsx`=canvas描画＋ターン進行ステートマシン（ref駆動でサイコロ→手番判定）。`node scripts/verify-ludo.mjs`で全PASS。**注**: ブロッケード(同色2駒の通せんぼ)はv1では未実装。
- **③ヨット = 実装完了 ✅**（`games/yacht/`）。**ヤッツィー式13役**（上段1〜6＋63以上で+35ボーナス、スリー/フォーカード・フルハウス25・小ストレート30・大ストレート40・ヤッツィー50・チャンス、2個目以降のヤッツィーは+100）。**難易度なし**（一人用）。**デイリー（`dailySeed('yacht')`で全員同一出目）＋練習（ランダム）**。デイリーのみ`submitScore('yacht','',total)`でリーダーボード送信。`yachtScore.ts`=純採点ロジック、`YachtGame.tsx`=DOM（5サイコロのホールド＋スコアカード、GameShell使用）。`node scripts/verify-yacht.mjs`で全PASS。
- **④ブラックジャック = 実装完了 ✅**（`games/blackjack/`）。**4人卓（人間=seat0＋AIボット3体）＋共通ディーラー**の**10ラウンドのチップ勝負**（全員500持ち、最多で勝ち）。難易度=ハウスルール＋ボットの巧さ（`RULES`: easy=1デッキ/S17/BJ3:2 … expert=6デッキ/H17/BJ6:5、`BOT_ERROR`でベーシック戦略から逸脱）。`blackjackEngine.ts`=純ロジック（`handValue`ソフト/ハード、`isBlackjack`、`dealerShouldHit`、`basicAction`スプリット無しのベーシック戦略、`settle`精算）。`BlackjackGame.tsx`=DOMカード卓（人間先行→ボット→ディーラー公開→精算のステージ進行）。`submitScore('blackjack',difficulty,chips)`。`node scripts/verify-blackjack.mjs`で全PASS。**注**: スプリット/インシュランスはv1未実装。
- **⑤テキサスポーカー = 実装完了 ✅**（`games/poker/`）。**ノーリミット・ホールデム、人間＋AI3人のノックアウト・トーナメント**（最後の1人＝優勝、人間が全チップ失うと脱落）。ブラインド20、スタック1000。`pokerEval.ts`=純役評価（`rank5`→[カテゴリ,…キッカー]、`evaluate7`で7枚から最強5枚、ホイール対応、`holeStrength`プリフロップ強度）。`pokerEngine.ts`=ベッティングFSM（ブラインド/4ストリート/合法手/レイズで再オープン/オールイン）＋**`settlePots`サイドポット精算（pure・検証済）**＋`aiDecide`（難易度で強気度・ブラフ・ポットオッズ）。`PokerGame.tsx`=テーブルUI（共通カード・ベット操作½/Pot/All-in・ショーダウン公開、ref+forceでengine状態を描画、AI手番はsetTimeout駆動）。`submitScore('poker',difficulty,chips)`。`node scripts/verify-poker.mjs`で全PASS。**注**: マルチストリートのオールイン表示は簡易。
- **⑥テトリス = 実装完了 ✅**（`games/tetris/`）。**本家準拠**（10×20盤・7種テトロミノ＋クラシック配色・7-bag乱択・SRS風の簡易壁蹴り回転・ゴースト・ハードドロップ/ソフトドロップ・ライン消去スコア〔single100/double300/triple500/tetris800×レベル〕・10ライン毎にレベル＋速度up）。難易度=**開始レベル/速度**（easy0/medium4/hard8/expert12）。`tetrisEngine.ts`=純ロジック（`SHAPES`/`rotateCells`/`collides`/`lock`/`clearLines`/`lineScore`/`gravityMs`/`makeBag`）。`TetrisGame.tsx`=canvas＋rAF落下ループ（盤/ピースはref、HUDはstate）＋キーボード＋タッチパッド（◀▶⟳▼⤓）。`submitScore('tetris',difficulty,score)`。`node scripts/verify-tetris.mjs`で全PASS。

> **新ゲーム6本すべて完了 🎉**（ヘックス/ルドー/ヨット/ブラックジャック/テキサスポーカー/テトリス）。全て純ロジックを`verify-*.mjs`で検証済み、registry自動配線でホームのカードデッキに自動表示。次フェーズはオンライン対戦（Phase 3）＋ログインゲート。
- **ゲーム追加時に触る6箇所**（registry自動配線のためApp.tsx不要）: ①`games/<id>/`(本体+純ロジック) ②`games/registry.ts`(GameDef, available:true) ③`i18n/en|ja.json`(`<id>`セクション+`games.<id>`) ④`components/GameArt.tsx`(2D SVG) ⑤`lib/gamePalette.ts`(配色trio) ⑥`components/darkGames.ts`。任意で`HowToOverlay.tsx`のSCENESに2Dチュートリアル、`scripts/verify-<id>.mjs`。

## ✅ 決定事項（ユーザーとの合意）
1. 技術土台: React+Vite+TS+Tailwind
2. ブランド名: **作業名「BrainClub」**（未確定。候補: MindArcade / Cortex Club / Puzzlr / Clevora）
   - 変更箇所: `index.html`, `vite.config.ts`(PWA manifest), `src/i18n/*.json`
3. 発信: build in public を英語中心で（X / Substack）。初日コンテンツは `CONTENT_buildinpublic.md`
4. リポジトリ: 新規 `masatohagiwara484-ops/brainclub`（rubuk_cube_game_play とは別物）

## 🐛 解決済みのキューブのバグ（重要・再発注意）
旧版（単一HTML）で 2×2/4×4 が必ず、5×5が時々崩れていた。原因と修正:
1. **位置スナップ**: `Math.round(pos/STEP)*STEP` は偶数キューブで破綻（半ステップ位置 + JSの`Math.round(-0.5)===0`）。
   → 修正: `idx = round(pos/STEP + offset); pos = (idx-offset)*STEP`（offset=(N-1)/2）
2. **向きスナップ**: Euler角の軸別独立丸めは複合3D回転で不正 → 5×5が時々崩れた。
   → 修正: 回転行列の各基底ベクトルを最寄り軸にスナップ→再正規直交化（`cubeEngine.ts` の `snapRotation`）。
`node scripts/verify-cube.mjs` で全サイズPASSを確認済み（旧ロジックは同テストでFAIL）。

## 📳 スマホ振動（ハプティクス）
`lib/haptics.ts`。回転時tick / 完成時パターン。
✅ Android作動 / ❌ iOS Safariは`navigator.vibrate`非対応で無音（エラーなし・仕様）。

## 🏆 オンライン競争（方針転換・確定）
> **重要決定**: 「ログイン不要」原則を**撤回し、ログイン前提へ移行**。Supabaseをバックエンドに採用済み
> （`@supabase/supabase-js`導入済、`src/lib/supabase.ts`/`cloud.ts`、`supabase/schema.sql`稼働）。
- **狙う体験**: ①全員が同一seedの「今日の問題」を解く**デイリー・リーダーボード**（NYT/Wordle型・習慣化の核）
  ②全ゲーム合算の**グローバル・レート＋ランク**（=既存 `synapseScore()`＋`tiers.ts` を流用）
  ③2人以上のゲーム（五目並べ等）は**世界のユーザーと実オンライン対戦**。
- **既存土台**: マジックリンク認証＋`profiles`/`saves`＋RLS＋進捗同期は完成済（旧称: 任意のクラウド）。
- **Phase 1（実装中・今ここ）**: 競争バックボーン。
  - DB: `supabase/leaderboard.sql`（`scores`日次表＋`submit_score()`RPC〔keep-best/auth.uid()刻印/sanity境界〕＋`profiles`に公開ランク列 `synapse/xp/level`）。**Supabaseで一度実行が必要**。
  - クライアント: `src/lib/leaderboard.ts`（`submitScore`/`fetchDaily`/`fetchLadder`＋hooks）。`cloud.ts` が同期時に `profiles` のランク列を更新。
- **Phase 2（次）**: ログイン必須ゲート（未ログインはプレイ前にサインイン）＋リーダーボードUI（ゲーム結果画面・専用タブ）＋ランク表示。各ゲームの結果で `submitScore` を発火。
- **Phase 3 = リアルタイム1on1オンライン対戦 = 実装完了 ✅**（五目並べ・ヘックス）。決定: **オンライン対戦のみログイン必須**（AI/一人用は無料・ログイン不要のまま）／マッチング=**クイック＋フレンドコード**／**Elo最初から**（K=32, 開始1000, Bronze〜Grandmaster）。
  - **DB**: `supabase/online.sql`（**Supabaseで一度実行が必要**）。`matches`（着手列`moves`が唯一の真実・postgres_changesで両者購読）＋`matchmaking_queue`＋`profiles`に`elo/wins/losses`。全書き込みはSECURITY DEFINER RPC（`find_match`〔`FOR UPDATE SKIP LOCKED`で原子的ペアリング〕/`leave_queue`/`create_private_match`/`join_private_match`/`record_move`〔手番検証〕/`record_match_result`〔Eloをサーバ再計算・冪等〕）。
  - **クライアント**: `src/lib/realtime.ts`（RPC＋Realtime購読のラッパ）／`src/lib/elo.ts`（純Elo・`scripts/verify-elo.mjs`で検証）／`src/pages/OnlineGamePage.tsx`（サインインゲート→ロビー→対局・購読所有）／`src/components/OnlineLobby.tsx`（クイック/フレンド）。
  - **ゲーム配線**: registryに`online?:boolean`（gomoku/hex=true）。`GameProps`に`online?:OnlineController`（`types.ts`）。各ゲームは**`online.moves`配列から盤面を純導出**（着手iは偶数=先手色/奇数=後手色）＝再接続・エコー処理不要。`DifficultyScreen`に「🌐 Play Online」入口、`App.tsx`に`/online/:id`。`Leaderboard`に「ランク戦」タブ（Eloラダー）。
  - **対局相手の色**: 先手＝五目BLACK/ヘックスHUMAN(シアン・上下)、後手＝WHITE/AI(ローズ・左右)。`first_player`はランダムで公平。
  - **未実装（次の硬化）**: Presence切断検知での自動forfeit（現状は手動「投了」＋途中退出forfeitのみ）／Edge Functionでの着手サーバ再検証／観戦・リマッチ・手番タイマー。
- **不正対策**: MVPはRPC経由のclient-submit＋RLS＋境界チェック＋`record_move`の手番検証。将来は `verify-*.mjs` の純ロジックをEdge Functionで**サーバー再検証**へ硬化。
- **環境変数**: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`（Vercel＋`.env.local`、`.env.example`参照）。
- **Supabase手作業（オンライン対戦に必須）**: ①`supabase/online.sql`をSQLエディタで実行 ②Realtimeが`matches`で有効（SQL内で`supabase_realtime`へ追加済）③Auth Providers でGoogle/Apple OAuth有効化（マジックリンクはメール制限に当たりやすいのでオンライン導線はOAuth推奨）④URL Configurationに本番Vercel URL。

## 🎮 大型バッチ2026-06（チェス/スキン/クエスト/プロフィール = 実装済✅・対戦拡張 = 設計のみ）
- **チェス ✅**: `games/chess/`（mailbox純エンジン・キャスリング/EP/プロモ/50手・negamax+αβ AI 4段階・`replay()`でオンライン対応済 online:true）。`verify-chess.mjs`=perft検証（start/Kiwipete/EP/promo局面＋メイト/ステイルメイト）全PASS。
- **スキン課金 ✅**: `lib/gameSkins.ts`=9テーマ(classic無料/plus:crystal,baroque,darkneon,fire/pro:diamond,cyberpunk,matrix,dragon)。盤系(gomoku/chess)=盤+石/駒色、cube=`CubeOptions.stickers`でステッカーパレット注入(スキン変更で再構築)。`SkinPicker`=ゲーム内ストア接点(ロック→paywall)。
- **レート信頼性 ✅**: `elo.ts` kFor()=配置5戦64→30戦まで32→以後24、`isPlacement`。SQLの`record_match_result`も同スケジュール(**online.sql再実行が必要**)。ラダー/ロビーは配置中「Placement n/5」表示。
- **デイリークエスト＋ストリークシールド ✅**: `lib/quests.ts`=全員同一の3クエスト/日(7テンプレからseed抽選)、`synapse.recordPlay`→`notePlay`で自動進捗、3完=Perfect Dayで`bumpStreak`。有料特典=月2回まで1日欠席を自動ブリッジ(`applyStreakShield`、DailyRitualでマウント時適用)。
- **プロフィール2.0 ✅**: `components/ProfileCard.tsx`(バナー+フレーム付アバター+6統計+バッジ壁) + `lib/cosmetics.ts`(FRAMES=レート枠・plan制→将来単品課金、badges()=実績判定)。Profileページ先頭に表示。
- **Liquid Glass ✅**: `.glass-panel`を液体ガラス化(blur20+saturate160%+光を受けるグラデ枠+鏡面ストリーク、2レイヤーbgなので.holo-borderと共存)。
- **テトリス・リアルタイム対戦 ✅**: `realtime.ts`の`versusChannel(matchId)`=broadcastレーン(`{kind:'state'|'garbage'|'dead'}`)。両者**同一7-bag**(matchIdをFNVハッシュ→シード)、固定速度Lv3。ロック毎に`encodeBoard`(200桁文字列)で盤面ミラー→相手はサイドレールのミニ盤(`OppBoard`)に描画。攻撃=2/3/4列消しで1/2/4行のガベージ(`addGarbage`穴1つ・受信側決定的乱数)、自分の次ロック時に下から挿入。トップアウト→`dead`送信+敗北報告(Elo冪等)。ポーズ不可。`verify-tetris`にガベージ/攻撃表のassert追加済。
- **キューブ特殊形状 ✅**: `cubeEngine`の`CubeOptions.shape`('classic'|'pillow'|'sphere'|'gem')。pillow/sphere=セグメント付きBoxGeometryの頂点を球へlerp(**6マテリアルグループが保持される**のでステッカー機構無傷)、gem=クリアコートのMeshPhysicalMaterial。`gameSkins.CUBE_SHAPES`(plus:pillow/pro:sphere,gem)+`useCubeShape`、CubeGameに形状チップ(ロック→paywall)。
- **4人対戦 基盤 ✅(SQL+クライアント。ゲーム配線は次)**: `supabase/online-v2.sql`(**Supabaseで要実行・online.sqlの後**)=matchesに`players uuid[]`+`match_size`(1v1行はバックフィル)、RLS=`any(players)`、`find_match_n(game,size)`が size-1人を`SKIP LOCKED`で原子取得し座席シャッフル、`record_move`はN人ターン検証(`players[1+len(moves)%size]`・脱落者はゲーム側no-op move)、`record_match_result`は**勝者がK/(size-1)で各敗者とペアワイズElo**。クライアント=`realtime.ts`の`findMatchN`/`waitForAnyMatch`(カラムフィルタ無し=**RLSゲートで自分の試合だけ届く**=全座席が発見可能)/`seatOfN`/`turnSeatN`。
  - **次のゲーム配線手順(ludo 4P例)**: ①registryに`online:true` ②OnlineGamePage/OnlineLobbyを`match_size`対応(ロビーに2人/4人選択→`findMatchN`+`waitForAnyMatch`) ③LudoGameに`online`分岐: 盤面=movesから純導出(1手={dice,token}…サイコロはmatchIdシードの決定的乱数で両者一致させる) ④脱落/切断=該当seatをAIに委譲 or no-op。

## 🗺 ロードマップ（0.1→1→10→100）
- **0.1→1（〜2週間）**: 安定・公開・計測・シェアできる土台。キューブ修正済み✅／Vercelデプロイ／PWA／計測／X・Substack開始。← **今ここ**
- **1→10（〜2-3ヶ月）**: デイリー習慣＋必須ゲーム追加（軽い順: 五目→ナンプレ→ソリティア→色水ソート→単語当て）＋ストリーク/実績＋リワード広告/広告除去/コスメ＋全ゲームにシェアグリッド。初収益。
- **10→100（〜12ヶ月+）**: サブスク($9.99〜)＋コスメ拡充＋A/B＋オンライン対戦(要バックエンド)＋本格多言語＋B2B(EdTech/企業ウェルネス)＋IP提携。月$1,500+。

## ▶️ 次の一手（候補）
1. **Vercelデプロイ**で公開URLを作る（最優先）
2. デイリー・チャレンジ＋シェアの作り込み
3. **ナンプレ実装**（必須カテゴリ・自動生成・低アセット）＝2本目のゲーム
4. ブランド名の確定（ドメイン/商標チェック後）

## 🚀 起動・デプロイ
```bash
npm install && npm run dev          # ローカル（http://localhost:5173）
npm run dev -- --host               # スマホから（同一Wi-Fi）
npm run build && npm run preview     # 本番ビルド確認
node scripts/verify-cube.mjs         # キューブ安定性テスト
```
Vercel: GitHubリポをimport → Framework「Vite」自動検出 → Deploy。
```
```
