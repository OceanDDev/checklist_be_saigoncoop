// utils/normalizeChuyen.js
const CHUYEN_CANONICAL = [
  "SÁNG",
  "TRƯA",
  "CHIỀU",
  "TỐI",
  "KHAI TRƯƠNG",
  "PHÂN BỔ",
  "GIAO KHÁCH",
];

const stripDiacritics = (str) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const normalizeForCompare = (str) =>
  stripDiacritics(str.toString().trim())
    .toUpperCase()
    .replace(/\s+/g, " ");

const CHUYEN_LOOKUP = CHUYEN_CANONICAL.reduce((map, canonical) => {
  map[normalizeForCompare(canonical)] = canonical;
  return map;
}, {});

function normalizeChuyen(raw) {
  if (!raw) return "";
  const key = normalizeForCompare(raw);
  const matched = CHUYEN_LOOKUP[key];
  if (!matched) {
    console.warn(`[normalizeChuyen] Không khớp giá trị chuẩn nào: "${raw}"`);
  }
  return matched || raw.toString().trim();
}

module.exports = { normalizeChuyen, CHUYEN_CANONICAL };