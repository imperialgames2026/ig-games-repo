// Run against the isolated practice entry, without auth or backend credentials.
// LAB_URL=http://127.0.0.1:4189/practice-lab.html node tests/tableLab.browser.mjs
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
try {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 412, height: 915 },
    { width: 915, height: 412 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      process.env.LAB_URL || "http://127.0.0.1:4189/practice-lab.html",
    );
    await page.getByRole("heading", { name: "The Imperial tables" }).waitFor();
    await page.getByLabel("Renderer", { exact: true }).selectOption("web");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Sound off", exact: true }).click();
    await page.getByRole("button", { name: "Sound on", exact: true }).click();
    await page.getByLabel("Reduced motion", { exact: true }).check();
    await page
      .getByRole("button", { name: "Spin · 10 chips", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector(".round-history li"),
    );
    assert.equal(await page.locator(".round-history li").count(), 1);
    await page.getByLabel("Camera", { exact: true }).selectOption("overhead");
    await page.getByRole("button", { name: "Craps", exact: true }).click();
    await page
      .getByRole("button", { name: "Roll dice · 10 chips", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".round-history li").length === 2,
    );
    assert.match(await page.locator(".round-result").innerText(), /^Rolled /);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ viewport, status: "passed", rounds: 2, errors }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
