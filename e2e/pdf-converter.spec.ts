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

test("opens update history and restores trigger focus after Escape", async ({ page }) => {
  const { consoleErrors, pageErrors } = collectPageErrors(page);
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "업데이트 내역" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "업데이트 내역" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2026-07-12");
  await expect(dialog).toContainText("안정성 및 사용성 개선");
  await expect(dialog).toContainText("2026-05-03");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("keeps update history within a 320px viewport", async ({ page }) => {
  const { consoleErrors, pageErrors } = collectPageErrors(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");

  const headingMetrics = await page.getByRole("heading", { name: "PDF PNG 변환기" }).evaluate(
    (element) => {
      const rect = element.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      return { height: rect.height, lineHeight };
    },
  );
  expect(Math.abs(headingMetrics.height - headingMetrics.lineHeight)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "업데이트 내역" }).click();
  const dialog = page.getByRole("dialog", { name: "업데이트 내역" });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight
      );
    }),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.left < 0 || rect.right > innerWidth);
        })
        .map((element) => element.className || element.tagName),
    ),
  ).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("converts a real three-page PDF and downloads its PNG ZIP", async ({ page }) => {
  test.slow();
  const startedAt = performance.now();
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
  console.log(`[e2e timing] results-ready-ms=${Math.round(performance.now() - startedAt)}`);

  const downloadButton = page.getByRole("button", { name: "ZIP 다운로드" });
  const statusMessage = page.locator(".status-message");
  const snapshotState = async (label: string) => {
    const snapshot = await page.evaluate(() => {
      const normalize = (value: string | null) => value?.replace(/\s+/g, " ").trim() || "<none>";
      const summarize = (selector: string) => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
        return {
          count: elements.length,
          text: elements.map((element) => normalize(element.textContent)),
        };
      };
      const downloadButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => /ZIP|다운로드/.test(button.textContent ?? ""),
      );
      const root = document.querySelector("#root");

      return {
        url: window.location.href,
        statusMessage: summarize(".status-message"),
        selectedFile: summarize(".selected-file"),
        resultCardCount: document.querySelectorAll(".result-card").length,
        downloadButtonText: downloadButton ? normalize(downloadButton.textContent) : null,
        appShellCount: document.querySelectorAll(".app-shell").length,
        rootChildren: root?.children.length ?? 0,
      };
    });
    console.log(`[e2e state] ${label}=${JSON.stringify(snapshot)}`);
    return snapshot;
  };

  await snapshotState("before-download");
  const downloadPromise = page.waitForEvent("download");
  const handleFrameNavigated = (frame: import("@playwright/test").Frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[e2e navigation] url=${frame.url()}`);
    }
  };
  page.on("framenavigated", handleFrameNavigated);
  try {
    await downloadButton.click();
    try {
      await expect(statusMessage).toBeVisible({ timeout: 15_000 });
    } catch (error) {
      const normalize = (value: string | null) => value?.replace(/\s+/g, " ").trim() || "<none>";
      console.log(
        `[e2e diagnostics] download-status-timeout button=${JSON.stringify(normalize(await downloadButton.textContent()))} status=${JSON.stringify(normalize(await statusMessage.textContent()))} consoleErrors=${JSON.stringify(consoleErrors.map(normalize))} pageErrors=${JSON.stringify(pageErrors.map(normalize))}`,
      );
      throw error;
    }
    await snapshotState("after-download-click");
    const normalizedStatusText = (await statusMessage.textContent())?.replace(/\s+/g, " ").trim() ?? "";
    console.log(
      `[e2e timing] download-status-ms=${Math.round(performance.now() - startedAt)} text=${normalizedStatusText}`,
    );
    await expect(statusMessage).toContainText("sample-png-1080px.zip 다운로드를 시작했습니다.");
    const download = await downloadPromise;
    await download.path();
    console.log(`[e2e timing] download-ready-ms=${Math.round(performance.now() - startedAt)}`);
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe("sample-png-1080px.zip");
  } finally {
    page.off("framenavigated", handleFrameNavigated);
  }
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
