// utils/tonkho/tonkhoParser.js
const XLSX = require("xlsx");

/* ------------------------------------------------------------------ */
/* Helpers số                                                          */
/* ------------------------------------------------------------------ */

// Parse số kiểu report JDA: dấu phẩy ngăn nghìn, số 0 hiển thị ".00"
// (không có chữ số trước dấu chấm), số âm ghi dấu "-" ở CUỐI (vd "20.8-").
const parseReportNumber = (raw) => {
  if (raw === null || raw === undefined) return 0;
  let s = raw.toString().trim();
  if (!s) return 0;
  let negative = false;
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return negative ? -n : n;
};

// Parse số bình thường (excel: dạng number hoặc string có dấu phẩy)
const parseExcelNumber = (raw) => {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const n = parseFloat(raw.toString().replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

/* ------------------------------------------------------------------ */
/* 1) Parse file Excel tồn kho (Cxnk_ton_kho-Export_Excel_Custom...)   */
/*    Cấu trúc cố định: 3 dòng header, dữ liệu bắt đầu từ dòng thứ 4.  */
/*    Cột theo vị trí (0-based):                                      */
/*      0  Mã Sản Phẩm      -> sku                                    */
/*      1  Tên Sản Phẩm     -> name                                   */
/*      4  Số LPN           -> lpn                                    */
/*      6  Vị trí           -> slot                                   */
/*      11 Tổng SL (Onhand) -> luong_onhand                           */
/*      15 Tổng SL (Available) -> luong_available                     */
/*      19 Tổng SL (Allocated) -> luong_allocate                      */
/* ------------------------------------------------------------------ */
const COL = {
  sku: 0,
  name: 1,
  lpn: 4,
  slot: 6,
  luong_onhand: 11,
  luong_available: 15,
  luong_allocate: 19,
};

const parseExcelTonKho = (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // range: 3 -> bỏ qua 3 dòng header, lấy dữ liệu từ dòng thứ 4 trở đi
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 3,
    defval: "",
  });

  const result = [];
  rows.forEach((row) => {
    const sku = (row[COL.sku] ?? "").toString().trim();
    if (!sku) return; // bỏ qua dòng trống / dòng tổng cuối bảng

    result.push({
      slot: (row[COL.slot] ?? "").toString().trim(),
      sku: sku.toUpperCase(),
      name: (row[COL.name] ?? "").toString().trim(),
      lpn: (row[COL.lpn] ?? "").toString().trim(),
      luong_onhand: parseExcelNumber(row[COL.luong_onhand]),
      luong_available: parseExcelNumber(row[COL.luong_available]),
      luong_allocate: parseExcelNumber(row[COL.luong_allocate]),
    });
  });

  return result;
};

/* ------------------------------------------------------------------ */
/* 2) Parse file txt báo cáo JDA (Inventory Valuation Report)         */
/*    Mỗi dòng sản phẩm dạng:                                         */
/*      <SKU>  <Description...>  <On Hand>  <Unit Retail>  ...        */
/*    SKU luôn là chuỗi số ở đầu dòng (5-10 chữ số), theo sau bởi ít  */
/*    nhất 2 khoảng trắng rồi tới Description, rồi tới On Hand (số   */
/*    dạng report, có thể là ".00" hoặc có dấu "-" ở cuối).           */
/* ------------------------------------------------------------------ */
const LINE_PATTERN = /^\s*(\d{5,10})\s+(.+?)\s{2,}(-?[\d,]*\.\d{2}-?)\s/;

const parseTxtMms = (fileContent) => {
  const text = fileContent.toString("utf8");
  const lines = text.split(/\r?\n/);

  // sku -> { name, luong_mms }. Nếu SKU lặp lại (hiếm gặp), cộng dồn.
  const map = new Map();

  lines.forEach((line) => {
    const m = LINE_PATTERN.exec(line);
    if (!m) return;

    const sku = m[1].trim().toUpperCase();
    const name = m[2].trim();
    const onHand = parseReportNumber(m[3]);

    if (map.has(sku)) {
      const prev = map.get(sku);
      prev.luong_mms += onHand;
    } else {
      map.set(sku, { name, luong_mms: onHand });
    }
  });

  return map;
};

module.exports = {
  parseExcelTonKho,
  parseTxtMms,
  parseReportNumber,
  parseExcelNumber,
};