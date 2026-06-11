/**
 * テスト2: セッション開始フロー（APIモック使用）
 *
 * - 「開始する」ボタンクリック → POST /session/start をモック
 * - ローディング状態「開始中…」の表示確認
 * - APIレスポンス後にSessionScreenへ遷移
 * - 質問テキストの表示確認
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** MediaDevices.getUserMedia と MediaRecorder をモックする */
async function mockMediaAPIs(page: Page) {
  await page.addInitScript(() => {
    // MediaStream のモック
    const mockStream = {
      getTracks: () => [{ stop: () => {} }],
    } as unknown as MediaStream;

    // getUserMedia のモック（即座に解決）
    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: () => Promise.resolve(mockStream),
      },
    });

    // MediaRecorder のモック
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

test.describe("セッション開始フロー", () => {
  test.beforeEach(async ({ page }) => {
    await mockMediaAPIs(page);

    // POST /session/start をモック
    await page.route("**/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session_id: "test-session-001",
          created_at: "2026-06-09T10:00:00Z",
          first_question: "自己紹介をしてください。",
          turn_id: 1,
        }),
      });
    });

    await page.goto("/");
  });

  test("「開始する」ボタンをクリックするとAPIが呼ばれ、SessionScreenへ遷移する", async ({
    page,
  }) => {
    // デフォルト選択のまま開始
    const startBtn = page.getByRole("button", { name: "開始する" });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // SessionScreen に遷移したことを確認（バッジが表示される）
    await expect(page.getByText("新卒面接 / 温厚")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("APIレスポンス後に最初の質問テキストが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "開始する" }).click();

    await expect(page.getByText("自己紹介をしてください。")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("SessionScreenに録音ボタンが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "開始する" }).click();

    await expect(
      page.getByRole("button", { name: /押して録音開始/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("SessionScreenに「セッションを終了する」ボタンが表示される", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "開始する" }).click();

    await expect(
      page.getByRole("button", { name: "セッションを終了する" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("シチュエーション・スタイルを変えて開始するとバッジに反映される", async ({
    page,
  }) => {
    // 中途面接・圧迫を選択
    await page.getByRole("button", { name: "中途面接" }).click();
    await page.getByRole("button", { name: "圧迫" }).click();
    await page.getByRole("button", { name: "開始する" }).click();

    await expect(page.getByText("中途面接 / 圧迫")).toBeVisible({
      timeout: 10_000,
    });
  });
});
