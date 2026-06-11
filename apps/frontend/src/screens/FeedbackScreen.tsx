import type { SummaryFeedback, StarEvaluation } from "@speaking-practice/types";

interface Props {
  feedback: SummaryFeedback;
  onRestart: () => void;
}

const STAR_ITEMS: {
  key: keyof StarEvaluation;
  label: string;
  desc: string;
}[] = [
  {
    key: "situation",
    label: "Situation（状況）",
    desc: "どんな状況だったかを説明できているか",
  },
  {
    key: "task",
    label: "Task（課題）",
    desc: "自分の役割・課題を示せているか",
  },
  {
    key: "action",
    label: "Action（行動）",
    desc: "具体的に何をしたかを語れているか",
  },
  {
    key: "result",
    label: "Result（結果）",
    desc: "結果や成果に触れられているか",
  },
];

/** フィラー語の数に応じたコメントを返す */
function fillerComment(count: number): string {
  if (count <= 2) return "とても聞き取りやすい話し方です";
  if (count <= 5) return "概ね良好です";
  return "フィラー語を減らすとより明瞭になります";
}

export function FeedbackScreen({ feedback, onRestart }: Props) {
  const starCount = STAR_ITEMS.filter(
    ({ key }) => feedback.star_evaluation[key],
  ).length;

  return (
    <div className="card feedback-card">
      <h1 className="title">フィードバック</h1>
      <p className="subtitle">今回のセッションの振り返りです</p>

      <div className="feedback-metrics">
        <div className="metric" data-testid="star-score">
          <span className="metric-num">
            {starCount}
            <span className="metric-denom">/4</span>
          </span>
          <span className="metric-text">STAR 達成項目</span>
        </div>
        <div className="metric" data-testid="filler-count">
          <span className="metric-num">{feedback.total_filler_count}</span>
          <span className="metric-text">フィラー語の総数</span>
        </div>
      </div>

      <p className="filler-comment">{fillerComment(feedback.total_filler_count)}</p>

      <h2 className="section-label">STAR フレームワーク評価</h2>
      <ul className="star-list">
        {STAR_ITEMS.map(({ key, label, desc }) => {
          const ok = feedback.star_evaluation[key];
          return (
            <li key={key} className="star-row">
              <span className={`star-mark ${ok ? "ok" : "ng"}`}>
                {ok ? "✓" : "✗"}
              </span>
              <span className="star-body">
                <span className="star-label">{label}</span>
                <span className="star-desc">{desc}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <button type="button" className="primary-btn" onClick={onRestart}>
        もう一度練習する
      </button>
    </div>
  );
}
