# SpeakingPracticeApp

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/-ReactJs-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)

## プロジェクト概要

面接本番で言葉が出なくなる人向けの、即興スピーチ練習アプリです。
シチュエーション（新卒・中途・昇進面接）とAI面接官のスタイル（温厚・標準・圧迫）を選んでセッションを開始すると、AIが質問を投げかけ、ユーザーがマイクで回答します。
回答はWhisper APIで文字起こしされ、セッション終了時にSTARフレームワーク評価とフィラー語（えー・あのー等）の頻度をまとめたフィードバックが返されます。

詳細な要件・API仕様・データ設計は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## 必要な環境変数・コマンドの一覧

### 環境変数

`apps/backend/.env.example` と `apps/frontend/.env.example` をコピーして使用します。

**`apps/backend/.env`**

| 変数名 | 説明 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API（質問生成・フィードバック生成）のAPIキー |
| `OPENAI_API_KEY` | Whisper API（音声文字起こし）のAPIキー |
| `REDIS_URL` | セッション状態を保持するRedisの接続先（デフォルト: `redis://localhost:6379`） |
| `PORT` | Fastifyサーバーのポート（デフォルト: `3000`） |

**`apps/frontend/.env.local`**

| 変数名 | 説明 |
|---|---|
| `VITE_API_BASE_URL` | バックエンドAPIのベースURL。未設定時は空文字（相対パス）となりViteプロキシ経由で接続する。スマホ実機で確認する場合は空のままにする（詳細はトラブルシューティング参照） |

### 主要コマンド（リポジトリルートで実行）

| コマンド | 説明 |
|---|---|
| `pnpm install` | 依存パッケージをインストール |
| `pnpm --filter @speaking-practice/types run build` | 共有型パッケージをビルド（frontend/backend起動前に必要） |
| `pnpm --filter @speaking-practice/frontend run dev` | フロントエンド開発サーバーを起動（Vite） |
| `pnpm --filter @speaking-practice/backend run dev` | バックエンド開発サーバーを起動（tsx watch） |
| `pnpm -r run typecheck` | 全ワークスペースの型チェック |
| `pnpm run lint` | ESLint実行 |
| `pnpm run build` | 全ワークスペースをビルド |
| `pnpm --filter @speaking-practice/frontend run test:e2e` | Playwright E2Eテストを実行 |

## ディレクトリ構成

```
SpeakingPracticeApp/
├── apps/
│   ├── frontend/       # React + Vite製フロントエンド
│   │   ├── src/
│   │   │   ├── screens/    # SelectionScreen / SessionScreen / FeedbackScreen
│   │   │   ├── api.ts      # バックエンドAPI呼び出し
│   │   │   └── App.tsx     # 画面遷移の親コンポーネント
│   │   └── vite.config.ts  # /session, /health をバックエンドへプロキシ
│   └── backend/         # Fastify製バックエンド
│       └── src/
│           ├── routes/session.ts  # /session/start, /answer, /end
│           ├── lib/clients.ts     # Claude / Whisper / Redis クライアント
│           └── index.ts           # サーバーエントリポイント
├── packages/
│   └── types/            # frontend/backend共有のTypeScript型定義
├── tests/e2e/             # Playwright E2Eテスト（ルート実行用）
├── .github/workflows/     # CI（型チェック・ESLint・ビルド確認）
└── CLAUDE.md              # 要件定義・API仕様・データ設計の詳細ドキュメント
```

## 開発環境の構築手順

### 前提条件

- Node.js v20 以上
- pnpm v9 以上
- Redis（ローカルで起動しておく。例: `brew install redis` → `redis-server`）
- Anthropic APIキー・OpenAI APIキー（Claude / Whisper呼び出し用）

### セットアップ

1. リポジトリをクローン
   ```bash
   git clone git@github.com:Masaharu1223/SpeakingPracticeApp.git
   cd SpeakingPracticeApp
   ```

2. 依存パッケージをインストール
   ```bash
   pnpm install
   ```

3. 環境変数を設定
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # apps/backend/.env を編集し ANTHROPIC_API_KEY / OPENAI_API_KEY を入力

   cp apps/frontend/.env.example apps/frontend/.env.local
   # 必要に応じて apps/frontend/.env.local を編集
   ```

4. Redisを起動
   ```bash
   redis-server
   ```

5. 共有型パッケージをビルド（frontend/backendがこの型を参照するため必須）
   ```bash
   pnpm --filter @speaking-practice/types run build
   ```

6. バックエンド・フロントエンドをそれぞれ別ターミナルで起動
   ```bash
   pnpm --filter @speaking-practice/backend run dev
   ```
   ```bash
   pnpm --filter @speaking-practice/frontend run dev
   ```

7. ブラウザで `http://localhost:5173` を開く

## トラブルシューティング

### スマホ実機でマイクが動作せず白画面になる

ブラウザはHTTPS以外の環境ではマイクAPI（`navigator.mediaDevices`）を提供しないため、HTTPでスマホからアクセスすると `navigator.mediaDevices` が `undefined` になり画面が白くなります。
スマホで動作確認する場合は ngrok 等でHTTPS化してアクセスしてください。

### スマホから接続するとバックエンドに繋がらない

`apps/frontend/src/api.ts` の `BASE_URL` は `VITE_API_BASE_URL` 未設定時は空文字（相対パス）になり、Viteプロキシ（`apps/frontend/vite.config.ts` の `/session`, `/health`）経由でバックエンドにアクセスする設計です。
`VITE_API_BASE_URL` に `http://localhost:3000` のような絶対URLを設定すると、スマホ上では `localhost` がスマホ自身を指してしまい接続に失敗するので、スマホ実機で確認する場合は `VITE_API_BASE_URL` を空にしてプロキシ経由にしてください。また新しいAPIエンドポイントを追加する際は、Viteプロキシ側のプレフィックスも忘れずに追加してください。

### 共有型パッケージの変更が反映されない

`packages/types` を変更した場合、`pnpm --filter @speaking-practice/types run build` を再実行してから frontend/backend を再起動してください（型はビルド済みの `dist` を参照するため）。

<!-- TODO: 本番デプロイ時の既知のハマりどころを追記（ホスティング先は現時点で未決定） -->
