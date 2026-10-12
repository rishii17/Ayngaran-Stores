// Some camera engines return UPC-A as EAN-13 with a leading zero.
// Only canonicalize valid GTINs, never arbitrary SKUs or numeric QR payloads.
function gtin(code) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  let sum = 0;
  for (
    let i = code.length - 2, weight = 3;
    i >= 0;
    i--, weight = weight === 3 ? 1 : 3
  )
    sum += Number(code[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(code.at(-1))
    ? code.padStart(14, "0")
    : null;
}
export function findProductByCode(products, value) {
  const code = String(value ?? "").trim();
  if (!code) return null;
  const active = products.filter((p) => p.active !== false);
  const exact = active.filter(
    (p) =>
      p.barcode === code ||
      p.id === code ||
      p.sku?.toLowerCase() === code.toLowerCase(),
  );
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const canonical = gtin(code);
  if (!canonical) return null;
  const matches = active.filter(
    (p) => gtin(String(p.barcode || "")) === canonical,
  );
  return matches.length === 1 ? matches[0] : null;
}
