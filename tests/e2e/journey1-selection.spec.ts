import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

/**
 * Journey 1: 選択画面の表示と操作
 * - シチュエーション・スタイル・時間のボタンが表示される
 * - 各ボタンをクリックすると選択状態が変わる
 */
test.describe("Journey 1: 選択画面の表示と操作", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("選択画面が正しく表示される", async ({ page }) => {
    // タイトルの確認
    await expect(page.locator("h1.title")).toHaveText("面接練習");
    await expect(page.locator("p.subtitle")).toContainText(
      "条件を選んで練習を始めましょう",
    );

    // シチュエーションのボタンが3つ表示される
    const situationButtons = page.locator(".field").filter({
      hasText: "シチュエーション",
    });
    await expect(situationButtons.locator(".option-btn")).toHaveCount(3);
    await expect(
      situationButtons.locator(".option-btn", { hasText: "新卒面接" }),
    ).toBeVisible();
    await expect(
      situationButtons.locator(".option-btn", { hasText: "中途面接" }),
    ).toBeVisible();
    await expect(
      situationButtons.locator(".option-btn", { hasText: "昇進面接" }),
    ).toBeVisible();

    // スタイルのボタンが3つ表示される
    const styleButtons = page.locator(".field").filter({
      hasText: "面接官のスタイル",
    });
    await expect(styleButtons.locator(".option-btn")).toHaveCount(3);
    await expect(
      styleButtons.locator(".option-btn", { hasText: "温厚" }),
    ).toBeVisible();
    await expect(
      styleButtons.locator(".option-btn", { hasText: "標準" }),
    ).toBeVisible();
    await expect(
      styleButtons.locator(".option-btn", { hasText: "圧迫" }),
    ).toBeVisible();

    // 時間のボタンが3つ表示される
    const durationButtons = page.locator(".field").filter({
      hasText: "セッション時間",
    });
    await expect(durationButtons.locator(".option-btn")).toHaveCount(3);
    await expect(
      durationButtons.getByRole("button", { name: "5分", exact: true }),
    ).toBeVisible();
    await expect(
      durationButtons.getByRole("button", { name: "10分", exact: true }),
    ).toBeVisible();
    await expect(
      durationButtons.getByRole("button", { name: "15分", exact: true }),
    ).toBeVisible();

    // 「開始する」ボタンが表示される
    await expect(page.locator(".primary-btn")).toHaveText("開始する");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j1-selection-initial.png"),
    });
  });

  test("シチュエーション選択: クリックで選択状態が変わる", async ({
    page,
  }) => {
    const field = page.locator(".field").filter({ hasText: "シチュエーション" });

    // 初期状態: 新卒面接が選択済み
    await expect(
      field.locator(".option-btn.selected", { hasText: "新卒面接" }),
    ).toBeVisible();

    // 中途面接をクリック
    await field.locator(".option-btn", { hasText: "中途面接" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "中途面接" }),
    ).toBeVisible();
    await expect(
      field.locator(".option-btn.selected", { hasText: "新卒面接" }),
    ).not.toBeVisible();

    // 昇進面接をクリック
    await field.locator(".option-btn", { hasText: "昇進面接" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "昇進面接" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j1-situation-selected.png"),
    });
  });

  test("スタイル選択: クリックで選択状態が変わる", async ({ page }) => {
    const field = page
      .locator(".field")
      .filter({ hasText: "面接官のスタイル" });

    // 初期状態: 温厚が選択済み
    await expect(
      field.locator(".option-btn.selected", { hasText: "温厚" }),
    ).toBeVisible();

    // 標準をクリック
    await field.locator(".option-btn", { hasText: "標準" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "標準" }),
    ).toBeVisible();

    // 圧迫をクリック
    await field.locator(".option-btn", { hasText: "圧迫" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "圧迫" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j1-style-selected.png"),
    });
  });

  test("時間選択: クリックで選択状態が変わる", async ({ page }) => {
    const field = page.locator(".field").filter({ hasText: "セッション時間" });

    // 初期状態: 5分が選択済み
    await expect(
      field.locator(".option-btn.selected", { hasText: "5分" }),
    ).toBeVisible();

    // 10分をクリック
    await field.locator(".option-btn", { hasText: "10分" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "10分" }),
    ).toBeVisible();

    // 15分をクリック
    await field.locator(".option-btn", { hasText: "15分" }).click();
    await expect(
      field.locator(".option-btn.selected", { hasText: "15分" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j1-duration-selected.png"),
    });
  });

  test("全ての選択肢を変更してから状態を確認する", async ({ page }) => {
    const situationField = page
      .locator(".field")
      .filter({ hasText: "シチュエーション" });
    const styleField = page
      .locator(".field")
      .filter({ hasText: "面接官のスタイル" });
    const durationField = page
      .locator(".field")
      .filter({ hasText: "セッション時間" });

    await situationField.locator(".option-btn", { hasText: "昇進面接" }).click();
    await styleField.locator(".option-btn", { hasText: "圧迫" }).click();
    await durationField.locator(".option-btn", { hasText: "15分" }).click();

    await expect(
      situationField.locator(".option-btn.selected", { hasText: "昇進面接" }),
    ).toBeVisible();
    await expect(
      styleField.locator(".option-btn.selected", { hasText: "圧迫" }),
    ).toBeVisible();
    await expect(
      durationField.locator(".option-btn.selected", { hasText: "15分" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "j1-all-selected.png"),
    });
  });
});
