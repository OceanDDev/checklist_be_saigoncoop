const ExcelJS = require("exceljs");
const fs = require("fs");
const dayjs = require("dayjs");
const QuanLyHD = require("../../models/quanlyhd/quanlyhd");

// ==== CẤU HÌNH CÓ THỂ CHỈNH ====
// [PERF] Tăng 3000 -> 5000: ít round-trip bulkWrite hơn, giảm overhead network tới DB
// [PERF-2] Sau khi bỏ bước findExistingWmsKeys (xem upsertHdBatch), có thể tăng thêm nữa
// (thử 8000-10000) vì không còn tốn query $or nhiều điều kiện trước mỗi batch.
const CHUNK_SIZE = 8000;
const MAX_HEADER_SCAN_ROWS = 20; // quét tối đa bấy nhiêu dòng đầu để tìm header thật (file HD có 5 dòng tiêu đề)
const MAX_DETAIL_ENTRIES = 500; // giới hạn số dòng lỗi/bỏ qua trả về chi tiết, tránh response quá nặng

// Trạng thái riêng: khi FE lọc đúng trạng thái này -> trả về TẤT CẢ (không phân trang)
const TRANG_THAI_HIEN_THI_HET = "Không khớp lượng";
// [PERF] Giới hạn cứng dù FE có xin nhiều hơn, tránh 1 request kéo cả triệu doc gây sập server
const SHOW_ALL_MAX_LIMIT = 5000;

// Header của file Hóa Đơn -> field tạm (sẽ được xử lý tiếp ở finalizeHdDoc)
const HEADER_MAP_HD = {
  "Số hóa đơn": "_so_hd",
  "TRF/SODA": "tf_sd_hd",
  "Ngày hóa đơn": "ngay_hoa_don",
  "Ký hiệu": "_ky_hieu",
  "Tên người mua hàng": "_ten_nguoi_mua",
  "Ghi chú": "_ghi_chu",
  "Mã hàng": "sku",
  "Số lượng": "luong_hd",
};

// Header của file WMS -> field tạm
const HEADER_MAP_WMS = {
  "Mã Hàng": "sku",
  "Tên Hàng": "name",
  "Số Phiếu": "tf_sd_wms",
  "Tổng SL": "luong_wms",
  "Mã NXĐ": "_ma_ch_raw",
  "Tên NXĐ": "ten_ch_wms",
};

/**
 * Chuẩn hoá giá trị 1 cell Excel về kiểu đơn giản (string / number / Date).
 * ExcelJS có thể trả về OBJECT thay vì string thuần trong các trường hợp:
 *
 * 1. Rich text: khi trong 1 ô có nhiều đoạn text định dạng font khác nhau
 *    (VD: dấu "$" bị tô đậm/màu khác phần chữ còn lại) -> trả về
 *    { richText: [{ text, font }, ...] } thay vì chuỗi thường.
 *    Đây là nguyên nhân các dòng như "$Nescafe Viet den lon 170ml" bị đọc
 *    sai/mất tên hàng nếu không xử lý.
 * 2. Formula cell: { formula: "...", result: <giá trị đã tính> }
 * 3. Hyperlink cell: { text: "...", hyperlink: "..." }
 */
function extractCellValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (rawValue instanceof Date) return rawValue;
  if (typeof rawValue !== "object") return rawValue;

  if (Array.isArray(rawValue.richText)) {
    return rawValue.richText.map((rt) => rt.text ?? "").join("");
  }
  if (Object.prototype.hasOwnProperty.call(rawValue, "result")) {
    return extractCellValue(rawValue.result);
  }
  if (Object.prototype.hasOwnProperty.call(rawValue, "text")) {
    return rawValue.text;
  }
  return typeof rawValue.toString === "function" ? rawValue.toString() : "";
}

/**
 * Parse số dạng "1,234" hoặc số Excel thông thường
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse ngày: exceljs trả về Date object nếu cell format là date,
 * hoặc string dd/mm/yyyy nếu cell là text
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  const parts = str.split(/[/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    const date = new Date(y < 100 ? 2000 + y : y, m - 1, d);
    if (!isNaN(date.getTime())) return date;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Chuẩn hóa mã cửa hàng để 2 file có thể so khớp được với nhau:
 * - Nếu là số thuần (VD "02052") -> bỏ số 0 ở đầu ("2052")
 * - Nếu là mã chữ (VD "ch00273") -> viết hoa toàn bộ ("CH00273")
 * Đã test thực tế: khớp 136/137 mã giữa file HD và WMS sau khi chuẩn hóa.
 */
function normalizeMaCh(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s.toUpperCase();
}

/**
 * Chuẩn hóa TÊN cửa hàng để so khớp (bỏ hết ký tự đặc biệt/khoảng trắng, viết thường)
 * VD: "Co.opMart Van Thanh" và "CO OP MART VAN THANH" -> cùng ra "coopmartvanthanh"
 */
function normalizeStoreName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Tách phần số của "Số Phiếu" (WMS, VD "TO17502350", "SO24562404") hoặc "TRF/SODA" (HD, đã thuần số)
 * -> bỏ hết ký tự không phải số ở đầu, chỉ giữ lại phần số để 2 bên so được với nhau.
 */
function extractSoPhieu(raw) {
  if (!raw) return "";
  return String(raw).trim().replace(/^\D+/, "");
}

/**
 * Parse "Tên người mua hàng" hoặc "Ghi chú" dạng "MÃ-TÊN[-hậu tố kiện/tầng...]"
 * VD: "02052-CF PHAN XICH LONG 37" -> { ma: "02052", ten: "CF PHAN XICH LONG 37" }
 * VD: "*CH00351-CO.OPSMILE - 117 HO VAN LONG-1K-1T-P21-DLTM"
 *     -> { ma: "CH00351", ten: "CO.OPSMILE - 117 HO VAN LONG" }
 * Nếu chuỗi không theo pattern "mã-tên" (không có dấu "-") -> không xác định được mã,
 * trả ma: "" (dòng này sẽ bị coi là invalid vì thiếu khóa đối chiếu)
 */
function parseMaChTen(raw) {
  if (!raw) return { ma: "", ten: "" };
  let str = String(raw).trim().replace(/^\*+/, "").trim();
  const parts = str.split("-");
  if (parts.length < 2) {
    return { ma: "", ten: str };
  }
  const ma = parts[0].trim();
  const rest = parts.slice(1);
  // Tìm token dạng số+K (VD "1K", "14K") -> đánh dấu bắt đầu phần hậu tố kiện/tầng, bỏ từ đó
  const suffixIndex = rest.findIndex((p) => /^\d+K$/i.test(p.trim()));
  const nameParts = suffixIndex === -1 ? rest : rest.slice(0, suffixIndex);
  const ten = nameParts.join("-").trim();
  return { ma, ten };
}

/**
 * Từ các field tạm đã đọc theo HEADER_MAP_HD, build doc cuối cùng cho 1 dòng Hóa Đơn.
 * storeNameMap: Map<tên cửa hàng đã chuẩn hoá, ma_ch thật> được dựng sẵn từ dữ liệu WMS
 * (dùng để tra mã cho các dòng Co.opMart lớn không có mã nhúng trong text, VD "Co.opMart Van Thanh").
 */
function finalizeHdDoc(raw, storeNameMap) {
  const so_hd =
    raw._so_hd !== undefined && raw._so_hd !== null
      ? String(raw._so_hd).trim()
      : "";
  const ky_hieu = raw._ky_hieu ? String(raw._ky_hieu).trim() : "";
  const so_hoa_don = ky_hieu && so_hd ? `${ky_hieu}-${so_hd}` : so_hd;

  const tenNguoiMua = raw._ten_nguoi_mua
    ? String(raw._ten_nguoi_mua).trim()
    : "";
  const ghiChu = raw._ghi_chu ? String(raw._ghi_chu).trim() : "";
  const source = tenNguoiMua || ghiChu;
  const { ma, ten } = parseMaChTen(source);

  let ma_ch = normalizeMaCh(ma);
  let resolvedByName = false;

  // Không tách được mã từ text (VD "Co.opMart Van Thanh") -> tra theo tên trong bảng ánh xạ từ WMS
  if (!ma_ch) {
    const lookupKey = normalizeStoreName(ten || source);
    const foundMaCh = storeNameMap.get(lookupKey);
    if (foundMaCh) {
      ma_ch = foundMaCh;
      resolvedByName = true;
    }
  }

  return {
    ma_ch,
    so_hoa_don,
    tf_sd_hd: raw.tf_sd_hd ? String(raw.tf_sd_hd).trim() : "",
    so_phieu_hd: extractSoPhieu(raw.tf_sd_hd),
    ten_ch_hd: ten,
    sku: raw.sku ? String(raw.sku).trim() : "",
    luong_hd: parseNumber(raw.luong_hd),
    ngay_hoa_don: parseDate(raw.ngay_hoa_don),
    _resolvedByName: resolvedByName,
  };
}

/**
 * Từ các field tạm đã đọc theo HEADER_MAP_WMS, build doc cuối cùng cho 1 dòng WMS.
 * storeNameMap: Map dùng để lưu lại "tên cửa hàng đã chuẩn hoá -> mã cửa hàng thật",
 * để bên Hóa Đơn tra ngược khi không tách được mã từ text.
 * skuNameMap: Map dùng để lưu lại "sku -> tên hàng", để các dòng HĐ không tìm thấy phiếu WMS
 * tương ứng (trạng thái "No Data WMS") vẫn có thể điền tạm tên hàng nếu SKU đó có xuất hiện
 * ở phiếu WMS khác trong CÙNG lần import này.
 */
function finalizeWmsDoc(raw, storeNameMap, skuNameMap) {
  const doc = {
    ma_ch: normalizeMaCh(raw._ma_ch_raw),
    sku: raw.sku ? String(raw.sku).trim() : "",
    name: raw.name ? String(raw.name).trim() : "",
    tf_sd_wms: raw.tf_sd_wms ? String(raw.tf_sd_wms).trim() : "",
    so_phieu_wms: extractSoPhieu(raw.tf_sd_wms),
    ten_ch_wms: raw.ten_ch_wms ? String(raw.ten_ch_wms).trim() : "",
    luong_wms: parseNumber(raw.luong_wms),
  };

  if (doc.ma_ch && doc.ten_ch_wms) {
    storeNameMap.set(normalizeStoreName(doc.ten_ch_wms), doc.ma_ch);
  }
  if (doc.sku && doc.name && !skuNameMap.has(doc.sku)) {
    skuNameMap.set(doc.sku, doc.name);
  }

  return doc;
}

/**
 * Đọc 1 file Excel kiểu streaming, TỰ DÒ dòng header trong MAX_HEADER_SCAN_ROWS dòng đầu
 * (file Hóa Đơn có 5 dòng tiêu đề trước khi tới header thật), sau đó parse từng dòng
 * bằng finalizeRowFn, gom batch rồi gọi upsertBatchFn để ghi DB.
 */
async function processFile(
  filePath,
  headerMap,
  finalizeRowFn,
  requiredFields,
  upsertBatchFn,
  stats,
) {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    styles: "cache",
    worksheets: "emit",
  });

  const minMatches = Math.min(3, Object.keys(headerMap).length);
  let headerIndexMap = null; // { [colIndex]: fieldName }
  let batch = [];

  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      // Chưa tìm thấy header -> thử xem dòng này có phải header không
      if (!headerIndexMap) {
        if (row.number > MAX_HEADER_SCAN_ROWS) {
          throw new Error(
            `Không tìm thấy dòng header hợp lệ trong ${MAX_HEADER_SCAN_ROWS} dòng đầu của file`,
          );
        }
        const candidate = {};
        let matches = 0;
        row.eachCell({ includeEmpty: false }, (cell, colIndex) => {
          // [FIX] header cũng có thể bị rich text -> dùng extractCellValue để dò đúng tên cột
          const header = String(extractCellValue(cell.value) || "").trim();
          if (headerMap[header]) {
            candidate[colIndex] = headerMap[header];
            matches += 1;
          }
        });
        if (matches >= minMatches) {
          headerIndexMap = candidate;
        }
        continue;
      }

      // Đã có header -> đây là dòng dữ liệu
      const rawDoc = {};
      for (const [colIndex, field] of Object.entries(headerIndexMap)) {
        // [FIX] Bóc rich text / formula / hyperlink cell về giá trị thuần trước khi xử lý tiếp
        // -> khắc phục lỗi mất tên hàng với các dòng có ký tự đặc biệt (VD "$Nescafe...")
        // bị Excel lưu dưới dạng rich text do định dạng font không đồng nhất trong cùng 1 ô.
        rawDoc[field] = extractCellValue(row.getCell(Number(colIndex)).value);
      }

      stats.totalRows += 1;

      const doc = finalizeRowFn(rawDoc);

      const missingFields = requiredFields.filter(
        (f) => doc[f] === undefined || doc[f] === null || doc[f] === "",
      );
      if (missingFields.length > 0) {
        stats.invalidRows += 1;
        if (stats.skippedDetails.length < MAX_DETAIL_ENTRIES) {
          stats.skippedDetails.push({
            rowNumber: row.number, // số dòng THẬT trong file Excel, mở file lên Ctrl+G tới dòng này để kiểm tra
            reason: `Thiếu: ${missingFields.join(", ")}`,
            ma_ch: doc.ma_ch || "",
            sku: doc.sku || "",
            so_hoa_don: doc.so_hoa_don || undefined,
            ten_ch_hd: doc.ten_ch_hd || undefined,
            ten_ch_wms: doc.ten_ch_wms || undefined,
          });
        }
        continue;
      }

      batch.push({ ...doc, _rowNumber: row.number });

      if (batch.length >= CHUNK_SIZE) {
        await upsertBatchFn(batch, stats);
        batch = [];
      }
    }
  }

  await upsertBatchFn(batch, stats);
}

/**
 * Upsert batch từ file WMS.
 * Mỗi PHIẾU (so_phieu_wms) là 1 document riêng -> filter gồm cả so_phieu_wms,
 * không chỉ {ma_ch, sku}, để tránh nhiều phiếu cùng SKU/cửa hàng bị đè lẫn nhau.
 * Pipeline update tự tính trangThai dựa trên luong_hd ĐANG CÓ SẴN (nếu HĐ đã import khớp vào rồi).
 *
 * LƯU Ý: filter theo {ma_ch, sku, so_phieu_wms} nên nếu trước đó 1 dòng HĐ không tìm thấy
 * WMS đã được lưu tạm với trangThai "No Data WMS" (dùng so_phieu_hd làm so_phieu_wms trong
 * khóa), thì khi phiếu WMS ĐÚNG được import ở đây, nó sẽ tự động khớp và update vào ĐÚNG
 * document đó (không tạo document trùng), trangThai sẽ được tính lại bình thường ở dưới.
 */
async function upsertWmsBatch(batch, stats) {
  if (batch.length === 0) return;

  const ops = batch.map((doc) => ({
    updateOne: {
      filter: {
        ma_ch: doc.ma_ch,
        sku: doc.sku,
        so_phieu_wms: doc.so_phieu_wms,
      },
      update: [
        {
          $set: {
            ma_ch: doc.ma_ch,
            ten_ch_wms: doc.ten_ch_wms,
            tf_sd_wms: doc.tf_sd_wms,
            so_phieu_wms: doc.so_phieu_wms,
            sku: doc.sku,
            name: doc.name,
            luong_wms: doc.luong_wms,
            ngay_import: new Date(),
          },
        },
        {
          $set: {
            trangThai: {
              $cond: [
                { $eq: [{ $ifNull: ["$luong_hd", null] }, null] },
                "Chưa có hóa đơn",
                {
                  $cond: [
                    { $eq: ["$luong_wms", "$luong_hd"] },
                    "Hoàn thành",
                    "Không khớp lượng",
                  ],
                },
              ],
            },
          },
        },
      ],
      upsert: true,
    },
  }));

  try {
    const result = await QuanLyHD.bulkWrite(ops, { ordered: false });
    stats.upserted += result.upsertedCount || 0;
    stats.modified += result.modifiedCount || 0;
    stats.matched += result.matchedCount || 0;
  } catch (err) {
    // Với ordered:false, MongoDB vẫn thực hiện các op không lỗi -> lấy số liệu thành công từ err.result
    const partialResult = err.result || {};
    stats.upserted += partialResult.upsertedCount || 0;
    stats.modified += partialResult.modifiedCount || 0;
    stats.matched += partialResult.matchedCount || 0;

    const writeErrors = err.writeErrors || partialResult.writeErrors || [];
    for (const we of writeErrors) {
      const failedDoc = batch[we.index] || {};
      if (stats.errorDetails.length < MAX_DETAIL_ENTRIES) {
        stats.errorDetails.push({
          rowNumber: failedDoc._rowNumber,
          ma_ch: failedDoc.ma_ch,
          sku: failedDoc.sku,
          code: we.code,
          message: we.errmsg || (we.err && we.err.errmsg) || "Lỗi ghi dữ liệu",
        });
      }
    }

    stats.errors.push({
      message: err.message,
      code: err.code,
      writeErrorsCount: writeErrors.length,
    });
  }
}

/**
 * [PERF-2] Upsert batch từ file HĐ - GỘP thành 1 bulkWrite pipeline duy nhất,
 * KHÔNG còn query kiểm tra tồn tại trước (đã bỏ hẳn findExistingWmsKeys).
 *
 * Trước đây: mỗi batch phải query $or (nhiều điều kiện) để biết doc WMS đã tồn tại
 * chưa, rồi mới tách matched/unmatched và chạy 2 bulkWrite riêng -> tốn tới 3 round-trip
 * DB / batch, và $or nhiều điều kiện là kiểu query không tối ưu với index.
 *
 * Giờ đây: dùng ĐÚNG kỹ thuật giống upsertWmsBatch — filter theo
 * {ma_ch, sku, so_phieu_wms: so_phieu_hd}, upsert:true, và dùng $ifNull trên $luong_wms
 * (field chỉ có nếu doc WMS đã tồn tại từ trước) để MongoDB tự phân biệt:
 *   - Nếu $luong_wms đã có sẵn -> đây là update vào doc WMS có sẵn (matched)
 *   - Nếu không (doc mới toanh do upsert tạo ra) -> "No Data WMS"
 * Chỉ còn 1 round-trip DB / batch.
 *
 * bulkWrite result.upsertedIds cho biết CHÍNH XÁC index nào trong batch bị "No Data WMS"
 * (được tạo mới) -> dùng để build lại unmatchedDetails mà không cần query riêng.
 */
async function upsertHdBatch(batch, stats, skuNameMap) {
  if (batch.length === 0) return;

  // Tra tên hàng cho các SKU chưa có trong skuNameMap (từ DB, phòng trường hợp SKU này
  // chưa từng xuất hiện trong dữ liệu WMS của lần import hiện tại). $ifNull trong pipeline
  // bên dưới sẽ chỉ dùng giá trị này khi doc là MỚI (chưa có "name" sẵn từ WMS).
  const missingSkus = [
    ...new Set(batch.filter((d) => !skuNameMap.has(d.sku)).map((d) => d.sku)),
  ];
  if (missingSkus.length > 0) {
    const existingNamed = await QuanLyHD.find(
      { sku: { $in: missingSkus }, name: { $nin: [null, ""] } },
      { sku: 1, name: 1, _id: 0 },
    ).lean();
    for (const d of existingNamed) {
      if (!skuNameMap.has(d.sku)) skuNameMap.set(d.sku, d.name);
    }
  }

  const ops = batch.map((doc) => ({
    updateOne: {
      filter: {
        ma_ch: doc.ma_ch,
        sku: doc.sku,
        so_phieu_wms: doc.so_phieu_hd, // so với so_phieu_wms đã lưu sẵn từ lần import WMS
      },
      update: [
        {
          $set: {
            ma_ch: doc.ma_ch,
            sku: doc.sku,
            so_phieu_wms: doc.so_phieu_hd,
            so_hoa_don: doc.so_hoa_don,
            tf_sd_hd: doc.tf_sd_hd,
            so_phieu_hd: doc.so_phieu_hd,
            ten_ch_hd: doc.ten_ch_hd,
            luong_hd: doc.luong_hd,
            ngay_hoa_don: doc.ngay_hoa_don,
            ngay_import: new Date(),
            // Giữ nguyên "name" nếu doc đã tồn tại (đến từ WMS); chỉ điền tạm tên hàng
            // nếu doc này MỚI được tạo ở đây (không có $name trước đó -> null -> dùng fallback)
            name: { $ifNull: ["$name", skuNameMap.get(doc.sku) || ""] },
          },
        },
        {
          $set: {
            trangThai: {
              $cond: [
                // $luong_wms chỉ có giá trị nếu doc WMS đã tồn tại từ trước (không phải doc mới upsert)
                { $eq: [{ $ifNull: ["$luong_wms", null] }, null] },
                "No Data WMS",
                {
                  $cond: [
                    { $eq: ["$luong_wms", "$luong_hd"] },
                    "Hoàn thành",
                    "Không khớp lượng",
                  ],
                },
              ],
            },
          },
        },
      ],
      upsert: true,
    },
  }));

  const recordStats = (result) => {
    stats.matched += result.matchedCount || 0;
    stats.modified += result.modifiedCount || 0;

    // upsertedIds: map { batchIndex: _id } cho các op phải TẠO MỚI doc (= không khớp WMS)
    const upsertedIds = result.upsertedIds || {};
    const unmatchedIndices = Object.keys(upsertedIds).map(Number);
    stats.unmatchedRows = (stats.unmatchedRows || 0) + unmatchedIndices.length;
    stats.noDataWmsCreated =
      (stats.noDataWmsCreated || 0) + unmatchedIndices.length;

    for (const idx of unmatchedIndices) {
      const doc = batch[idx];
      if (!doc) continue;
      if (stats.unmatchedDetails.length < MAX_DETAIL_ENTRIES) {
        stats.unmatchedDetails.push({
          rowNumber: doc._rowNumber,
          reason:
            "Không tìm thấy phiếu WMS tương ứng (chưa import WMS, hoặc so_phieu không khớp) -> đã lưu với trạng thái 'No Data WMS'",
          ma_ch: doc.ma_ch,
          sku: doc.sku,
          so_hoa_don: doc.so_hoa_don,
          so_phieu_hd: doc.so_phieu_hd,
        });
      }
    }
  };

  try {
    const result = await QuanLyHD.bulkWrite(ops, { ordered: false });
    recordStats(result);
  } catch (err) {
    // Với ordered:false, MongoDB vẫn thực hiện các op không lỗi -> lấy số liệu thành công từ err.result
    const partialResult = err.result || {};
    recordStats(partialResult);

    const writeErrors = err.writeErrors || partialResult.writeErrors || [];
    for (const we of writeErrors) {
      const failedDoc = batch[we.index] || {};
      if (stats.errorDetails.length < MAX_DETAIL_ENTRIES) {
        stats.errorDetails.push({
          rowNumber: failedDoc._rowNumber,
          ma_ch: failedDoc.ma_ch,
          sku: failedDoc.sku,
          so_hoa_don: failedDoc.so_hoa_don,
          code: we.code,
          message: we.errmsg || (we.err && we.err.errmsg) || "Lỗi ghi dữ liệu",
        });
      }
    }

    stats.errors.push({
      message: err.message,
      code: err.code,
      writeErrorsCount: writeErrors.length,
    });
  }
}

/**
 * GET /quanlyhd
 * Danh sách có phân trang + filter.
 * Riêng trangThai = "Không khớp lượng": FE có thể xin limit lớn để hiển thị hết,
 * BE clamp tối đa SHOW_ALL_MAX_LIMIT để tránh 1 request kéo quá nhiều dữ liệu.
 */
exports.getDanhSach = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      SHOW_ALL_MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const {
      ma_ch,
      sku,
      so_hoa_don,
      name,
      so_phieu_wms,
      so_phieu_hd,
      trangThai,
      tu_ngay_hoa_don,
      den_ngay_hoa_don,
      tu_ngay_import,
      den_ngay_import,
      sortBy = "ngay_import",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    const escapeRegex = (str) =>
      String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (ma_ch) filter.ma_ch = { $regex: escapeRegex(ma_ch), $options: "i" };
    if (sku) filter.sku = { $regex: escapeRegex(sku), $options: "i" };
    if (so_hoa_don)
      filter.so_hoa_don = { $regex: escapeRegex(so_hoa_don), $options: "i" };
    if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };
    // Lọc trên giá trị GỐC (tf_sd_wms/tf_sd_hd, có tiền tố TO/SO) chứ không phải
    // so_phieu_wms/so_phieu_hd (đã bóc tiền tố) -> gõ "TO175..." hay chỉ "175..." đều match vì regex là substring
    if (so_phieu_wms)
      filter.tf_sd_wms = { $regex: escapeRegex(so_phieu_wms), $options: "i" };
    if (so_phieu_hd)
      filter.tf_sd_hd = { $regex: escapeRegex(so_phieu_hd), $options: "i" };

    if (trangThai) {
      const list = String(trangThai)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      filter.trangThai = list.length > 1 ? { $in: list } : list[0];
    }

    // [FIX] Dùng dayjs().startOf("day")/.endOf("day") thay vì new Date(chuỗi ngày thuần).
    // new Date("2026-07-09") bị JS parse theo UTC 00:00 (= 07:00 sáng giờ VN), nên nếu
    // tu_ngay = den_ngay (lọc đúng 1 ngày) thì $gte/$lte trùng đúng 1 thời điểm -> hầu như
    // không ra kết quả nào. dayjs(...) parse theo giờ local server, khớp đúng ý người dùng chọn.
    if (tu_ngay_hoa_don || den_ngay_hoa_don) {
      filter.ngay_hoa_don = {};
      if (tu_ngay_hoa_don)
        filter.ngay_hoa_don.$gte = dayjs(tu_ngay_hoa_don)
          .startOf("day")
          .toDate();
      if (den_ngay_hoa_don)
        filter.ngay_hoa_don.$lte = dayjs(den_ngay_hoa_don)
          .endOf("day")
          .toDate();
    }

    if (tu_ngay_import || den_ngay_import) {
      filter.ngay_import = {};
      if (tu_ngay_import)
        filter.ngay_import.$gte = dayjs(tu_ngay_import).startOf("day").toDate();
      if (den_ngay_import)
        filter.ngay_import.$lte = dayjs(den_ngay_import).endOf("day").toDate();
    }

    const allowedSortFields = [
      "ngay_import",
      "ngay_hoa_don",
      "luong_wms",
      "luong_hd",
      "trangThai",
      "ma_ch",
      "sku",
    ];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ngay_import";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const useEffectiveDateSort = sortField === "ngay_import";

    // [PERF] Chạy countDocuments và query dữ liệu SONG SONG (Promise.all) thay vì
    // await tuần tự -> tiết kiệm 1 round-trip latency mỗi lần gọi API list
    const [total, data] = await Promise.all([
      QuanLyHD.countDocuments(filter),
      useEffectiveDateSort
        ? // Sort theo "thời điểm mới nhất" = ngay_xu_ly (nếu đã xác nhận hoàn thành thủ công)
          // hoặc ngay_import (mặc định) -> dòng vừa xử lý tự nổi lên đầu mà KHÔNG cần ghi đè
          // ngay_import gốc (giữ đúng ý nghĩa "thời điểm import từ file").
          QuanLyHD.aggregate([
            { $match: filter },
            {
              $addFields: {
                _sortDate: { $ifNull: ["$ngay_xu_ly", "$ngay_import"] },
              },
            },
            { $sort: { _sortDate: sortDir } },
            { $skip: skip },
            { $limit: limit },
            { $project: { _sortDate: 0 } },
          ]).option({ allowDiskUse: true }) // [PERF] phòng khi tập kết quả lớn phải sort ngoài RAM
        : QuanLyHD.find(filter)
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit)
            .lean(),
    ]);

    return res.status(200).json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách QuanLyHD:", err);
    return res
      .status(500)
      .json({ message: "Lấy danh sách thất bại", error: err.message });
  }
};

/**
 * POST /quanlyhd/import
 * multipart/form-data với 2 field file: "file_wms" và "file_hd"
 */
exports.importQuanLyHD = async (req, res) => {
  const fileWms = req.files?.file_wms?.[0];
  const fileHd = req.files?.file_hd?.[0];

  if (!fileWms || !fileHd) {
    return res
      .status(400)
      .json({ message: "Cần upload đủ 2 file: file_wms và file_hd" });
  }

  const stats = {
    wms: {
      totalRows: 0,
      invalidRows: 0,
      upserted: 0,
      modified: 0,
      matched: 0,
      errors: [],
      skippedDetails: [], // chi tiết các dòng bị bỏ qua (thiếu ma_ch/sku/so_phieu_wms), kèm số dòng Excel
      errorDetails: [], // chi tiết các dòng bị lỗi khi ghi DB (VD trùng khóa)
    },
    hd: {
      totalRows: 0,
      invalidRows: 0,
      resolvedByName: 0,
      modified: 0,
      matched: 0,
      unmatchedRows: 0, // số dòng HĐ không tìm thấy phiếu WMS tương ứng (chưa import WMS / so_phieu không khớp)
      noDataWmsCreated: 0, // số document mới tạo với trạng thái "No Data WMS"
      errors: [],
      skippedDetails: [], // chi tiết các dòng bị bỏ qua TRƯỚC khi ghi (thiếu ma_ch/sku/so_phieu_hd)
      unmatchedDetails: [], // chi tiết các dòng KHÔNG khớp được với phiếu WMS nào (-> lưu "No Data WMS")
      errorDetails: [], // chi tiết các dòng bị lỗi khi ghi DB
    },
  };

  const startTime = Date.now();

  // Bảng tra "tên cửa hàng đã chuẩn hoá -> mã cửa hàng thật", dựng từ dữ liệu WMS,
  // dùng để tra mã cho các dòng Hóa Đơn không tách được mã từ text (VD "Co.opMart Van Thanh").
  const storeNameMap = new Map();
  // Bảng tra "sku -> tên hàng", dựng từ dữ liệu WMS, dùng để điền tạm tên hàng cho các dòng
  // HĐ không tìm thấy phiếu WMS tương ứng (trạng thái "No Data WMS") vì file HĐ không có cột tên hàng.
  const skuNameMap = new Map();

  // LƯU Ý: HD phải xử lý SAU khi WMS xử lý xong hoàn toàn (không thể chạy song song 2 file)
  // vì storeNameMap/skuNameMap cần đầy đủ dữ liệu WMS trước khi HD tra cứu.
  try {
    await processFile(
      fileWms.path,
      HEADER_MAP_WMS,
      (raw) => finalizeWmsDoc(raw, storeNameMap, skuNameMap),
      ["ma_ch", "sku", "so_phieu_wms"],
      upsertWmsBatch,
      stats.wms,
    );
    await processFile(
      fileHd.path,
      HEADER_MAP_HD,
      (raw) => {
        const doc = finalizeHdDoc(raw, storeNameMap);
        if (doc._resolvedByName) stats.hd.resolvedByName += 1;
        return doc;
      },
      ["ma_ch", "sku", "so_phieu_hd"],
      (batch, s) => upsertHdBatch(batch, s, skuNameMap),
      stats.hd,
    );

    fs.unlink(fileWms.path, () => {});
    fs.unlink(fileHd.path, () => {});

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    return res.status(200).json({
      message: "Import & đối chiếu hoàn tất",
      durationSeconds: durationSec,
      wms: stats.wms,
      hd: stats.hd,
    });
  } catch (err) {
    fs.unlink(fileWms.path, () => {});
    fs.unlink(fileHd.path, () => {});
    console.error("Lỗi import/đối chiếu QuanLyHD:", err);
    return res.status(500).json({
      message: "Import thất bại",
      error: err.message,
      partialStats: stats,
    });
  }
};

/**
 * PATCH /quanlyhd/:id/xac-nhan-hoan-thanh
 * Xác nhận thủ công 1 dòng "Không khớp lượng" -> "Đã xử lý".
 * Ghi nhận ngay_xu_ly (thời điểm xử lý tay), KHÔNG đụng vào ngay_import
 * (ngay_import giữ nguyên ý nghĩa gốc: thời điểm dữ liệu được import từ file).
 * [PERF] Dùng findOneAndUpdate ATOMIC (1 round-trip, có điều kiện lọc trangThai ngay trong
 * query) thay vì find() rồi save() (2 round-trip + có thể dính race condition nếu 2 người
 * cùng bấm xác nhận 1 dòng cùng lúc).
 */
exports.xacNhanHoanThanh = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await QuanLyHD.findOneAndUpdate(
      { _id: id, trangThai: "Không khớp lượng" },
      { $set: { trangThai: "Đã xử lý", ngay_xu_ly: new Date() } },
      { new: true },
    );

    if (!item) {
      // Không tìm thấy có thể do: sai id, hoặc trangThai không còn là "Không khớp lượng"
      // (VD người khác vừa xác nhận trước đó) -> phân biệt rõ 2 case để trả message đúng
      const exists = await QuanLyHD.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ message: "Không tìm thấy bản ghi" });
      }
      return res.status(400).json({
        message:
          "Chỉ có thể xác nhận hoàn thành cho bản ghi đang ở trạng thái Không khớp lượng",
      });
    }

    return res.status(200).json({
      message: "Xác nhận hoàn thành thành công",
      data: item,
    });
  } catch (err) {
    console.error("Lỗi xác nhận hoàn thành QuanLyHD:", err);
    return res
      .status(500)
      .json({ message: "Xác nhận thất bại", error: err.message });
  }
};
