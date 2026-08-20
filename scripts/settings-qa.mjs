#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.env.QA_URL || "https://curtis-image-studio-6eadq.ondigitalocean.app/settings";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
});

const result = {
  ok: false,
  url,
  checks: {},
  errors: [],
};

page.on("pageerror", (err) => result.errors.push(String(err)));

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const connect = page.getByRole("button", { name: /connect instagram/i });
  result.checks.connectVisible = await connect.isVisible();
  result.checks.connectEnabled = await connect.isEnabled();

  const refresh = page.getByRole("button", { name: /^refresh$/i }).or(
    page.getByRole("button", { name: /refresh accounts/i }),
  );
  result.checks.refreshVisible = await refresh.first().isVisible();
  await refresh.first().click();
  await page.waitForTimeout(1200);
  result.checks.refreshWorked = await connect.isVisible();

  const deleteButtons = page.getByRole("button", { name: /^delete$/i });
  const deleteCount = await deleteButtons.count();
  result.checks.deleteButtonCount = deleteCount;
  result.checks.hasDeleteButtons = deleteCount > 0;

  const rows = page.locator("li").filter({ hasText: /ACTIVE|EXPIRED|FAILED/ });
  const rowCount = await rows.count();
  result.checks.accountRows = rowCount;
  result.checks.eachAccountHasDelete = rowCount === 0 || deleteCount >= rowCount;

  const keyDeletes = page.getByRole("button", { name: /^delete$/i });
  result.checks.keyAndAccountDeletes = await keyDeletes.count();

  const saveKeys = page.getByRole("button", { name: /save key/i });
  result.checks.saveKeyButtons = await saveKeys.count();

  if (rowCount > 0) {
    const firstRowDelete = rows.first().getByRole("button", { name: /^delete$/i });
    result.checks.firstRowDeleteVisible = await firstRowDelete.isVisible();
    result.checks.firstRowDeleteEnabled = await firstRowDelete.isEnabled();
  }

  const expired = page.locator("li").filter({ hasText: /EXPIRED|FAILED/ }).first();
  if (await expired.count()) {
    const before = await rows.count();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/composio/accounts") && res.request().method() === "DELETE", {
        timeout: 20_000,
      }),
      expired.getByRole("button", { name: /^delete$/i }).click(),
    ]);
    result.checks.deleteRequestStatus = response.status();
    result.checks.deleteRequestOk = response.ok();
    await page.waitForTimeout(800);
    result.checks.rowRemovedOrUpdated = (await page.locator("li").filter({ hasText: /ACTIVE|EXPIRED|FAILED/ }).count()) <= before;
  }

  result.ok =
    result.checks.connectVisible &&
    result.checks.hasDeleteButtons &&
    result.checks.eachAccountHasDelete &&
    (result.checks.deleteRequestOk ?? true);

  await page.screenshot({ path: "/tmp/settings-qa.png", fullPage: true });
  result.screenshot = "/tmp/settings-qa.png";
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
