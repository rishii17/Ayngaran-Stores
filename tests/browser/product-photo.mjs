import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const navigate = async (name) => {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  await navigate("Products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f7931a";
    context.fillRect(0, 0, 1600, 1200);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  const photo = {
    name: "camera-photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(image, "base64"),
  };
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  const chooser = await chooserPromise;
  assert.equal(await chooser.element().getAttribute("capture"), "environment");
  await page.evaluate(() => {
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = async (...args) => {
      await new Promise((resolve) => {
        window.finishPhoto = resolve;
      });
      window.createImageBitmap = decode;
      return decode(...args);
    };
  });
  await chooser.setFiles(photo);
  await page.getByText("Optimizing photo…", { exact: true }).first().waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Optimizing photo…", exact: true })
      .isDisabled(),
    true,
  );
  await page.evaluate(() => window.finishPhoto());
  const preview = page.getByAltText("Product preview", { exact: true });
  await preview.waitFor();
  assert.match(await preview.getAttribute("src"), /^data:image\/webp;/);
  assert.deepEqual(
    await preview.evaluate((img) => [img.naturalWidth, img.naturalHeight]),
    [600, 450],
  );
  // Choosing a bad file must retain the successful photo and permit retry.
  const original = await preview.getAttribute("src");
  await page.getByLabel("Product image", { exact: true }).setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await page.getByText("Choose an image file", { exact: true }).waitFor();
  assert.equal(await preview.getAttribute("src"), original);
  await page.getByRole("button", { name: "Remove image", exact: true }).click();
  assert.equal(await preview.count(), 0);
  await page.getByLabel("Product image", { exact: true }).setInputFiles(photo);
  await preview.waitFor();
  await page
    .getByLabel("Product name *", { exact: true })
    .fill("Mobile camera product");
  await page.getByLabel("SKU", { exact: true }).fill("MOBILE-CAMERA-TEST");
  await page.getByLabel("Selling price *", { exact: true }).fill("150");
  await page.getByLabel("Purchase cost *", { exact: true }).fill("100");
  await page.getByLabel("Opening stock *", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await navigate("Products");
  const row = page.getByRole("row").filter({ hasText: "MOBILE-CAMERA-TEST" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  assert.match(await preview.getAttribute("src"), /^data:image\/webp;/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await navigate("Point of sale");
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByText(/Camera permission was denied/).waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile rear-camera photo picker, WebP resize, invalid-file recovery, gallery/remove, product save/reload and camera permission denial.",
  );
} finally {
  await browser.close();
}
