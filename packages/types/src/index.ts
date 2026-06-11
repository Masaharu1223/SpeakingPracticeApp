// --- ドメイン定数 ---

export type Situation = "新卒面接" | "中途面接" | "昇進面接";
export type InterviewStyle = "温厚" | "標準" | "圧迫";

// --- 共有エンティティ ---

export interface SessionConfig {
  situation: Situation;
  style: InterviewStyle;
  duration_minutes: number;
}

export interface Turn {
  turn_id: number;
  question: string;
  answer_text: string;
  recorded_at: string; // ISO 8601
}

export interface StarEvaluation {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
}

export interface SummaryFeedback {
  total_filler_count: number;
  star_evaluation: StarEvaluation;
}

// --- API リクエスト型 ---

export interface SessionStartRequest {
  situation: Situation;
  style: InterviewStyle;
  duration_minutes: number;
}

// POST /session/answer は multipart/form-data のため FormData として送信
// session_id: string, turn_id: number, audio: File
export interface SessionAnswerFormFields {
  session_id: string;
  turn_id: number;
}

export interface SessionEndRequest {
  session_id: string;
}

// --- API レスポンス型 ---

export interface HealthResponse {
  status: "ok";
}

export interface SessionStartResponse {
  session_id: string;
  created_at: string; // ISO 8601
  first_question: string;
  turn_id: number;
}

export interface SessionAnswerResponse {
  turn_id: number;
  answer_text: string;
  next_question: string;
  turn_id_next: number;
}

export interface SessionEndResponse {
  session_id: string;
  summary_feedback: SummaryFeedback;
}

// --- 保存用JSONスキーマ ---

export interface SessionRecord {
  session_id: string;
  created_at: string; // ISO 8601
  config: SessionConfig;
  turns: Turn[];
  summary_feedback: SummaryFeedback;
}
