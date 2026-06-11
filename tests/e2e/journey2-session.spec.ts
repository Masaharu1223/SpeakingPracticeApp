import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

/**
 * Journey 2: セッション開始フロー（APIモック）
 * - 選択画面でシチュエーション・スタイル・時間を選ぶ
 * - 「開始する」をクリック
 * - POST /session/start をモックして応答
 * - セッション画面に遷移して質問が表示される
 */
test.describe("Journey 2: セッション開始フロー（APIモック）", () => {
  const SESSION_START_MOCK = {
    session_id: "test-123",
    created_at: "2026-06-09T00:00:00Z",
    first_question: "自己紹介をしてください",
    turn_id: 1,
  };

  test.beforeEach(async ({ page }) => {
    // MediaDevices APIをモック（マイクアクセスエラーを回避）
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

    // POST /session/start をインターセプト
    await page.route("**/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_START_MOCK),
      });
    });

    await page.goto("/");
  });

  test("セッション開始フロー: 選択 → セッション画面への遷移", async ({
    page,
  }) => {
    // --- 選択画面の確認 ---
    await expect(page.locator("h1.title")).toHaveText("面接練習");

    // シチュエーションを「中途面接」に変更
    const situationField = page
      .locator(".field")
      .filter({ hasText: "シチュエーション" });
    await situationField
      .locator(".option-btn", { hasText: "中途面接" })
      .click();
    await expect(
      situationField.locator(".option-btn.selected", { hasText: "中途面接" }),
    ).toBeVisible();

    // スタイルを「標準」に変更
    const styleField = page
      .locator(".field")
      .filter({ hasText: "面接官のスタイル" });
    await styleField.locator(".option-btn", { hasText: "標準" }).click();
    await expect(
      styleField.locator(".option-btn.selected", { hasText: "標準" }),
    ).toBeVisible();

    // 時間を「10分」に変更
    const durationField = page
      .locator(".field")
      .filter({ hasText: "セッション時間" });
    await durationField.locator(".option-btn", { hasText: "10分" }).click();
    await expect(
      durationField.locator(".option-btn.selected", { hasText: "10分" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j2-before-start.png"),
    });

    // --- 「開始する」ボタンをクリック ---
    const startBtn = page.locator(".primary-btn", { hasText: "開始する" });
    await expect(startBtn).toBeEnabled();

    // APIレスポンスを待ちつつクリック
    const [response] = await Promise.all([
      page.waitForResponse("**/session/start"),
      startBtn.click(),
    ]);
    expect(response.status()).toBe(200);

    // --- セッション画面への遷移確認 ---
    // セッション画面の特徴的な要素が表示されるのを待つ
    await expect(page.locator("h2.question")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("p.question-label")).toHaveText(
      "面接官からの質問",
    );

    // モックで返した質問が表示されている
    await expect(page.locator("h2.question")).toHaveText(
      "自己紹介をしてください",
    );

    // バッジ（シチュエーション / スタイル）が表示される
    await expect(page.locator(".badge")).toContainText("中途面接");
    await expect(page.locator(".badge")).toContainText("標準");

    // 録音ボタンと終了ボタンが表示される
    await expect(page.locator(".record-btn")).toBeVisible();
    await expect(
      page.locator(".secondary-btn", { hasText: "セッションを終了する" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j2-session-screen.png"),
    });
  });

  test("セッション開始中のローディング状態", async ({ page }) => {
    // レスポンスを遅延させてローディング状態を確認
    await page.route("**/session/start", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_START_MOCK),
      });
    });

    await page.reload();

    const startBtn = page.locator(".primary-btn");

    // クリック後にローディング状態になる
    await startBtn.click();
    // ボタンが「開始中…」になるか disabled になる
    await expect(startBtn).toBeDisabled();

    // セッション画面に遷移するまで待つ
    await expect(page.locator("h2.question")).toBeVisible({ timeout: 5000 });
  });

  test("デフォルト選択（新卒面接・温厚・5分）でセッション開始", async ({
    page,
  }) => {
    // 何も変更せずにデフォルトのまま開始
    const [response] = await Promise.all([
      page.waitForResponse("**/session/start"),
      page.locator(".primary-btn", { hasText: "開始する" }).click(),
    ]);
    expect(response.status()).toBe(200);

    // セッション画面へ遷移
    await expect(page.locator("h2.question")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("h2.question")).toHaveText(
      "自己紹介をしてください",
    );

    // バッジのデフォルト値を確認
    await expect(page.locator(".badge")).toContainText("新卒面接");
    await expect(page.locator(".badge")).toContainText("温厚");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j2-default-session-screen.png"),
    });
  });
});
