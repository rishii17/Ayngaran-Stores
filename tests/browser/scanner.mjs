import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { seedState } from "../../lib/domain.mjs";
const barcode = seedState().products[0].barcode;
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const p = await b.newPage();
const decoderWarnings = [];
p.on("console", (message) => {
  if (/MultiFormatReader|Could not create a Canvas/.test(message.text()))
    decoderWarnings.push(message.text());
});
await p.addInitScript((code) => {
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
  const G = [
    "0100111",
    "0110011",
    "0011011",
    "0100001",
    "0011101",
    "0111001",
    "0000101",
    "0010001",
    "0001001",
    "0010111",
  ];
  const parity = [
    "LLLLLL",
    "LLGLGG",
    "LLGGLG",
    "LLGGGL",
    "LGLLGG",
    "LGGLLG",
    "LGGGLL",
    "LGLGLG",
    "LGLGGL",
    "LGGLGL",
  ];
  let bits = "101";
  for (let i = 1; i <= 6; i++)
    bits += (parity[Number(code[0])][i - 1] === "L" ? L : G)[Number(code[i])];
  bits += "01010";
  for (let i = 7; i < 13; i++)
    bits += L[Number(code[i])]
      .split("")
      .map((c) => (c === "0" ? "1" : "0"))
      .join("");
  bits += "101";
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    value: async () => {
      const c = document.createElement("canvas");
      c.width = 560;
      c.height = 300;
      const ctx = c.getContext("2d");
      let frame = 0;
      const draw = () => {
        ctx.fillStyle = "#aaa";
        ctx.fillRect(0, 0, 560, 300);
        if (window.showBarcode) {
          ctx.fillStyle = "#222";
          [...bits].forEach((v, i) => {
            if (v === "1") ctx.fillRect(90 + i * 4, 50, 4, 200);
          });
        }
        ctx.fillStyle = frame++ % 2 ? "#999" : "#aaa";
        ctx.fillRect(0, 0, 1, 1);
      };
      draw();
      window.scannerTimer = setInterval(draw, 60);
      const stream = c.captureStream(15);
      window.fakeStream = stream;
      return stream;
    },
    configurable: true,
  });
}, barcode);
await p.goto(process.env.POS_TEST_URL || "http://localhost:3000");
await p.getByRole("button", { name: "Scan", exact: true }).click();
await p
  .getByRole("button", { name: "Low-light enhancement", exact: true })
  .click();
await p.getByText(/Camera scanning ready|Fast camera scanning ready/).waitFor();
await p.waitForTimeout(1200);
assert.deepEqual(decoderWarnings, []);
await p.evaluate(() => (window.showBarcode = true));
await p
  .getByRole("button", { name: "Charge Rs. 240.00" })
  .waitFor({ timeout: 10000 });
assert.equal(
  await p.evaluate(() =>
    window.fakeStream.getTracks().every((t) => t.readyState === "ended"),
  ),
  true,
);
console.log(
  "PASS: generated EAN-13 decoded from synthetic low-contrast camera stream; tracks stopped after scan.",
);
assert.deepEqual(decoderWarnings, []);
await b.close();
