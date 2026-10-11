export const VILLAGES = [
  "A Division",
  "B Division",
  "12 Ekar",
  "KR division",
  "Hopton",
  "Millabedha",
];
export const normalize = (value = "") =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ");
export const contactCode = (contact) =>
  contact.code || `CUS-${contact.id.slice(0, 8).toUpperCase()}`;
export function searchIndex(items, fields) {
  return items.map((item) => ({
    item,
    text: normalize(fields(item).join(" ")),
    exact: fields(item).map(normalize),
  }));
}
export function searchItems(index, query) {
  const q = normalize(query),
    tokens = q.split(" ").filter(Boolean);
  if (!q) return index.map((x) => x.item);
  return index
    .map((entry) => ({
      entry,
      score: entry.exact.includes(q)
        ? 0
        : entry.exact.some((f) => f.startsWith(q))
          ? 1
          : entry.text.includes(q)
            ? 2
            : 3,
    }))
    .filter(({ entry }) => tokens.every((t) => entry.text.includes(t)))
    .sort((a, b) => a.score - b.score)
    .map(({ entry }) => entry.item);
}
export const contactFields = (c) => [
  c.name,
  c.phone,
  (c.phone || "").replace(/\D/g, ""),
  c.id,
  contactCode(c),
  c.village || "",
  c.address,
];
export function matchesBill(s, query, customers = []) {
  const c = customers.find((x) => x.id === s.customerId);
  const index = searchIndex([s], () => [
    s.id,
    s.number,
    s.customerName,
    s.customerId || "",
    s.customerCode || "",
    s.customerVillage || "",
    c?.phone || "",
    (c?.phone || "").replace(/\D/g, ""),
    c?.village || "",
    c ? contactCode(c) : "",
  ]);
  return searchItems(index, query).length > 0;
}
