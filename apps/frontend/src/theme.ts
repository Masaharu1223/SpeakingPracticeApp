import type { Situation, InterviewStyle } from "@speaking-practice/types";

/** 選択肢の一覧（描画順） */
export const SITUATIONS: Situation[] = ["新卒面接", "中途面接", "昇進面接"];
export const STYLES: InterviewStyle[] = ["温厚", "標準", "圧迫"];
export const DURATIONS = [5, 10, 15] as const;

// シチュエーションで色相、スタイルで彩度・明度を変え、3×3=9通りの背景を作る。
// （背景画像が未用意のため CSS グラデーションで代替）
const SITUATION_HUE: Record<Situation, number> = {
  新卒面接: 205,
  中途面接: 150,
  昇進面接: 280,
};

const STYLE_SHADE: Record<InterviewStyle, { s: number; l: number }> = {
  温厚: { s: 60, l: 66 },
  標準: { s: 58, l: 50 },
  圧迫: { s: 52, l: 30 },
};

/** シチュエーション×スタイルに対応する背景 CSS（linear-gradient）を返す */
export function backgroundFor(
  situation: Situation,
  style: InterviewStyle,
): string {
  const hue = SITUATION_HUE[situation];
  const { s, l } = STYLE_SHADE[style];
  const c1 = `hsl(${hue}, ${s}%, ${l}%)`;
  const c2 = `hsl(${(hue + 35) % 360}, ${s}%, ${Math.max(l - 14, 0)}%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}
