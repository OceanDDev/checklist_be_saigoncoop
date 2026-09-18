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
/*    ⚠️ Đã bỏ luong_available (cột 15) / luong_allocate (cột 19) —    */
/*    không còn trong model.                                          */
/* ------------------------------------------------------------------ */
const COL = {
  sku: 0,
  name: 1,
  lpn: 4,
  slot: 6,
  luong_onhand: 11,
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

    // ⚠️ "HANGTRUNGCHUYEN" là mã giả cho hàng trung chuyển, không phải
    // SKU sản phẩm thật -> loại bỏ, không đưa vào so khớp/lưu DB.
    const skuNoSpace = sku.toUpperCase().replace(/\s+/g, "");
    if (skuNoSpace === "HANGTRUNGCHUYEN") return;

    result.push({
      slot: (row[COL.slot] ?? "").toString().trim(),
      sku: sku.toUpperCase(),
      name: (row[COL.name] ?? "").toString().trim(),
      lpn: (row[COL.lpn] ?? "").toString().trim(),
      luong_onhand: parseExcelNumber(row[COL.luong_onhand]),
    });
  });

  return result;
};

/* ------------------------------------------------------------------ */
/* 2) Parse file txt báo cáo JDA (Inventory Valuation Report)         */
/*                                                                      */
/*    a) Header xác định KHO — dòng dạng:                             */
/*         "Store  8101: KHO VE TINH BD (KM)   ---- Home Currency ---" */
/*       -> kho = "8101", tenKho = "KHO VE TINH BD (KM)"               */
/*                                                                      */
/*    b) Mỗi sản phẩm chiếm 2 dòng:                                    */
/*       Dòng chính (6 số):                                            */
/*         <SKU>  <Description>  OnHand  UnitRetail  ExtRetail         */
/*                                UnitCost  ExtCost  G.M.%              */
/*       Dòng phụ (3 số, không có SKU ở đầu) — các giá trị In-Transit,  */
/*       KHÔNG dùng tới ở đây.                                          */
/*                                                                      */
/*       -> luong_mms lấy số thứ 1 (On Hand) trên dòng chính.           */
/*       -> cost (đơn giá) lấy số thứ 4 (Unit Cost) trên dòng chính.    */
/* ------------------------------------------------------------------ */
const STORE_HEADER_PATTERN = /Store\s+(\d+)\s*:\s*(.+?)(?:\s{2,}|\r?$)/i;

const LINE_PATTERN = /^\s*(\d{5,10})\s+(.+?)\s{2,}(.+)$/;

// Token số trên dòng chính: dấu phẩy ngăn nghìn, 1-2 chữ số thập phân,
// dấu "-" (âm) có thể ở cuối. VD: "57,500.00", ".04", "100.0", "7.50-"
const NUMBER_TOKEN_PATTERN = /-?[\d,]*\.\d{1,2}-?/g;

const parseTxtMms = (fileContent) => {
  const text = fileContent.toString("utf8");
  const lines = text.split(/\r?\n/);

  let kho = "";
  let tenKho = "";

  // sku -> { name, luong_mms, cost }. Nếu SKU lặp lại (hiếm gặp), cộng
  // dồn luong_mms, giữ nguyên cost của lần gặp đầu tiên.
  const map = new Map();

  lines.forEach((line) => {
    if (!kho) {
      const storeMatch = STORE_HEADER_PATTERN.exec(line);
      if (storeMatch) {
        kho = storeMatch[1].trim();
        tenKho = storeMatch[2].trim();
        return;
      }
    }

    const m = LINE_PATTERN.exec(line);
    if (!m) return;

    const sku = m[1].trim().toUpperCase();
    const name = m[2].trim();
    const tokens = m[3].match(NUMBER_TOKEN_PATTERN) || [];
    if (tokens.length === 0) return; // không phải dòng dữ liệu hợp lệ

    const onHand = parseReportNumber(tokens[0]);
    const cost = tokens.length > 3 ? parseReportNumber(tokens[3]) : 0;

    if (map.has(sku)) {
      const prev = map.get(sku);
      prev.luong_mms += onHand;
    } else {
      map.set(sku, { name, luong_mms: onHand, cost });
    }
  });

  return { kho, tenKho, map };
};

module.exports = {
  parseExcelTonKho,
  parseTxtMms,
  parseReportNumber,
  parseExcelNumber,
};