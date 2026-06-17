const PhanBoCS = require("../../models/phieusoan/phanbocs");
const DataCH = require("../../models/phieusoan/dataCH");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAllPhanBoCS = async (req, res) => {
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
      chuyen = "",
      startDate = "",
      endDate = "",
      startNgayXuLi = "",
      endNgayXuLi = "",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(9999, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const conditions = [];

    if (search) {
      const safeSearch = escapeRegex(search);
      const regex = { $regex: safeSearch, $options: "i" };
      conditions.push({
        $or: [
          { ten_phan_bo: regex },
          { name: regex },
          { mach: regex },
          { tench: regex },
          { chuyen: regex },
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

    if (ten_phan_bo)
      conditions.push({ ten_phan_bo: { $regex: escapeRegex(ten_phan_bo), $options: "i" } });
    if (name)
      conditions.push({ name: { $regex: escapeRegex(name), $options: "i" } });
    if (tench)
      conditions.push({ tench: { $regex: escapeRegex(tench), $options: "i" } });
    if (mach)
      conditions.push({ mach: { $regex: escapeRegex(mach), $options: "i" } });
    if (chuyen)
      conditions.push({ chuyen: { $regex: escapeRegex(chuyen), $options: "i" } });
    if (sku) conditions.push({ sku: Number(sku) });
    if (pack) conditions.push({ pack: Number(pack) });
    if (trang_thai) conditions.push({ trang_thai });

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

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(`${startDate}T00:00:00+07:00`);
      if (endDate) dateFilter.$lte = new Date(`${endDate}T23:59:59+07:00`);
      conditions.push({ ngay_import: dateFilter });
    }

    if (startNgayXuLi || endNgayXuLi) {
      const dateFilter = {};
      if (startNgayXuLi) dateFilter.$gte = new Date(`${startNgayXuLi}T00:00:00+07:00`);
      if (endNgayXuLi) dateFilter.$lte = new Date(`${endNgayXuLi}T23:59:59+07:00`);
      conditions.push({ ngay_xu_li: dateFilter });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const [total, data] = await Promise.all([
      PhanBoCS.countDocuments(filter),
      PhanBoCS.find(filter)
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
    console.error("getAllPhanBoCS error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getByIdPhanBoCS = async (req, res) => {
  try {
    const item = await PhanBoCS.findById(req.params.id);
    if (!item)
      return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createOnePhanBoCS = async (req, res) => {
  try {
    const newItem = await PhanBoCS.create(req.body);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// IMPORT MANY — tự động lấy chuyen từ DataCH theo mach
// ─────────────────────────────────────────────
const importManyPhanBoCS = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({
        success: false,
        message: "Dữ liệu items phải là mảng và không được rỗng",
      });

    // Lấy danh sách mach duy nhất
    const machList = [...new Set(items.map((i) => i.mach).filter(Boolean))];

    // Lookup DataCH một lần cho tất cả mach
    const dataCHList = await DataCH.find(
      { mach: { $in: machList } },
      { mach: 1, chuyen: 1, _id: 0 }
    ).lean();

    // Map mach -> chuyen
    const machChuyenMap = {};
    dataCHList.forEach((ch) => {
      machChuyenMap[ch.mach] = ch.chuyen || "";
    });

    const preparedItems = items.map((item) => ({
      ...item,
      chuyen: machChuyenMap[item.mach] || item.chuyen || "",
      trang_thai: item.trang_thai || "cho_xu_li",
      ngay_import: item.ngay_import || new Date(),
    }));

    const result = await PhanBoCS.insertMany(preparedItems, { ordered: false });
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

const updateOnePhanBoCS = async (req, res) => {
  try {
    const updated = await PhanBoCS.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated)
      return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateManyPhanBoCS = async (req, res) => {
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

    const result = await PhanBoCS.updateMany(
      { _id: { $in: ids } },
      { $set: update },
      { runValidators: true }
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

const updateTrangThaiPhanBoCS = async (req, res) => {
  try {
    const { mach, ten_phan_bo, trang_thai } = req.body;
    if (!mach || !ten_phan_bo || !trang_thai)
      return res.status(400).json({
        success: false,
        message: "Thiếu mach, ten_phan_bo hoặc trang_thai",
      });

    const result = await PhanBoCS.updateMany(
      { mach, ten_phan_bo },
      { $set: { trang_thai } },
      { runValidators: true }
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

const deleteOnePhanBoCS = async (req, res) => {
  try {
    const deleted = await PhanBoCS.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi" });
    res.status(200).json({ success: true, message: "Đã xóa bản ghi", data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteManyPhanBoCS = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({
        success: false,
        message: "ids phải là mảng và không được rỗng",
      });

    const result = await PhanBoCS.deleteMany({ _id: { $in: ids } });
    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} bản ghi`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAllPhanBoCS = async (req, res) => {
  try {
    const result = await PhanBoCS.deleteMany({});
    res.status(200).json({
      success: true,
      message: `Đã xóa toàn bộ ${result.deletedCount} bản ghi`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const importSdTfCS = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({
        success: false,
        message: "rows phải là mảng và không được rỗng",
      });

    const bulkOps = rows.map(({ ten_phan_bo, sd_tf, mach, sku, ngay_xu_li }) => ({
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
    }));

    const result = await PhanBoCS.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      success: true,
      message: "Import SD_TF thành công!",
      updated: result.modifiedCount,
      skipped: rows.length - result.modifiedCount,
    });
  } catch (error) {
    console.error("importSdTfCS error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllPhanBoCS,
  getByIdPhanBoCS,
  createOnePhanBoCS,
  importManyPhanBoCS,
  updateOnePhanBoCS,
  updateManyPhanBoCS,
  updateTrangThaiPhanBoCS,
  deleteOnePhanBoCS,
  deleteManyPhanBoCS,
  deleteAllPhanBoCS,
  importSdTfCS,
};