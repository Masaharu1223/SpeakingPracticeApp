/**
 * テスト3: セッション終了→フィードバック画面（APIモック使用）
 *
 * - 「セッションを終了する」ボタンクリック → POST /session/end をモック
 * - FeedbackScreenへの遷移確認
 * - フィラー語カウント・STAR評価の表示確認
 * - 「もう一度練習する」→ SelectionScreenへ戻る確認
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** MediaDevices.getUserMedia と MediaRecorder をモックする */
async function mockMediaAPIs(page: Page) {
  await page.addInitScript(() => {
    const mockStream = {
      getTracks: () => [{ stop: () => {} }],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: () => Promise.resolve(mockStream),
      },
    });

    class MockMediaRecorder extends EventTarget {
      state: string = "inactive";
      ondataavailable: ((e: Event) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream) {
        super();
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        if (this.ondataavailable) {
          const event = new Event("dataavailable") as BlobEvent;
          Object.defineProperty(event, "data", {
            value: new Blob(["audio"], { type: "audio/webm" }),
          });
          this.ondataavailable(event);
        }
        if (this.onstop) {
          this.onstop();
        }
      }
    }

    (window as unknown as Record<string, unknown>)["MediaRecorder"] =
      MockMediaRecorder;
  });
}

/** セッション開始までの共通セットアップ */
async function setupSessionScreen(page: Page) {
  await mockMediaAPIs(page);

  await page.route("**/session/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "test-session-002",
        created_at: "2026-06-09T10:00:00Z",
        first_question: "学生時代に力を入れたことを教えてください。",
        turn_id: 1,
      }),
    });
  });

  await page.route("**/session/end", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "test-session-002",
        summary_feedback: {
          total_filler_count: 8,
          star_evaluation: {
            situation: true,
            task: false,
            action: true,
            result: true,
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "開始する" }).click();

  // SessionScreen に遷移するのを待つ
  await expect(page.getByText("新卒面接 / 温厚")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("セッション終了→フィードバック画面", () => {
  test("「セッションを終了する」ボタンクリックでFeedbackScreenへ遷移する", async ({
    page,
  }) => {
    await setupSessionScreen(page);

    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(
      page.getByRole("heading", { name: "フィードバック" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("フィラー語カウントが表示される", async ({ page }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    // フィラー語の数値 "8" と "フィラー語の総数" テキストを確認
    await expect(page.getByText("8")).toBeVisible();
    await expect(page.getByText("フィラー語の総数")).toBeVisible();
  });

  test("STAR評価のラベルが全て表示される", async ({ page }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText("Situation（状況）")).toBeVisible();
    await expect(page.getByText("Task（課題）")).toBeVisible();
    await expect(page.getByText("Action（行動）")).toBeVisible();
    await expect(page.getByText("Result（結果）")).toBeVisible();
  });

  test("STAR評価の合否マーク（✓/✗）が正しく表示される", async ({ page }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    // situation=true → ✓ マーク
    const situationRow = page.locator(".star-row", {
      hasText: "Situation（状況）",
    });
    await expect(situationRow.locator(".star-mark.ok")).toBeVisible();
    await expect(situationRow.locator(".star-mark.ok")).toHaveText("✓");

    // task=false → ✗ マーク
    const taskRow = page.locator(".star-row", { hasText: "Task（課題）" });
    await expect(taskRow.locator(".star-mark.ng")).toBeVisible();
    await expect(taskRow.locator(".star-mark.ng")).toHaveText("✗");

    // action=true → ✓ マーク
    const actionRow = page.locator(".star-row", { hasText: "Action（行動）" });
    await expect(actionRow.locator(".star-mark.ok")).toBeVisible();

    // result=true → ✓ マーク
    const resultRow = page.locator(".star-row", { hasText: "Result（結果）" });
    await expect(resultRow.locator(".star-mark.ok")).toBeVisible();
  });

  test("STAR評価タイトルが表示される", async ({ page }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole("heading", { name: "STAR フレームワーク評価" })).toBeVisible();
  });

  test("「もう一度練習する」ボタンクリックでSelectionScreenへ戻る", async ({
    page,
  }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "もう一度練習する" }).click();

    // SelectionScreen に戻る
    await expect(
      page.getByRole("heading", { name: "面接練習" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
  });

  test("SelectionScreenに戻った後、デフォルト選択値が正しい", async ({
    page,
  }) => {
    await setupSessionScreen(page);
    await page.getByRole("button", { name: "セッションを終了する" }).click();

    await expect(page.getByRole("heading", { name: "フィードバック" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "もう一度練習する" }).click();

    await expect(page.getByRole("heading", { name: "面接練習" })).toBeVisible();

    // デフォルト選択が復元されている
    await expect(
      page.getByRole("button", { name: "新卒面接" }),
    ).toHaveClass(/selected/);
    await expect(page.getByRole("button", { name: "温厚" })).toHaveClass(
      /selected/,
    );
    await expect(
      page.getByRole("button", { name: "5分", exact: true }),
    ).toHaveClass(/selected/);
  });
});
