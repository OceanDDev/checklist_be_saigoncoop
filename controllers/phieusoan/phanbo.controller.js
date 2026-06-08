const PhanBo = require("../../models/phieusoan/phanbo");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAllPhanBo = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      sku = "",
      sd_tf = "",
      name = "",
      pack = "",
      mach = "",
      tench = "",
      ten_phan_bo = "",
      trang_thai = "",
      startDate = "",
      endDate = "",
        startNgayXuLi = "",   // ← thêm
      endNgayXuLi = "",     // ← thêm
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(9999, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Dùng mảng conditions rồi gộp $and — tránh conflict key
    const conditions = [];

    // ── Search tổng ──────────────────────────────────────────────────
    if (search) {
      const safeSearch = escapeRegex(search);
      const regex = { $regex: safeSearch, $options: "i" };
      conditions.push({
        $or: [
          { ten_phan_bo: regex },
          { name: regex },
          { mach: regex },
          { tench: regex },
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$sd_tf" },
                regex: safeSearch,
                options: "i",
              },
            },
          },
        ],
      });
    }

    // ── Filter từng cột ──────────────────────────────────────────────
    if (ten_phan_bo)
      conditions.push({
        ten_phan_bo: { $regex: escapeRegex(ten_phan_bo), $options: "i" },
      });
    if (name)
      conditions.push({ name: { $regex: escapeRegex(name), $options: "i" } });
    if (tench)
      conditions.push({ tench: { $regex: escapeRegex(tench), $options: "i" } });
    if (mach)
      conditions.push({ mach: { $regex: escapeRegex(mach), $options: "i" } });
    if (sku) conditions.push({ sku: Number(sku) });
    if (pack) conditions.push({ pack: Number(pack) });
    if (trang_thai) conditions.push({ trang_thai });

// ── sd_tf ────────────────────────────────────────────────────────
if (sd_tf) {
  const safeSdTf = escapeRegex(sd_tf);
  conditions.push({
    $expr: {
      $regexMatch: {
        input: { $toString: "$sd_tf" },
        regex: safeSdTf,
        options: "i",
      },
    },
  });
}

    // ── Khoảng ngày ──────────────────────────────────────────────────
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(`${startDate}T00:00:00+07:00`);
      if (endDate) dateFilter.$lte = new Date(`${endDate}T23:59:59+07:00`);
      conditions.push({ ngay_import: dateFilter });
    }
      if (startNgayXuLi || endNgayXuLi) {
      const dateFilter = {};
      if (startNgayXuLi) dateFilter.$gte = new Date(`${startNgayXuLi}T00:00:00+07:00`);
      if (endNgayXuLi)   dateFilter.$lte = new Date(`${endNgayXuLi}T23:59:59+07:00`);
      conditions.push({ ngay_xu_li: dateFilter });
    }

    // Gộp thành filter cuối
    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const [total, data] = await Promise.all([
      PhanBo.countDocuments(filter),
      PhanBo.find(filter)
        .sort({ ngay_import: -1, ten_phan_bo: 1, mach: 1, sku: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    // Log chi tiết để debug
    console.error("getAllPhanBo error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────
const getByIdPhanBo = async (req, res) => {
  try {
    const item = await PhanBo.findById(req.params.id);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// CREATE ONE
// ─────────────────────────────────────────────
const createOnePhanBo = async (req, res) => {
  try {
    const newItem = await PhanBo.create(req.body);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT MANY (Bulk Insert)
// ─────────────────────────────────────────────
const importManyPhanBo = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({
        success: false,
        message: "Dữ liệu items phải là mảng và không được rỗng",
      });

    const preparedItems = items.map((item) => ({
      ...item,
      trang_thai: item.trang_thai || "cho_xu_li",
      ngay_import: item.ngay_import || new Date(),
    }));

    const result = await PhanBo.insertMany(preparedItems, { ordered: false });
    res.status(201).json({
      success: true,
      message: `Đã import thành công ${result.length} bản ghi`,
      inserted: result.length,
      data: result,
    });
  } catch (error) {
    if (error.name === "BulkWriteError" || error.insertedDocs) {
      return res.status(207).json({
        success: false,
        message: "Import một phần — có bản ghi bị lỗi",
        inserted: error.insertedDocs?.length ?? 0,
        errors: error.writeErrors?.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE ONE
// ─────────────────────────────────────────────
const updateOnePhanBo = async (req, res) => {
  try {
    const updated = await PhanBo.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE MANY
// ─────────────────────────────────────────────
const updateManyPhanBo = async (req, res) => {
  try {
    const { ids, update } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({
        success: false,
        message: "ids phải là mảng và không được rỗng",
      });
    if (!update || typeof update !== "object" || Array.isArray(update))
      return res.status(400).json({
        success: false,
        message: "update phải là object chứa các field cần cập nhật",
      });
if (update.trang_thai === "da_xu_li" && !update.ngay_xu_li) {
      update.ngay_xu_li = new Date(); 
    }
    const result = await PhanBo.updateMany(
      { _id: { $in: ids } },
      { $set: update },
      { runValidators: true },
    );
    res.status(200).json({
      success: true,
      message: `Đã cập nhật ${result.modifiedCount} / ${result.matchedCount} bản ghi`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE TRANG THAI (theo mach + ten_phan_bo)
// ─────────────────────────────────────────────
const updateTrangThaiPhanBo = async (req, res) => {
  try {
    const { mach, ten_phan_bo, trang_thai } = req.body;
    if (!mach || !ten_phan_bo || !trang_thai)
      return res.status(400).json({
        success: false,
        message: "Thiếu mach, ten_phan_bo hoặc trang_thai",
      });

    const result = await PhanBo.updateMany(
      { mach, ten_phan_bo },
      { $set: { trang_thai } },
      { runValidators: true },
    );
    res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái ${result.modifiedCount} bản ghi`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE ONE
// ─────────────────────────────────────────────
const deleteOnePhanBo = async (req, res) => {
  try {
    const deleted = await PhanBo.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản ghi" });
    res
      .status(200)
      .json({ success: true, message: "Đã xóa bản ghi", data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE MANY
// ─────────────────────────────────────────────
const deleteManyPhanBo = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({
        success: false,
        message: "ids phải là mảng và không được rỗng",
      });

    const result = await PhanBo.deleteMany({ _id: { $in: ids } });
    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} bản ghi`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE ALL
// ─────────────────────────────────────────────
const deleteAllPhanBo = async (req, res) => {
  try {
    const result = await PhanBo.deleteMany({});
    res.status(200).json({
      success: true,
      message: `Đã xóa toàn bộ ${result.deletedCount} bản ghi`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── IMPORT SD_TF ──────────────────────────────
const importSdTf = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({
        success: false,
        message: "rows phải là mảng và không được rỗng",
      });

    const bulkOps = rows.map(
      ({ ten_phan_bo, sd_tf, mach, sku, ngay_xu_li }) => ({
        updateOne: {
          filter: { ten_phan_bo, mach, sku: Number(sku) },
          update: {
            $set: {
              sd_tf: Number(sd_tf),
              trang_thai: "da_xu_li",
              ngay_xu_li: ngay_xu_li
                ? new Date(`${ngay_xu_li}T00:00:00+07:00`)
                : new Date(),
            },
          },
        },
      }),
    );

    const result = await PhanBo.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      success: true,
      message: "Import SD_TF thành công!",
      updated: result.modifiedCount,
      skipped: rows.length - result.modifiedCount,
    });
  } catch (error) {
    console.error("importSdTf error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  getAllPhanBo,
  getByIdPhanBo,
  createOnePhanBo,
  importManyPhanBo,
  updateOnePhanBo,
  updateManyPhanBo,
  updateTrangThaiPhanBo,
  deleteOnePhanBo,
  deleteManyPhanBo,
  deleteAllPhanBo,
  importSdTf,
};
