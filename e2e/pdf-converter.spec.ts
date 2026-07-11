import { expect, test } from "@playwright/test";
import { createTestPdf } from "./fixtures/createTestPdf";

async function uploadSamplePdf(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("PDF 파일 선택").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: createTestPdf(3),
  });
  await page.getByRole("button", { name: "PNG로 변환하기" }).click();
}

test("converts a real three-page PDF and downloads its PNG ZIP", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await uploadSamplePdf(page);

  await expect(page.getByText("sample-00.png")).toBeVisible();
  await expect(page.getByText("sample-01.png")).toBeVisible();
  await expect(page.getByText("sample-02.png")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ZIP 다운로드" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("sample-png-1080p.zip");
  expect(consoleErrors).toEqual([]);
});

test("keeps the converter within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
