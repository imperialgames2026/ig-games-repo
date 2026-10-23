import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.LAB_CHROME ? { executablePath: process.env.LAB_CHROME } : {}),
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
  ],
});
const url = process.env.LAB_URL || "http://127.0.0.1:4189/practice-lab.html";
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [],
    logs = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") logs.push(m.text());
  });
  await page.addInitScript(() => {
    window.practiceEvents = [];
    window.addEventListener("message", (e) => {
      if (
        e.origin === location.origin &&
        e.data?.channel === "imperial-practice-event"
      )
        window.practiceEvents.push(e.data);
    });
  });
  await page.goto(url);
  await page
    .getByText("Unity ready", { exact: true })
    .waitFor({ timeout: 120000 });
  await page
    .getByRole("button", { name: "Spin · 10 chips", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.practiceEvents.filter((e) => e.type === "complete").length === 1,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".round-history li").length === 1,
  );
  await page.screenshot({ path: "unity-roulette.png", fullPage: true });
  await page.getByRole("button", { name: "Craps", exact: true }).click();
  await page
    .getByRole("button", { name: "Roll dice · 10 chips", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".round-history li").length === 2,
  );
  await page.waitForFunction(
    () =>
      window.practiceEvents.filter((e) => e.type === "complete").length === 2,
  );
  await page.setViewportSize({ width: 412, height: 915 });
  await page.getByLabel("Camera", { exact: true }).selectOption("overhead");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "unity-craps-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const before = await page.locator(".chip-balance strong").innerText();
  await page.getByLabel("Renderer", { exact: true }).selectOption("web");
  await page.getByLabel("Renderer", { exact: true }).selectOption("unity");
  await page
    .getByText("Unity ready", { exact: true })
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  assert.equal(await page.locator(".chip-balance strong").innerText(), before);
  assert.equal(await page.locator(".round-history li").count(), 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(logs, []);
  console.log(
    JSON.stringify({
      test: "Unity load, two rounds, mobile camera, teardown/reload without resettlement",
      status: "passed",
      errors,
      logs,
      events: await page.evaluate(() =>
        window.practiceEvents.filter((e) => e.type !== "progress"),
      ),
    }),
  );
  await page.close();
  const failed = await browser.newPage();
  const failureErrors = [];
  failed.on("pageerror", (e) => failureErrors.push(e.message));
  await failed.route("**/unity/practice/v1/manifest.json", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await failed.goto(url);
  await failed.getByRole("alert").waitFor();
  await failed.getByLabel("Renderer", { exact: true }).selectOption("web");
  await failed
    .getByRole("button", { name: "Spin · 10 chips", exact: true })
    .click();
  await failed.waitForFunction(() =>
    document.querySelector(".round-history li"),
  );
  assert.deepEqual(failureErrors, []);
  console.log(
    JSON.stringify({
      test: "Missing Unity build recovers to lightweight practice",
      status: "passed",
      errors: failureErrors,
    }),
  );
  await failed.close();
} finally {
  await browser.close();
}
