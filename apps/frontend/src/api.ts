import type {
  SessionStartRequest,
  SessionStartResponse,
  SessionAnswerResponse,
  SessionEndResponse,
} from "@speaking-practice/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

/** unknown なエラーから表示用メッセージを取り出す */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** エラーレスポンスからメッセージを抽出する（JSON の error フィールド優先） */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** POST /session/start — セッション開始・最初の質問を取得 */
export async function startSession(
  req: SessionStartRequest,
): Promise<SessionStartResponse> {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SessionStartResponse;
}

/** POST /session/answer — 録音音声を送信し、文字起こしと次の質問を取得 */
export async function submitAnswer(
  sessionId: string,
  turnId: number,
  audio: Blob,
): Promise<SessionAnswerResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("turn_id", String(turnId));
  form.append("audio", audio, "answer.webm");

  const res = await fetch(`${BASE_URL}/session/answer`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SessionAnswerResponse;
}

/** POST /session/end — セッション終了・サマリーフィードバックを取得 */
export async function endSession(
  sessionId: string,
): Promise<SessionEndResponse> {
  const res = await fetch(`${BASE_URL}/session/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SessionEndResponse;
}
