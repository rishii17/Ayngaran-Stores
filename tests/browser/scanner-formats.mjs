import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { seedState } from "../../lib/domain.mjs";
const require = createRequire(import.meta.url);
const {
  default: Code128,
} = require("@zxing/library/cjs/core/oned/Code128Reader.js");
const { QRCodeWriter, BarcodeFormat } = require("@zxing/library");
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const invert = (s) => [...s].map((b) => (b === "1" ? "0" : "1")).join("");
function ean8(s) {
  return (
    "101" +
    [...s.slice(0, 4)].map((n) => L[+n]).join("") +
    "01010" +
    [...s.slice(4)].map((n) => invert(L[+n])).join("") +
    "101"
  );
}
function upc(s) {
  return (
    "101" +
    [...s.slice(0, 6)].map((n) => L[+n]).join("") +
    "01010" +
    [...s.slice(6)].map((n) => invert(L[+n])).join("") +
    "101"
  );
}
function code128(s) {
  const codes = [104, ...[...s].map((c) => c.charCodeAt(0) - 32)];
  codes.push(codes.reduce((sum, n, i) => sum + n * (i || 1), 0) % 103, 106);
  return codes
    .flatMap((n) =>
      Array.from(Code128.CODE_PATTERNS[n]).map((width, i) =>
        (i % 2 ? "0" : "1").repeat(width),
      ),
    )
    .join("");
}
const qr = new QRCodeWriter().encode(
  "AYS-001",
  BarcodeFormat.QR_CODE,
  240,
  240,
  new Map(),
);
const matrix = Array.from({ length: 240 }, (_, y) =>
  Array.from({ length: 240 }, (_, x) => (qr.get(x, y) ? 1 : 0)),
);
const cases = [
  { name: "EAN-8", code: "96385074", bits: ean8("96385074") },
  { name: "UPC-A", code: "012345678905", bits: upc("012345678905") },
  { name: "Code128", code: "BOX-1234", bits: code128("BOX-1234") },
  {
    name: "rotated Code128",
    code: "BOX-1234",
    bits: code128("BOX-1234"),
    rotate: true,
  },
  { name: "QR", code: "AYS-001", matrix },
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const fixture of cases) {
    const page = await browser.newPage();
    const state = seedState();
    state.products[0].barcode = fixture.code;
    await page.addInitScript(
      ({ fixture, state }) => {
        localStorage.setItem(
          "ayngaran-demo-v1",
          JSON.stringify({ state, receipts: {} }),
        );
        window.BarcodeDetector = class {
          static async getSupportedFormats() {
            return ["qr_code"];
          }
          async detect() {
            return [];
          }
        };
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            const source = document.createElement("canvas");
            source.width = fixture.matrix ? 320 : fixture.bits.length * 3 + 120;
            source.height = 320;
            const c = source.getContext("2d");
            c.fillStyle = "white";
            c.fillRect(0, 0, source.width, source.height);
            c.fillStyle = "black";
            if (fixture.matrix) {
              fixture.matrix.forEach((row, y) =>
                row.forEach((v, x) => {
                  if (v) c.fillRect(x + 40, y + 40, 1, 1);
                }),
              );
            } else
              [...fixture.bits].forEach((v, i) => {
                if (v === "1") c.fillRect(60 + i * 3, 70, 3, 180);
              });
            const out = document.createElement("canvas");
            out.width = fixture.rotate ? source.height : source.width;
            out.height = fixture.rotate ? source.width : source.height;
            const ctx = out.getContext("2d");
            if (fixture.rotate) {
              ctx.translate(out.width, 0);
              ctx.rotate(Math.PI / 2);
            }
            ctx.drawImage(source, 0, 0);
            const stream = out.captureStream(15);
            window.testStream = stream;
            window.drawInterval = setInterval(() => {
              ctx.drawImage(source, 0, 0);
            }, 60);
            return stream;
          },
        });
      },
      { fixture, state },
    );
    await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await page
      .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
      .waitFor({ timeout: 15000 });
    assert.equal(
      await page.evaluate(() =>
        window.testStream.getTracks().every((t) => t.readyState === "ended"),
      ),
      true,
    );
    console.log("PASS camera fallback: " + fixture.name);
    await page.close();
  }
} finally {
  await browser.close();
}
