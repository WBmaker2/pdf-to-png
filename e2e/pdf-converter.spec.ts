import { expect, test } from "@playwright/test";
import { createTestPdf } from "./fixtures/createTestPdf";

function collectPageErrors(page: import("@playwright/test").Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

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
  const { consoleErrors, pageErrors } = collectPageErrors(page);

  await uploadSamplePdf(page);

  await expect(page.getByText("sample-00.png")).toBeVisible();
  await expect(page.getByText("sample-01.png")).toBeVisible();
  await expect(page.getByText("sample-02.png")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(3);
  await expect(page.locator(".result-file-name")).toHaveText([
    "sample-00.png",
    "sample-01.png",
    "sample-02.png",
  ]);
  await expect(page.locator(".result-dimensions")).toHaveText([
    "835 x 1080",
    "835 x 1080",
    "835 x 1080",
  ]);
  await expect(page.getByAltText("sample-00.png 미리보기")).toBeVisible();
  await expect(page.locator(".result-card img")).toHaveCount(3);
  await expect(page.locator(".result-card img").nth(2)).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".result-card img").evaluateAll((images) =>
        images.map((image) => ({
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight,
        })),
      ),
    )
    .toEqual([
      { width: 835, height: 1080 },
      { width: 835, height: 1080 },
      { width: 835, height: 1080 },
    ]);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ZIP 다운로드" }).click(),
  ]);
  await download.path();
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe("sample-png-1080px.zip");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("keeps a long download notice inside a 320px viewport", async ({ page }) => {
  const { consoleErrors, pageErrors } = collectPageErrors(page);
  const longPdfName = `${"classroomworksheet".repeat(18)}.pdf`;
  const longZipName = `${longPdfName.slice(0, -4)}-png-1080px.zip`;
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");

  const successTextColor = await page.evaluate(() => {
    const notice = document.createElement("div");
    notice.className = "status-message status-message--success";
    const text = document.createElement("span");
    text.className = "status-message-text";
    text.textContent = "변환 완료";
    notice.append(text);
    document.body.append(notice);
    const color = getComputedStyle(text).color;
    notice.remove();
    return color;
  });
  expect(successTextColor).toBe("rgb(19, 122, 63)");

  await expect(page.getByRole("heading", { name: "PDF PNG 변환기" })).toBeVisible();
  await expect(page.getByText("50MB 이하 · 최대 50페이지")).toBeVisible();
  await page.getByLabel("PDF 파일 선택").setInputFiles({
    name: longPdfName,
    mimeType: "application/pdf",
    buffer: createTestPdf(3),
  });
  await expect(page.locator(".selected-file")).toContainText(longPdfName);
  await expect(page.locator(".status-message")).toHaveCount(0);

  await page.getByRole("button", { name: "PNG로 변환하기" }).click();
  await expect(page.getByRole("button", { name: "ZIP 다운로드" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ZIP 다운로드" }).click(),
  ]);
  await download.path();
  expect(await download.failure()).toBeNull();
  await expect(page.locator(".status-message")).toContainText(
    `${longZipName} 다운로드를 시작했습니다.`,
  );
  await expect(page.locator(".status-message-text")).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
