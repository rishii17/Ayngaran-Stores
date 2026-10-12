import test from "node:test";
import assert from "node:assert/strict";
import { findProductByCode } from "../lib/product-code.mjs";
test("UPC and zero-prefixed EAN identify the same product without dropping arbitrary leading zeroes", () => {
  const p = { id: "p", sku: "SKU-1", barcode: "012345678905", active: true };
  assert.equal(findProductByCode([p], "0012345678905"), p);
  assert.equal(findProductByCode([p], " SKU-1 "), p);
  assert.equal(findProductByCode([{ ...p, barcode: "000123" }], "123"), null);
  assert.equal(findProductByCode([{ ...p, active: false }], p.barcode), null);
  assert.equal(
    findProductByCode([p, { ...p, id: "q" }], "00012345678905"),
    null,
  );
  assert.equal(findProductByCode([p], "0012345678906"), null);
});
