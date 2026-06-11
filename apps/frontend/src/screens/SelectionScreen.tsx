import { useState } from "react";
import type { Situation, InterviewStyle } from "@speaking-practice/types";
import { SITUATIONS, STYLES, DURATIONS } from "../theme";
import { startSession, errorMessage } from "../api";

/** 開始したセッションの情報（SessionScreen へ引き継ぐ） */
export interface StartedSession {
  sessionId: string;
  situation: Situation;
  style: InterviewStyle;
  question: string;
  turnId: number;
}

interface Props {
  onStart: (session: StartedSession) => void;
}

export function SelectionScreen({ onStart }: Props) {
  const [situation, setSituation] = useState<Situation>("新卒面接");
  const [style, setStyle] = useState<InterviewStyle>("温厚");
  const [duration, setDuration] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await startSession({
        situation,
        style,
        duration_minutes: duration,
      });
      onStart({
        sessionId: res.session_id,
        situation,
        style,
        question: res.first_question,
        turnId: res.turn_id,
      });
    } catch (err) {
      alert(`セッションの開始に失敗しました: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1 className="title">面接練習</h1>
      <p className="subtitle">条件を選んで練習を始めましょう</p>

      <div className="field">
        <span className="field-label">シチュエーション</span>
        <div className="options">
          {SITUATIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`option-btn ${situation === s ? "selected" : ""}`}
              onClick={() => setSituation(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">面接官のスタイル</span>
        <div className="options">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={`option-btn ${style === s ? "selected" : ""}`}
              onClick={() => setStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">セッション時間</span>
        <div className="options">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`option-btn ${duration === d ? "selected" : ""}`}
              onClick={() => setDuration(d)}
            >
              {d}分
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="primary-btn"
        onClick={handleStart}
        disabled={loading}
      >
        {loading ? "開始中…" : "開始する"}
      </button>
    </div>
  );
}
