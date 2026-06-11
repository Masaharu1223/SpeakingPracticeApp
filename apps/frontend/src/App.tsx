import { useState } from "react";
import type { SummaryFeedback } from "@speaking-practice/types";
import { SelectionScreen } from "./screens/SelectionScreen";
import type { StartedSession } from "./screens/SelectionScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { FeedbackScreen } from "./screens/FeedbackScreen";

// ルーティングライブラリは使わず、React の state で画面遷移を管理する。
type ScreenState =
  | { name: "selection" }
  | { name: "session"; session: StartedSession }
  | { name: "feedback"; feedback: SummaryFeedback };

export function App() {
  const [screen, setScreen] = useState<ScreenState>({ name: "selection" });

  switch (screen.name) {
    case "selection":
      return (
        <div className="app">
          <SelectionScreen
            onStart={(session) => setScreen({ name: "session", session })}
          />
        </div>
      );
    case "session":
      return (
        <SessionScreen
          session={screen.session}
          onEnd={(feedback) => setScreen({ name: "feedback", feedback })}
        />
      );
    case "feedback":
      return (
        <div className="app">
          <FeedbackScreen
            feedback={screen.feedback}
            onRestart={() => setScreen({ name: "selection" })}
          />
        </div>
      );
  }
}
