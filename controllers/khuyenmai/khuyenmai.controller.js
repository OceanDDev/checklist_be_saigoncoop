// controllers/move/khuyenmai.controller.js
const mongoose = require("mongoose");
const KhuyenMai = require("../../models/khuyenmai/khuyenmai");
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
  "luong_available",
  "luong_allocate",
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
    luong_available: (row.luong_available ?? "").toString().trim(),
    luong_allocate: (row.luong_allocate ?? "").toString().trim(),
    luong_mms: (row.luong_mms ?? "").toString().trim(),
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
      tuNgay,
      denNgay,
      sortByTrangThai = "true",
      sortBy,
      sortOrder = "asc",
      // ✅ MỚI: bỏ qua bản ghi mà CẢ HAI luong_onhand và luong_mms đều = 0
      excludeZero,
    } = req.query;

    const filter = {};
    if (sku) filter.sku = { $regex: sku, $options: "i" };
    if (lpn) filter.lpn = { $regex: lpn, $options: "i" };
    if (slot) filter.slot = { $regex: slot, $options: "i" };
    if (trangThai) filter.trangThai = trangThai;

    if (tuNgay || denNgay) {
      filter.thoi_gian_impport = {};
      if (tuNgay) filter.thoi_gian_impport.$gte = new Date(tuNgay);
      if (denNgay) {
        const end = new Date(denNgay);
        end.setHours(23, 59, 59, 999);
        filter.thoi_gian_impport.$lte = end;
      }
    }

    // ✅ MỚI: excludeZero=true -> loại các dòng mà cả onhand & mms đều = 0
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
        KhuyenMai.find(filter)
          .collation({ locale: "vi", strength: 1 })
          .sort({ [sortBy]: order })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        KhuyenMai.countDocuments(filter),
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

      const [result] = await KhuyenMai.aggregate(pipeline);
      const data = result?.data || [];
      const total = result?.totalCount?.[0]?.count || 0;

      return res
        .status(200)
        .json({ data, total, page: pageNum, limit: limitNum });
    }

    const [data, total] = await Promise.all([
      KhuyenMai.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      KhuyenMai.countDocuments(filter),
    ]);

    return res
      .status(200)
      .json({ data, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error("Lỗi getAll KhuyenMai:", err);
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

    const item = await KhuyenMai.findById(id).lean();
    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ data: item });
  } catch (err) {
    console.error("Lỗi getById KhuyenMai:", err);
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

    const created = await KhuyenMai.create(data);
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error("Lỗi create KhuyenMai:", err);
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

    const updated = await KhuyenMai.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error("Lỗi update KhuyenMai:", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật." });
  }
};

/* ------------------------------------------------------------------ */
/* So khớp số lượng: sai lệch nhỏ do làm tròn (< 0.01) vẫn tính Khớp   */
/* ------------------------------------------------------------------ */
const numbersMatch = (a, b) => Math.abs(a - b) < 0.01;

/* ------------------------------------------------------------------ */
/* POST /khuyenmai/match-import — nhận 2 file (excel tồn kho + txt MMS)*/
/* multipart/form-data, field name: "excelFile" và "txtFile".          */
/*                                                                      */
/* Logic:                                                              */
/*  1. Parse excel -> danh sách chi tiết theo từng slot/LPN.           */
/*  2. Parse txt   -> map sku -> { name, luong_mms } (từ MMS).         */
/*  3. Cộng dồn luong_onhand theo SKU (gộp mọi slot/LPN của SKU đó).   */
/*  4. Với mỗi SKU có trong excel: so khớp tổng luong_onhand vs        */
/*     luong_mms (nếu txt có SKU đó) -> gắn trangThai cho MỌI dòng chi */
/*     tiết (slot/LPN) của SKU đó (denormalize để hiển thị bảng dễ).   */
/*  5. Với SKU chỉ có trong txt (không có trong excel) -> tạo 1 dòng   */
/*     riêng, không có slot/lpn, trangThai = "Không có DATA".          */
/*  6. Ghi đè toàn bộ collection bằng dữ liệu mới (đây là ảnh chụp tồn */
/*     kho tại thời điểm import, không cộng dồn qua các lần import).   */
/* ------------------------------------------------------------------ */
exports.matchImport = async (req, res) => {
  try {
    const excelFile = req.files?.excelFile?.[0];
    const txtFile = req.files?.txtFile?.[0];

    if (!excelFile || !txtFile) {
      return res.status(400).json({
        message: "Cần upload đủ 2 file: excelFile (tồn kho) và txtFile (MMS).",
      });
    }

    const excelRows = parseExcelTonKho(excelFile.buffer);
    const txtMap = parseTxtMms(txtFile.buffer);

    if (excelRows.length === 0) {
      return res
        .status(400)
        .json({ message: "Không đọc được dữ liệu từ file Excel." });
    }

    // ─── Bước 1: cộng dồn luong_onhand theo SKU (gộp mọi slot/LPN) ────
    const onhandBySku = new Map();
    excelRows.forEach((row) => {
      onhandBySku.set(
        row.sku,
        (onhandBySku.get(row.sku) || 0) + row.luong_onhand,
      );
    });

    // ─── Bước 2: xác định trangThai + luong_mms cho từng SKU ──────────
    const resolveTrangThai = (sku) => {
      const mmsEntry = txtMap.get(sku);
      if (!mmsEntry) {
        return { trangThai: "Không có DATA", luong_mms: "" };
      }
      const tongOnhand = onhandBySku.get(sku) || 0;
      const khop = numbersMatch(tongOnhand, mmsEntry.luong_mms);
      return {
        trangThai: khop ? "Khớp" : "Không Khớp",
        luong_mms: mmsEntry.luong_mms.toString(),
      };
    };

    const now = new Date();
    const docsToInsert = [];

    // ─── Bước 3: build document cho từng dòng chi tiết từ excel ───────
    excelRows.forEach((row) => {
      const { trangThai, luong_mms } = resolveTrangThai(row.sku);
      docsToInsert.push({
        slot: row.slot,
        sku: row.sku,
        name: row.name,
        lpn: row.lpn,
        luong_onhand: row.luong_onhand.toString(),
        luong_available: row.luong_available.toString(),
        luong_allocate: row.luong_allocate.toString(),
        luong_mms,
        trangThai,
        thoi_gian_impport: now,
      });
    });

    // ─── Bước 4: SKU chỉ có ở file txt (MMS) mà excel không có ────────
    const skuKhongCoOExcel = [];
    txtMap.forEach((entry, sku) => {
      if (!onhandBySku.has(sku)) {
        skuKhongCoOExcel.push(sku);
        docsToInsert.push({
          slot: "",
          sku,
          name: entry.name,
          lpn: "",
          luong_onhand: "0",
          luong_available: "0",
          luong_allocate: "0",
          luong_mms: entry.luong_mms.toString(),
          trangThai: "Không có DATA",
          thoi_gian_impport: now,
        });
      }
    });

    // ─── Bước 5: ghi đè toàn bộ collection (ảnh chụp mới) ──────────────
    await KhuyenMai.deleteMany({});
    await KhuyenMai.insertMany(docsToInsert, { ordered: false });

    // ─── Tổng hợp thống kê theo SKU (không tính theo dòng chi tiết) ───
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

    return res.status(200).json({
      message: "Import & so khớp hoàn tất.",
      tongSoDongChiTiet: docsToInsert.length,
      tongSoSku: allSkus.size,
      soSkuTrongExcel: onhandBySku.size,
      soSkuTrongTxt: txtMap.size,
      soSkuChiCoOTxt: skuKhongCoOExcel.length,
      thongKe: { khop, khongKhop, khongCoData },
    });
  } catch (err) {
    console.error("Lỗi matchImport KhuyenMai:", err);
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

    const result = await KhuyenMai.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({
      message: "Import hoàn tất.",
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      skipped,
      totalReceived: items.length,
    });
  } catch (err) {
    console.error("Lỗi importMany KhuyenMai:", err);
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

    const result = await KhuyenMai.deleteMany({ _id: { $in: validIds } });

    return res.status(200).json({
      message: "Xoá thành công.",
      deletedCount: result.deletedCount || 0,
      invalidCount,
    });
  } catch (err) {
    console.error("Lỗi deleteMany KhuyenMai:", err);
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

    const deleted = await KhuyenMai.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }
    return res.status(200).json({ message: "Xoá thành công.", data: deleted });
  } catch (err) {
    console.error("Lỗi deleteOne KhuyenMai:", err);
    return res.status(500).json({ message: "Lỗi server khi xoá." });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const result = await KhuyenMai.deleteMany({});
    return res.status(200).json({
      message: "Đã xoá toàn bộ dữ liệu.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    console.error("Lỗi deleteAll KhuyenMai:", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xoá toàn bộ dữ liệu." });
  }
};
