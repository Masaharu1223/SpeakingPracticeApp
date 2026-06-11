import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

/**
 * Journey 3: フィードバック画面の表示
 * - セッション画面から「セッションを終了する」をクリック
 * - POST /session/end をモック
 * - フィードバック画面に遷移
 * - フィラー語カウント・STAR評価・「もう一度練習する」ボタンを確認
 */
test.describe("Journey 3: フィードバック画面の表示", () => {
  const SESSION_START_MOCK = {
    session_id: "test-123",
    created_at: "2026-06-09T00:00:00Z",
    first_question: "自己紹介をしてください",
    turn_id: 1,
  };

  const SESSION_END_MOCK = {
    session_id: "test-123",
    summary_feedback: {
      total_filler_count: 3,
      star_evaluation: {
        situation: true,
        task: false,
        action: true,
        result: true,
      },
    },
  };

  /**
   * セッション画面に到達するためのヘルパー関数
   * - MediaDevices APIをモック
   * - /session/start をモック
   * - 選択画面から「開始する」をクリック
   */
  async function navigateToSessionScreen(page: Page) {
    // MediaDevices APIをモック
    await page.addInitScript(() => {
      const mockStream = {
        getTracks: () => [{ stop: () => {} }],
        getAudioTracks: () => [{ stop: () => {} }],
      };
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: () => Promise.resolve(mockStream),
          enumerateDevices: () => Promise.resolve([]),
        },
        writable: true,
      });
    });

    // /session/start をモック
    await page.route("**/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_START_MOCK),
      });
    });

    await page.goto("/");

    // 「開始する」をクリック → セッション画面へ
    const [response] = await Promise.all([
      page.waitForResponse("**/session/start"),
      page.locator(".primary-btn", { hasText: "開始する" }).click(),
    ]);
    expect(response.status()).toBe(200);

    // セッション画面の表示を確認
    await expect(page.locator("h2.question")).toBeVisible({ timeout: 5000 });
  }

  test("フィードバック画面: フィラー語カウントとSTAR評価が正しく表示される", async ({
    page,
  }) => {
    await navigateToSessionScreen(page);

    // /session/end をモック
    await page.route("**/session/end", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_END_MOCK),
      });
    });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-before-end.png"),
    });

    // 「セッションを終了する」をクリック
    const [endResponse] = await Promise.all([
      page.waitForResponse("**/session/end"),
      page
        .locator(".secondary-btn", { hasText: "セッションを終了する" })
        .click(),
    ]);
    expect(endResponse.status()).toBe(200);

    // --- フィードバック画面への遷移確認 ---
    await expect(page.locator("h1.title", { hasText: "フィードバック" })).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-feedback-screen.png"),
    });

    // フィラー語カウント「3」が表示される
    await expect(
      page.locator('[data-testid="filler-count"] .metric-num'),
    ).toHaveText("3");
    await expect(
      page.locator('[data-testid="filler-count"] .metric-text'),
    ).toContainText("フィラー語の総数");

    // STAR評価のセクションタイトルが表示される
    await expect(page.locator("h2.section-label")).toHaveText(
      "STAR フレームワーク評価",
    );

    // 各STAR要素を確認
    const starList = page.locator(".star-list");

    // Situation: ✓（true）
    const situationRow = starList.locator(".star-row").filter({
      hasText: "Situation",
    });
    await expect(situationRow.locator(".star-mark.ok")).toHaveText("✓");
    await expect(situationRow.locator(".star-label")).toContainText(
      "Situation（状況）",
    );

    // Task: ✗（false）
    const taskRow = starList.locator(".star-row").filter({ hasText: "Task" });
    await expect(taskRow.locator(".star-mark.ng")).toHaveText("✗");
    await expect(taskRow.locator(".star-label")).toContainText("Task（課題）");

    // Action: ✓（true）
    const actionRow = starList.locator(".star-row").filter({
      hasText: "Action",
    });
    await expect(actionRow.locator(".star-mark.ok")).toHaveText("✓");
    await expect(actionRow.locator(".star-label")).toContainText(
      "Action（行動）",
    );

    // Result: ✓（true）
    const resultRow = starList.locator(".star-row").filter({
      hasText: "Result",
    });
    await expect(resultRow.locator(".star-mark.ok")).toHaveText("✓");
    await expect(resultRow.locator(".star-label")).toContainText(
      "Result（結果）",
    );

    // 「もう一度練習する」ボタンが表示される
    await expect(
      page.locator(".primary-btn", { hasText: "もう一度練習する" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-feedback-detail.png"),
    });
  });

  test("「もう一度練習する」ボタンをクリックすると選択画面に戻る", async ({
    page,
  }) => {
    await navigateToSessionScreen(page);

    // /session/end をモック
    await page.route("**/session/end", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_END_MOCK),
      });
    });

    // セッション終了
    const [endResponse] = await Promise.all([
      page.waitForResponse("**/session/end"),
      page
        .locator(".secondary-btn", { hasText: "セッションを終了する" })
        .click(),
    ]);
    expect(endResponse.status()).toBe(200);

    // フィードバック画面の表示を確認
    await expect(page.locator("h1.title", { hasText: "フィードバック" })).toBeVisible({
      timeout: 5000,
    });

    // 「もう一度練習する」をクリック
    await page
      .locator(".primary-btn", { hasText: "もう一度練習する" })
      .click();

    // 選択画面に戻ることを確認
    await expect(page.locator("h1.title", { hasText: "面接練習" })).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator("p.subtitle")).toContainText(
      "条件を選んで練習を始めましょう",
    );

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-back-to-selection.png"),
    });
  });

  test("フィードバック画面: STAR評価がすべてtrueの場合", async ({ page }) => {
    await navigateToSessionScreen(page);

    // 全項目trueのレスポンス
    await page.route("**/session/end", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session_id: "test-123",
          summary_feedback: {
            total_filler_count: 0,
            star_evaluation: {
              situation: true,
              task: true,
              action: true,
              result: true,
            },
          },
        }),
      });
    });

    await Promise.all([
      page.waitForResponse("**/session/end"),
      page
        .locator(".secondary-btn", { hasText: "セッションを終了する" })
        .click(),
    ]);

    await expect(page.locator("h1.title", { hasText: "フィードバック" })).toBeVisible({
      timeout: 5000,
    });

    // フィラー語カウントが0
    await expect(
      page.locator('[data-testid="filler-count"] .metric-num'),
    ).toHaveText("0");

    // 全てのSTAR評価が✓
    const okMarks = page.locator(".star-mark.ok");
    await expect(okMarks).toHaveCount(4);

    const ngMarks = page.locator(".star-mark.ng");
    await expect(ngMarks).toHaveCount(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-feedback-all-ok.png"),
    });
  });

  test("フィードバック画面: STAR評価がすべてfalseの場合", async ({
    page,
  }) => {
    await navigateToSessionScreen(page);

    // 全項目falseのレスポンス
    await page.route("**/session/end", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session_id: "test-123",
          summary_feedback: {
            total_filler_count: 10,
            star_evaluation: {
              situation: false,
              task: false,
              action: false,
              result: false,
            },
          },
        }),
      });
    });

    await Promise.all([
      page.waitForResponse("**/session/end"),
      page
        .locator(".secondary-btn", { hasText: "セッションを終了する" })
        .click(),
    ]);

    await expect(page.locator("h1.title", { hasText: "フィードバック" })).toBeVisible({
      timeout: 5000,
    });

    // フィラー語カウントが10
    await expect(
      page.locator('[data-testid="filler-count"] .metric-num'),
    ).toHaveText("10");

    // 全てのSTAR評価が✗
    const ngMarks = page.locator(".star-mark.ng");
    await expect(ngMarks).toHaveCount(4);

    const okMarks = page.locator(".star-mark.ok");
    await expect(okMarks).toHaveCount(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j3-feedback-all-ng.png"),
    });
  });
});
