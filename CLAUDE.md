# 面接練習アプリ 要件定義

## プロダクト概要

面接本番で言葉が出なくなる人向けの即興スピーチ練習アプリ。
シチュエーションに応じた背景とAI面接官が質問を投げかけ、ユーザーがマイクで回答する形式。

---

## ターゲットユーザー

就活生・転職活動中のビジネスパーソン（面接特化）

---

## MVPスコープ

### シチュエーション機能
- シチュエーションを選択できる（新卒面接・中途面接・昇進面接）
- シチュエーションに応じた背景画像を表示（静止画、3×3=9通り）

### セッション設定
- セッション時間をユーザーが選択できる
- 質問者スタイルを選択できる（温厚・標準・圧迫）

### 質問・回答フロー
- AI面接官がシチュエーション・スタイルに応じた質問を生成する
- ユーザーがマイクで回答する
- 回答完了のトリガーはボタン押下
- 回答音声をWhisper APIで文字起こしする
- 文字起こし結果はセッション終了時にJSONファイルとして保存する
- ページリロード時はセッションが終了する（状態復元なし）

### フィードバック機能
- フィードバックはセッション終了時のサマリーのみ（ターンごとのフィードバックはなし）
- 内容評価：STARフレームワークの各要素（Situation/Task/Action/Result）をtrue/falseで評価
- 話し方評価：フィラー語（えー・あのー・えーと・まあ・なんかなど）の頻度を正規表現で検出（将来的により精密な方法に変更予定）

---

## MVP除外（将来対応）

- AR機能
- カメラによる顔の向き検出（ネイティブ移行時に追加）
- 音声ファイルの保存（現時点はテキストのみ保存）
- セッション間の成長トラッキング
- SSEによる質問文のストリーミング表示（MVP後に追加）
- フィラー語のAI検出（正規表現から移行）
- AI面接官のバーチャルフェイス（Live2D/3Dキャラクターによるリアルタイム表情・視線表現。専用レンダリングエンジン・3Dモデル制作が必要でMVPの範囲を大きく超えるため、将来ロードマップとしてメモのみ残す）

---

## プラットフォーム

- フェーズ1：Webアプリ
- フェーズ2：ネイティブアプリ（React Nativeを想定）

---

## 技術スタック

| 項目 | 選定内容 |
|---|---|
| フロントエンド | React + Vite（TypeScript） |
| バックエンド | Fastify（TypeScript） |
| STT | OpenAI Whisper API（`whisper-1`、直接API経由） |
| AI質問生成・フィードバック | Anthropic Claude API（`claude-sonnet-4-6`、直接API経由） |
| サーバー側セッション保持 | Redis |
| API通信スタイル | HTTP（REST） |
| データ保存形式 | JSON |
| モノレポ管理 | pnpm workspaces |
| CI | GitHub Actions（型チェック・ESLint・ビルド確認） |

### AIプロバイダ選定（2026-07-12検討・確定）

Claude・WhisperともにAWS Bedrock経由ではなく直接APIを採用する。

- **Claude**: Bedrock経由でも直接Anthropic API経由でも同一料金（標準リージョンで入力$3・出力$15 / 100万トークン、claude-sonnet-4-6時点）のため、Bedrockに移行してもコストメリットがない。
- **Whisper**: BedrockにはWhisper相当のモデルが存在しない。AWSでSTTを行う場合はAmazon Transcribeとなるが、Whisper（$0.006/分）よりTranscribe（$0.024/分〜、大規模帯でも$0.0078/分まで）の方が高額なため不採用。
- 将来AWSへインフラを全面集約する必要が生じた場合（IAM/VPC統合・データレジデンシー要件など）に再検討する。

---

## プロジェクト構成

```
SpeakingPracticeApp/
├── apps/
│   ├── frontend/     # React + Vite
│   └── backend/      # Fastify
└── packages/
    └── types/        # 共有TypeScript型定義
```

---

## アーキテクチャ

### 基本方針
モジュラーモノリスをベースとし、将来的に負荷の高い処理をサーバーレスまたはマイクロサービスとして切り出す。

### モジュール構成（案）
```
App
├── session/        # セッション管理（開始・終了・設定）
├── question/       # 質問生成（Claude API呼び出し）
├── speech/         # 音声入力・STT処理
├── feedback/       # フィードバック評価ロジック
├── storage/        # JSONへの保存・読み込み
└── ui/             # 画面・背景表示
```

### ステート管理方針
完全なステートレスではなく部分的にステートフルな設計を採用する。

**Redisに保持するもの**
```
session:{session_id}:config  → Hash
  situation: "新卒面接"
  style: "圧迫"
  duration_minutes: 10

session:{session_id}:turns   → List（末尾に追記）
  [ {turn_id, question, answer_text, recorded_at}, ... ]
```

- TTL：30分（セッション放棄時の自動削除）
- セッション正常終了時：`/session/end`でRedisキーを削除

**クライアントから毎回送るもの**
- session_id・turn_id・音声ファイル（今回分のみ）
- situation・styleはRedisから取得するためリクエストに含めない

### Claudeへ渡すコンテキスト
次の質問生成時に渡すturnsは直近3〜5件に絞る。

---

## 通信設計

### フォーマット
- 基本はJSON
- 音声データのみmultipart/form-data

### エンドポイント一覧

#### GET /health
サーバー死活監視。

#### POST /session/start
セッションを開始し、最初の質問を返す。Redisにconfig・turnsを初期化する。

リクエスト
```json
{
  "situation": "新卒面接",
  "style": "圧迫",
  "duration_minutes": 10
}
```

レスポンス
```json
{
  "session_id": "uuid",
  "created_at": "2026-06-07T10:00:00Z",
  "first_question": "自己紹介をしてください",
  "turn_id": 1
}
```

#### POST /session/answer
回答音声を受け取り、文字起こし・次の質問を返す。
situation・styleはRedisから取得する。

リクエスト（multipart/form-data）
```
session_id: "uuid"
turn_id: 1
audio: (音声ファイル・今回分のみ)
```

レスポンス
```json
{
  "turn_id": 1,
  "answer_text": "私は...",
  "next_question": "学生時代に頑張ったことは？",
  "turn_id_next": 2
}
```

#### POST /session/end
セッションを終了し、サマリーフィードバックを返す。RedisキーをDELで削除する。

リクエスト
```json
{
  "session_id": "uuid"
}
```

レスポンス
```json
{
  "session_id": "uuid",
  "summary_feedback": {
    "total_filler_count": 8,
    "star_evaluation": {
      "situation": true,
      "task": false,
      "action": true,
      "result": true
    }
  }
}
```

---

## 保存用JSONスキーマ

セッション終了時にサーバー側で組み立ててファイルとして保存する。

```json
{
  "session_id": "uuid",
  "created_at": "2026-06-07T10:00:00Z",
  "config": {
    "situation": "新卒面接",
    "style": "圧迫",
    "duration_minutes": 10
  },
  "turns": [
    {
      "turn_id": 1,
      "question": "自己紹介をしてください",
      "answer_text": "私は...",
      "recorded_at": "2026-06-07T10:01:00Z"
    }
  ],
  "summary_feedback": {
    "total_filler_count": 8,
    "star_evaluation": {
      "situation": true,
      "task": false,
      "action": true,
      "result": true
    }
  }
}
```

### 補足
- feedbackはターンごとには持たず、セッション全体のサマリーのみ
- 将来的にuser_id・audio_path・face_scoreなどの項目を追加する想定

---

## GitHub Actions（CI）

PRごとに以下を自動実行する。デプロイジョブはホスティング先決定後に追加。

- 型チェック（`tsc --noEmit`）
- ESLint
- ビルド確認（frontend・backend）

---

## 未決定事項

- ホスティング先
- 背景画像の具体的なアセット（3シチュエーション×3スタイル=9枚）
