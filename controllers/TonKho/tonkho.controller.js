// controllers/move/khuyenmai.controller.js
const mongoose = require("mongoose");
const TonKho = require("../../models/tonkho/tonkho");
const { parseExcelTonKho, parseTxtMms } = require("../../utils/tonkhoParser");

// Thứ tự ưu tiên khi sort theo trạng thái — lệch/thiếu data lên đầu để
// người dùng xử lý trước, "Khớp" (ổn) xuống cuối.
const TRANG_THAI_PRIORITY = {
  "Không Khớp": 0,
  "Không có DATA": 1,
  Khớp: 2,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const REQUIRED_FIELDS = [
  "slot",
  "sku",
  "name",
  "lpn",
  "luong_onhand",
  "luong_mms",
];

// Chuẩn hoá 1 dòng dữ liệu đầu vào (từ excel/import) về đúng shape schema.
// Trả về { ok, data, error } — error khác null nếu thiếu field bắt buộc.
const normalizeRow = (row) => {
  const data = {
    slot: (row.slot ?? "").toString().trim(),
    sku: (row.sku ?? "").toString().trim(),
    name: (row.name ?? "").toString().trim(),
    lpn: (row.lpn ?? "").toString().trim(),
    luong_onhand: (row.luong_onhand ?? "").toString().trim(),
    luong_mms: (row.luong_mms ?? "").toString().trim(),
    cost: (row.cost ?? "").toString().trim(),
    thanh_tien: (row.thanh_tien ?? "").toString().trim(),
    kho: (row.kho ?? "").toString().trim(),
    thoi_gian_impport: row.thoi_gian_impport
      ? new Date(row.thoi_gian_impport)
      : new Date(),
  };

  const missing = REQUIRED_FIELDS.filter((f) => !data[f]);
  if (missing.length > 0) {
    return { ok: false, data, error: `Thiếu field: ${missing.join(", ")}` };
  }
  return { ok: true, data, error: null };
};

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sku,
      lpn,
      slot,
      trangThai,
      kho,
      tuNgay,
      denNgay,
      sortByTrangThai = "true",
      sortBy,
      sortOrder = "asc",
      excludeZero,
    } = req.query;

    const filter = {};
    if (sku) filter.sku = { $regex: sku, $options: "i" };
    if (lpn) filter.lpn = { $regex: lpn, $options: "i" };
    if (slot) filter.slot = { $regex: slot, $options: "i" };
    if (trangThai) filter.trangThai = trangThai;
    if (kho) filter.kho = kho;

    if (tuNgay || denNgay) {
      filter.thoi_gian_impport = {};
      if (tuNgay) filter.thoi_gian_impport.$gte = new Date(tuNgay);
      if (denNgay) {
        const end = new Date(denNgay);
        end.setHours(23, 59, 59, 999);
        filter.thoi_gian_impport.$lte = end;
      }
    }

    if (excludeZero === "true" || excludeZero === true) {
      filter.$expr = {
        $not: {
          $and: [
            {
              $eq: [
                {
                  $convert: {
                    input: "$luong_onhand",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                0,
              ],
            },
            {
              $eq: [
                {
                  $convert: {
                    input: "$luong_mms",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                0,
              ],
            },
          ],
        },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 20);

    const ALLOWED_SORT_FIELDS = [
      "slot",
      "sku",
      "name",
      "lpn",
      "thoi_gian_impport",
    ];
    if (sortBy && ALLOWED_SORT_FIELDS.includes(sortBy)) {
      const order = sortOrder === "desc" ? -1 : 1;

      const [data, total] = await Promise.all([
        TonKho.find(filter)
          .collation({ locale: "vi", strength: 1 })
          .sort({ [sortBy]: order })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        TonKho.countDocuments(filter),
      ]);

      return res
        .status(200)
        .json({ data, total, page: pageNum, limit: limitNum });
    }

    if (sortByTrangThai === "true" || sortByTrangThai === true) {
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            _trangThaiPriority: {
              $switch: {
                branches: [
                  { case: { $eq: ["$trangThai", "Không Khớp"] }, then: 0 },
                  { case: { $eq: ["$trangThai", "Không có DATA"] }, then: 1 },
                  { case: { $eq: ["$trangThai", "Khớp"] }, then: 2 },
                ],
                default: 3,
              },
            },
          },
        },
        { $sort: { _trangThaiPriority: 1, sku: 1 } },
        {
          $facet: {
            data: [
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
              { $project: { _trangThaiPriority: 0 } },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const [result] = await TonKho.aggregate(pipeline);
      const data = result?.data || [];
      const total = result?.totalCount?.[0]?.count || 0;

      return res
        .status(200)
        .json({ data, total, page: pageNum, limit: limitNum });
    }

    const [data, total] = await Promise.all([
      TonKho.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      TonKho.countDocuments(filter),
    ]);

    return res
      .status(200)
      .json({ data, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error("Lỗi getAll TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách." });
  }
};

/* ------------------------------------------------------------------ */
/* GET /khuyenmai/:id                                                  */
/* ------------------------------------------------------------------ */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }

    const item = await TonKho.findById(id).lean();
    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ data: item });
  } catch (err) {
    console.error("Lỗi getById TonKho:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
};

/* ------------------------------------------------------------------ */
/* POST /khuyenmai — tạo 1 bản ghi                                     */
/* ------------------------------------------------------------------ */
exports.create = async (req, res) => {
  try {
    const { ok, data, error } = normalizeRow(req.body || {});
    if (!ok) return res.status(400).json({ message: error });

    const created = await TonKho.create(data);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error("Lỗi create TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi tạo bản ghi." });
  }
};

/* ------------------------------------------------------------------ */
/* PUT /khuyenmai/:id — cập nhật 1 bản ghi                             */
/* ------------------------------------------------------------------ */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }

    const updated = await TonKho.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error("Lỗi update TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật." });
  }
};

/* ------------------------------------------------------------------ */
/* So khớp số lượng: sai lệch nhỏ do làm tròn (< 0.01) vẫn tính Khớp   */
/* ------------------------------------------------------------------ */
const numbersMatch = (a, b) => Math.abs(a - b) < 0.01;

// thanh_tien = luong onhand (dòng chi tiết) * cost. Để trống nếu không
// có cost hợp lệ.
const tinhThanhTien = (luongOnhand, costNumber) => {
  if (costNumber === undefined || costNumber === null) return "";
  if (Number.isNaN(costNumber)) return "";
  return (luongOnhand * costNumber).toString();
};

/* ------------------------------------------------------------------ */
/* Xử lý so khớp 1 CẶP file (excel tồn kho + txt MMS) cho 1 kho cụ    */
/* thể. Trả về { docs, stats } hoặc throw Error nếu file txt không    */
/* đúng kho mong đợi (validate theo header "Store <số>: ...").         */
/* ------------------------------------------------------------------ */
const matchKhoPair = ({ excelBuffer, txtBuffer, expectedKho, now }) => {
  const excelRows = parseExcelTonKho(excelBuffer);
  const { kho: actualKho, tenKho, map: txtMap } = parseTxtMms(txtBuffer);

  if (excelRows.length === 0) {
    throw Object.assign(
      new Error(`File Excel tồn kho (kho ${expectedKho}) không đọc được dữ liệu.`),
      { status: 400 },
    );
  }

  if (!actualKho) {
    throw Object.assign(
      new Error(
        `Không tìm thấy dòng "Store ...: ..." trong file txt MMS (kho ${expectedKho}). File có đúng định dạng báo cáo MMS không?`,
      ),
      { status: 400 },
    );
  }

  if (actualKho !== expectedKho.toString()) {
    throw Object.assign(
      new Error(
        `File txt MMS bạn upload cho kho ${expectedKho} lại là dữ liệu của kho ${actualKho} (${tenKho}). Vui lòng kiểm tra lại file.`,
      ),
      { status: 400 },
    );
  }

  // ─── Cộng dồn luong_onhand theo SKU (gộp mọi slot/LPN) ─────────────
  const onhandBySku = new Map();
  excelRows.forEach((row) => {
    onhandBySku.set(
      row.sku,
      (onhandBySku.get(row.sku) || 0) + row.luong_onhand,
    );
  });

  const resolveTrangThai = (sku) => {
    const mmsEntry = txtMap.get(sku);
    if (!mmsEntry) {
      return { trangThai: "Không có DATA", luong_mms: "", cost: undefined };
    }
    const tongOnhand = onhandBySku.get(sku) || 0;
    const khop = numbersMatch(tongOnhand, mmsEntry.luong_mms);
    return {
      trangThai: khop ? "Khớp" : "Không Khớp",
      luong_mms: mmsEntry.luong_mms.toString(),
      cost: mmsEntry.cost,
    };
  };

  const docs = [];

  // ─── Dòng chi tiết từ excel ─────────────────────────────────────────
  excelRows.forEach((row) => {
    const { trangThai, luong_mms, cost } = resolveTrangThai(row.sku);
    docs.push({
      slot: row.slot,
      sku: row.sku,
      name: row.name,
      lpn: row.lpn,
      luong_onhand: row.luong_onhand.toString(),
      luong_mms,
      cost: cost !== undefined ? cost.toString() : "",
      thanh_tien: tinhThanhTien(row.luong_onhand, cost),
      kho: expectedKho,
      trangThai,
      thoi_gian_impport: now,
    });
  });

  // ─── SKU chỉ có ở file txt (MMS) mà excel không có ─────────────────
  let soSkuChiCoOTxt = 0;
  txtMap.forEach((entry, sku) => {
    if (!onhandBySku.has(sku)) {
      soSkuChiCoOTxt += 1;
      docs.push({
        slot: "",
        sku,
        name: entry.name,
        lpn: "",
        luong_onhand: "0",
        luong_mms: entry.luong_mms.toString(),
        cost: entry.cost !== undefined ? entry.cost.toString() : "",
        thanh_tien: tinhThanhTien(0, entry.cost),
        kho: expectedKho,
        trangThai: "Không có DATA",
        thoi_gian_impport: now,
      });
    }
  });

  // ─── Thống kê theo SKU (không tính theo dòng chi tiết) ─────────────
  let khop = 0;
  let khongKhop = 0;
  let khongCoData = 0;
  const allSkus = new Set([...onhandBySku.keys(), ...txtMap.keys()]);
  allSkus.forEach((sku) => {
    const { trangThai } = resolveTrangThai(sku);
    if (trangThai === "Khớp") khop += 1;
    else if (trangThai === "Không Khớp") khongKhop += 1;
    else khongCoData += 1;
  });

  return {
    docs,
    stats: {
      kho: expectedKho,
      tenKho,
      tongSoDongChiTiet: docs.length,
      tongSoSku: allSkus.size,
      soSkuTrongExcel: onhandBySku.size,
      soSkuTrongTxt: txtMap.size,
      soSkuChiCoOTxt,
      thongKe: { khop, khongKhop, khongCoData },
    },
  };
};

/* ------------------------------------------------------------------ */
/* POST /khuyenmai/match-import — nhận 4 file (2 kho: 810 và 8101),    */
/* mỗi kho gồm 1 file excel tồn kho + 1 file txt MMS.                  */
/* multipart/form-data, field name:                                    */
/*   excel810, txt810, excel8101, txt8101                              */
/*                                                                      */
/* Logic:                                                              */
/*  1. Với MỖI kho (810, 8101): parse cặp excel+txt riêng, validate    */
/*     header "Store <số>: ..." của file txt phải khớp đúng kho đang   */
/*     import (vd file txt cho ô "8101" mà header lại là "Store 810"   */
/*     -> báo lỗi 400, KHÔNG import).                                  */
/*  2. So khớp luong_onhand (excel) vs luong_mms (txt) theo từng SKU,  */
/*     lấy cost (Unit Cost) từ txt, tính thanh_tien = luong_onhand *   */
/*     cost cho từng dòng chi tiết. Gắn kho tương ứng cho mọi dòng.    */
/*  3. Gộp document của cả 2 kho, ghi đè TOÀN BỘ collection (ảnh chụp  */
/*     tồn kho mới nhất tại thời điểm import, không cộng dồn qua các   */
/*     lần import trước).                                              */
/* ------------------------------------------------------------------ */
exports.matchImport = async (req, res) => {
  try {
    const excel810 = req.files?.excel810?.[0];
    const txt810 = req.files?.txt810?.[0];
    const excel8101 = req.files?.excel8101?.[0];
    const txt8101 = req.files?.txt8101?.[0];

    const missingFiles = [];
    if (!excel810) missingFiles.push("excel810");
    if (!txt810) missingFiles.push("txt810");
    if (!excel8101) missingFiles.push("excel8101");
    if (!txt8101) missingFiles.push("txt8101");

    if (missingFiles.length > 0) {
      return res.status(400).json({
        message: `Cần upload đủ 4 file. Còn thiếu: ${missingFiles.join(", ")}.`,
      });
    }

    const now = new Date();

    let result810;
    let result8101;
    try {
      result810 = matchKhoPair({
        excelBuffer: excel810.buffer,
        txtBuffer: txt810.buffer,
        expectedKho: "810",
        now,
      });
      result8101 = matchKhoPair({
        excelBuffer: excel8101.buffer,
        txtBuffer: txt8101.buffer,
        expectedKho: "8101",
        now,
      });
    } catch (validationErr) {
      const status = validationErr.status || 400;
      return res.status(status).json({ message: validationErr.message });
    }

    const allDocs = [...result810.docs, ...result8101.docs];

    // ─── Ghi đè toàn bộ collection (ảnh chụp mới, cả 2 kho) ────────────
    await TonKho.deleteMany({});
    await TonKho.insertMany(allDocs, { ordered: false });

    return res.status(200).json({
      message: "Import & so khớp hoàn tất cho cả 2 kho.",
      tongSoDongChiTiet: allDocs.length,
      theoKho: {
        "810": result810.stats,
        "8101": result8101.stats,
      },
    });
  } catch (err) {
    console.error("Lỗi matchImport TonKho:", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi import & so khớp dữ liệu." });
  }
};

/* ------------------------------------------------------------------ */
/* POST /khuyenmai/import — import nhiều dòng cùng lúc (từ Excel)      */
/* Body: { items: [ {...}, {...}, ... ] }                              */
/* Upsert theo cặp (lpn, sku): nếu đã tồn tại -> cập nhật số lượng /   */
/* thời gian import; chưa có -> tạo mới. Dòng thiếu field bắt buộc sẽ  */
/* bị bỏ qua và trả về trong `skipped`.                                */
/* ------------------------------------------------------------------ */
exports.importMany = async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách items rỗng hoặc không hợp lệ." });
    }

    const skipped = [];
    const bulkOps = [];

    items.forEach((row, idx) => {
      const { ok, data, error } = normalizeRow(row);
      if (!ok) {
        skipped.push({
          index: idx,
          lpn: row?.lpn,
          sku: row?.sku,
          reason: error,
        });
        return;
      }

      bulkOps.push({
        updateOne: {
          filter: { lpn: data.lpn, sku: data.sku },
          update: { $set: data },
          upsert: true,
        },
      });
    });

    if (bulkOps.length === 0) {
      return res.status(400).json({
        message: "Không có dòng nào hợp lệ để import.",
        skipped,
      });
    }

    const result = await TonKho.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({
      message: "Import hoàn tất.",
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      skipped,
      totalReceived: items.length,
    });
  } catch (err) {
    console.error("Lỗi importMany TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi import." });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /khuyenmai — xoá nhiều theo danh sách id                     */
/* Body: { ids: ["...", "...", ...] }                                  */
/* ------------------------------------------------------------------ */
exports.deleteMany = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách ids rỗng hoặc không hợp lệ." });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const invalidCount = ids.length - validIds.length;

    if (validIds.length === 0) {
      return res.status(400).json({ message: "Không có ID hợp lệ nào." });
    }

    const result = await TonKho.deleteMany({ _id: { $in: validIds } });

    return res.status(200).json({
      message: "Xoá thành công.",
      deletedCount: result.deletedCount || 0,
      invalidCount,
    });
  } catch (err) {
    console.error("Lỗi deleteMany TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi xoá." });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /khuyenmai/:id — xoá 1 bản ghi (tiện dùng lẻ nếu cần)        */
/* ------------------------------------------------------------------ */
exports.deleteOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }

    const deleted = await TonKho.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ message: "Xoá thành công.", data: deleted });
  } catch (err) {
    console.error("Lỗi deleteOne TonKho:", err);
    return res.status(500).json({ message: "Lỗi server khi xoá." });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const result = await TonKho.deleteMany({});
    return res.status(200).json({
      message: "Đã xoá toàn bộ dữ liệu.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    console.error("Lỗi deleteAll TonKho:", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xoá toàn bộ dữ liệu." });
  }
};