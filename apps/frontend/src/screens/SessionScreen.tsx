import { useEffect, useRef, useState } from "react";
import type { SummaryFeedback } from "@speaking-practice/types";
import type { StartedSession } from "./SelectionScreen";
import { backgroundFor } from "../theme";
import { submitAnswer, endSession, errorMessage } from "../api";

interface Props {
  session: StartedSession;
  onEnd: (feedback: SummaryFeedback) => void;
}

type Status = "idle" | "recording" | "submitting";

/** 秒数を mm:ss 形式に整形する */
function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** マイクアイコン（インライン SVG） */
function MicIcon() {
  return (
    <svg
      className="mic-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

/** 録音中に表示する波形バー（CSS アニメーション） */
function Waveform() {
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="wave-bar" />
      ))}
    </div>
  );
}

export function SessionScreen({ session, onEnd }: Props) {
  const [question, setQuestion] = useState(session.question);
  const [turnId, setTurnId] = useState(session.turnId);
  const [status, setStatus] = useState<Status>("idle");
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const pendingEndRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // マウント時にマイクを確保。リロード時は state を保持しないためセッションは終了する。
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;
      })
      .catch(() => {
        if (!cancelled) {
          alert(
            "マイクへのアクセスに失敗しました。ブラウザの権限設定を確認してください。",
          );
        }
      });

    return () => {
      cancelled = true;
      stopTimer();
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const doEndSession = async () => {
    setEnding(true);
    try {
      const res = await endSession(session.sessionId);
      onEnd(res.summary_feedback);
    } catch (err) {
      alert(`セッションの終了に失敗しました: ${errorMessage(err)}`);
      setEnding(false);
    }
  };

  const handleSubmit = async () => {
    setStatus("submitting");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    try {
      const res = await submitAnswer(session.sessionId, turnId, blob);
      setLastAnswer(res.answer_text);
      setQuestion(res.next_question);
      setTurnId(res.turn_id_next);
    } catch (err) {
      alert(`回答の送信に失敗しました: ${errorMessage(err)}`);
    } finally {
      setStatus("idle");
      if (pendingEndRef.current) {
        pendingEndRef.current = false;
        void doEndSession();
      }
    }
  };

  const handleRecordStart = () => {
    const stream = streamRef.current;
    if (!stream || status !== "idle" || ending) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      // 録音停止後、自動で回答を送信する
      void handleSubmit();
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus("recording");

    // 録音経過時間の計測を開始
    setElapsedSec(0);
    timerRef.current = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  };

  const handleRecordStop = () => {
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop(); // onstop → handleSubmit が走る
    }
  };

  const handleEnd = () => {
    if (status === "recording") {
      // 録音中は停止後に handleSubmit が完了してから終了する
      pendingEndRef.current = true;
      handleRecordStop();
      return;
    }
    void doEndSession();
  };

  const handleRecordToggle = () => {
    if (status === "idle") {
      handleRecordStart();
    } else if (status === "recording") {
      handleRecordStop();
    }
  };

  const recordHint =
    status === "recording"
      ? "もう一度押すと送信"
      : status === "submitting"
        ? "送信中…"
        : "押して録音開始";

  return (
    <div
      className="session-screen"
      style={{ background: backgroundFor(session.situation, session.style) }}
    >
      <div className="card session-card">
        <div className="badge">
          {session.situation} / {session.style}
        </div>

        <p className="question-label">面接官からの質問</p>
        <h2 className="question">{question}</h2>

        <div className="record-area">
          <button
            type="button"
            aria-label={recordHint}
            className={`record-btn ${status === "recording" ? "recording" : ""}`}
            disabled={status === "submitting" || ending}
            onClick={handleRecordToggle}
          >
            {status === "recording" ? (
              <>
                <Waveform />
                <span className="record-timer">{formatTime(elapsedSec)}</span>
              </>
            ) : (
              <MicIcon />
            )}
          </button>
          <p className="record-hint">{recordHint}</p>
        </div>

        {status === "submitting" && (
          <p className="status">文字起こし中です…</p>
        )}

        {lastAnswer !== null && status !== "submitting" && (
          <div className="last-answer">
            <span className="last-answer-label">前回の回答（文字起こし）</span>
            <p>{lastAnswer}</p>
          </div>
        )}

        <button
          type="button"
          className="secondary-btn"
          onClick={handleEnd}
          disabled={ending || status === "submitting"}
        >
          {ending ? "終了処理中…" : "セッションを終了する"}
        </button>
      </div>
    </div>
  );
}
