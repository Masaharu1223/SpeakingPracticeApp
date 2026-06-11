/**
 * テスト1: 選択画面の表示・操作（バックエンド不要）
 *
 * - ページロード時のタイトル表示
 * - 全ボタンの表示確認
 * - ボタンクリックによる selected クラスの切り替え
 * - デフォルト選択値の確認
 */

import { test, expect } from "@playwright/test";

test.describe("選択画面の表示・操作", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("ページロード時にタイトル「面接練習」が表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "面接練習" })).toBeVisible();
  });

  test("サブタイトルが表示される", async ({ page }) => {
    await expect(
      page.getByText("条件を選んで練習を始めましょう"),
    ).toBeVisible();
  });

  test("シチュエーションボタンが全て表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: "新卒面接" })).toBeVisible();
    await expect(page.getByRole("button", { name: "中途面接" })).toBeVisible();
    await expect(page.getByRole("button", { name: "昇進面接" })).toBeVisible();
  });

  test("面接官スタイルボタンが全て表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: "温厚" })).toBeVisible();
    await expect(page.getByRole("button", { name: "標準" })).toBeVisible();
    await expect(page.getByRole("button", { name: "圧迫" })).toBeVisible();
  });

  test("セッション時間ボタンが全て表示される", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "5分", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "10分", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "15分", exact: true }),
    ).toBeVisible();
  });

  test("「開始する」ボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
  });

  test("デフォルト選択値が正しい（新卒面接・温厚・5分）", async ({ page }) => {
    // デフォルトで選択されているボタンに selected クラスが付いている
    const shinkotsuBtn = page.getByRole("button", { name: "新卒面接" });
    await expect(shinkotsuBtn).toHaveClass(/selected/);

    const onkouBtn = page.getByRole("button", { name: "温厚" });
    await expect(onkouBtn).toHaveClass(/selected/);

    const fiveMinBtn = page.getByRole("button", { name: "5分", exact: true });
    await expect(fiveMinBtn).toHaveClass(/selected/);
  });

  test("シチュエーションボタンクリックで選択状態が切り替わる", async ({
    page,
  }) => {
    // 「中途面接」をクリック
    await page.getByRole("button", { name: "中途面接" }).click();

    await expect(
      page.getByRole("button", { name: "中途面接" }),
    ).toHaveClass(/selected/);
    // 「新卒面接」は selected から外れる
    await expect(
      page.getByRole("button", { name: "新卒面接" }),
    ).not.toHaveClass(/selected/);

    // 「昇進面接」をクリック
    await page.getByRole("button", { name: "昇進面接" }).click();
    await expect(
      page.getByRole("button", { name: "昇進面接" }),
    ).toHaveClass(/selected/);
    await expect(
      page.getByRole("button", { name: "中途面接" }),
    ).not.toHaveClass(/selected/);
  });

  test("スタイルボタンクリックで選択状態が切り替わる", async ({ page }) => {
    await page.getByRole("button", { name: "圧迫" }).click();
    await expect(page.getByRole("button", { name: "圧迫" })).toHaveClass(
      /selected/,
    );
    await expect(page.getByRole("button", { name: "温厚" })).not.toHaveClass(
      /selected/,
    );
  });

  test("セッション時間ボタンクリックで選択状態が切り替わる", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "10分", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "10分", exact: true }),
    ).toHaveClass(/selected/);
    await expect(
      page.getByRole("button", { name: "5分", exact: true }),
    ).not.toHaveClass(/selected/);
  });
});
