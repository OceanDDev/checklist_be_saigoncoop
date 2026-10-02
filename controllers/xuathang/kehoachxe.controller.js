const mongoose = require("mongoose");
const KeHoachXe = require("../../models/xuathang/kehoachxe"); // sửa lại đường dẫn cho đúng

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Cột text -> lọc gần đúng (regex, không phân biệt hoa thường)
const TEXT_FIELDS = [
  "ten_ke_hoach",
  "ghi_chu_ke_hoach",
  "thoi_gian_xe_vao_kho_dau_yeu_cau",
  "ma_kho",
  "ma_sieu_thi",
  "ti_le",
  "ma_nvc",
  "ma_loai_hang",
  "ma_loai_xe",
  "hinh_thuc_giao_nhan",
  "ghi_chu_booking",
];

// Cột số -> lọc bằng đúng giá trị
const NUMBER_FIELDS = [
  "trong_tai_nho_nhat",
  "trong_tai_lon_nhat",
  "tong_khoi_luong_hang",
  "so_luong_xe",
];

// "YYYY-MM-DD" của cột ngày xe vào kho: dữ liệu ghim UTC 00:00 -> so sánh theo UTC
const utcDayStart = (s) => new Date(`${s}T00:00:00.000Z`);
const utcDayEnd = (s) => new Date(`${s}T23:59:59.999Z`);

// "YYYY-MM-DD" của cột ngày import: là thời điểm thật -> tính theo giờ VN (+07:00)
const vnDayStart = (s) => new Date(`${s}T00:00:00.000+07:00`);
const vnDayEnd = (s) => new Date(`${s}T23:59:59.999+07:00`);

const buildDateRange = (from, to, startFn, endFn) => {
  const range = {};
  if (from) range.$gte = startFn(from);
  if (to) range.$lte = endFn(to);
  return Object.keys(range).length ? range : null;
};

// ============ LẤY DANH SÁCH (phân trang + lọc theo từng cột) ============
// GET /kehoachxe?page=1&limit=20
//   &<field>=...                         (text: regex, number: bằng)
//   &tu_ngay=YYYY-MM-DD&den_ngay=...     (ngày xe vào kho đầu)
//   &tu_ngay_import=...&den_ngay_import=... (ngày import)
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = {};

    TEXT_FIELDS.forEach((f) => {
      const v = req.query[f];
      if (v !== undefined && String(v).trim() !== "") {
        filter[f] = new RegExp(escapeRegex(v), "i");
      }
    });

    NUMBER_FIELDS.forEach((f) => {
      const v = req.query[f];
      if (v !== undefined && String(v).trim() !== "") {
        const n = Number(String(v).replace(",", "."));
        if (!Number.isNaN(n)) filter[f] = n;
      }
    });

    const ngayRange = buildDateRange(
      req.query.tu_ngay,
      req.query.den_ngay,
      utcDayStart,
      utcDayEnd
    );
    if (ngayRange) filter.ngay_xe_vao_kho_dau_yeu_cau = ngayRange;

    const importRange = buildDateRange(
      req.query.tu_ngay_import,
      req.query.den_ngay_import,
      vnDayStart,
      vnDayEnd
    );
    if (importRange) filter.ngay_import = importRange;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 1000);

    const [data, total] = await Promise.all([
      KeHoachXe.find(filter)
        .sort({ ngay_xe_vao_kho_dau_yeu_cau: -1, thoi_gian_xe_vao_kho_dau_yeu_cau: 1, _id: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      KeHoachXe.countDocuments(filter),
    ]);

    // total / totalPages ở top-level để khớp cách frontend xuathang đang đọc
    return res.json({
      success: true,
      data,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (error) {
    console.error("getAll error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============ LẤY THEO ID ============
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }
    const doc = await KeHoachXe.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kế hoạch xe" });
    }
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error("getById error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============ TẠO 1 ============
exports.create = async (req, res) => {
  try {
    const doc = await KeHoachXe.create({
      ...req.body,
      ngay_import: req.body.ngay_import || new Date(),
    });
    return res.status(201).json({ success: true, message: "Đã tạo kế hoạch xe", data: doc });
  } catch (error) {
    console.error("create error:", error);
    const status = error.name === "ValidationError" ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ============ SỬA ============
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }
    const doc = await KeHoachXe.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!doc) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kế hoạch xe" });
    }
    return res.json({ success: true, message: "Đã cập nhật kế hoạch xe", data: doc });
  } catch (error) {
    console.error("update error:", error);
    const status = error.name === "ValidationError" ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

// ============ XÓA 1 ============
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }
    const doc = await KeHoachXe.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kế hoạch xe" });
    }
    return res.json({ success: true, message: "Đã xóa kế hoạch xe" });
  } catch (error) {
    console.error("remove error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============ IMPORT NHIỀU (UPSERT) ============
// POST /kehoachxe/import-many
// Body: { "data": [ {...}, ... ] }
// Khóa upsert: (ten_ke_hoach + ghi_chu_ke_hoach) -> import lại cùng file
// sẽ cập nhật thay vì tạo trùng.
exports.importMany = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu phải là mảng và không được rỗng" });
    }

    const now = new Date();
    const ops = data.map((item) => {
      const doc = { ...item, ngay_import: now };
      if (item.ten_ke_hoach && item.ghi_chu_ke_hoach) {
        return {
          updateOne: {
            filter: {
              ten_ke_hoach: item.ten_ke_hoach,
              ghi_chu_ke_hoach: item.ghi_chu_ke_hoach,
            },
            update: { $set: doc },
            upsert: true,
          },
        };
      }
      return { insertOne: { document: doc } };
    });

    const r = await KeHoachXe.bulkWrite(ops, { ordered: false });
    const created = (r.upsertedCount || 0) + (r.insertedCount || 0);
    const updated = r.modifiedCount || 0;

    return res.json({
      success: true,
      message: `Import xong ${data.length} dòng: thêm mới ${created}, cập nhật ${updated}`,
      created,
      updated,
    });
  } catch (error) {
    console.error("importMany error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============ THÊM NHIỀU (chỉ insert, không upsert) ============
exports.addMany = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu phải là mảng và không được rỗng" });
    }

    const now = new Date();
    const docs = data.map((item) => ({ ...item, ngay_import: item.ngay_import || now }));
    const result = await KeHoachXe.insertMany(docs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `Đã thêm ${result.length} kế hoạch xe`,
      inserted: result.length,
    });
  } catch (error) {
    if (error.name === "MongoBulkWriteError" || error.writeErrors) {
      return res.status(207).json({
        success: false,
        message: "Một số dòng không thêm được",
        inserted: error.result?.insertedCount ?? error.insertedDocs?.length ?? 0,
        errors: (error.writeErrors || []).map((e) => e.errmsg || e.err?.errmsg),
      });
    }
    console.error("addMany error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============ XÓA NHIỀU ============
// Body: { "ids": [...] } hoặc { "ngay_import_from": "...", "ngay_import_to": "..." }
exports.deleteMany = async (req, res) => {
  try {
    const { ids, ngay_import_from, ngay_import_to } = req.body;
    const filter = {};

    if (Array.isArray(ids) && ids.length > 0) {
      const invalid = ids.filter((id) => !isValidId(id));
      if (invalid.length > 0) {
        return res.status(400).json({ success: false, message: "Có id không hợp lệ", invalid });
      }
      filter._id = { $in: ids };
    } else if (ngay_import_from || ngay_import_to) {
      const range = buildDateRange(ngay_import_from, ngay_import_to, vnDayStart, vnDayEnd);
      filter.ngay_import = range;
    } else {
      return res.status(400).json({
        success: false,
        message: "Cần truyền ids hoặc khoảng ngay_import để xóa",
      });
    }

    const result = await KeHoachXe.deleteMany(filter);
    return res.json({
      success: true,
      message: `Đã xóa ${result.deletedCount} kế hoạch xe`,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error("deleteMany error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};