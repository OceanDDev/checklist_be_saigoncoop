const NhaXe = require("../../models/bookxe/nhaxe"); // chỉnh lại path cho đúng vị trí model thực tế

// Các field cho phép ghi vào DB (tránh client nhét field lạ / _id / createdAt)
const ALLOWED_FIELDS = [
  "ma_ch",
  "ten_ch",
  "quan",
  "thoi_gian_xuat",
  "lich_di_hang",
  "nvc",
  "ghi_chu",
];

const pickFields = (obj = {}) => {
  const result = {};
  ALLOWED_FIELDS.forEach((key) => {
    if (obj[key] !== undefined) result[key] = obj[key];
  });
  return result;
};

// Escape ký tự đặc biệt để search regex không bị lỗi / injection
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/nha-xe
const getAllNhaXe = async (req, res) => {
  try {
    const {
      ma_ch,
      quan,
      nvc,
      thoi_gian_xuat,
      tu_ngay,
      den_ngay,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (ma_ch) filter.ma_ch = ma_ch;
    if (quan) filter.quan = quan;
    if (nvc) filter.nvc = nvc;
    if (thoi_gian_xuat) filter.thoi_gian_xuat = thoi_gian_xuat;

    if (tu_ngay || den_ngay) {
      filter.createdAt = {};
      if (tu_ngay) {
        filter.createdAt.$gte = new Date(`${tu_ngay}T00:00:00.000Z`);
      }
      if (den_ngay) {
        filter.createdAt.$lte = new Date(`${den_ngay}T23:59:59.999Z`);
      }
    }

    if (search) {
      const keyword = escapeRegex(search);
      filter.$or = [
        { ma_ch: { $regex: keyword, $options: "i" } },
        { ten_ch: { $regex: keyword, $options: "i" } },
        { quan: { $regex: keyword, $options: "i" } },
        { nvc: { $regex: keyword, $options: "i" } },
        { lich_di_hang: { $regex: keyword, $options: "i" } },
        { ghi_chu: { $regex: keyword, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      NhaXe.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      NhaXe.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getAllNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách nhà xe",
      error: error.message,
    });
  }
};

// GET /api/nha-xe/:id
const getNhaXeById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await NhaXe.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhà xe" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("getNhaXeById error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy nhà xe",
      error: error.message,
    });
  }
};

// POST /api/nha-xe
const createNhaXe = async (req, res) => {
  try {
    const payload = pickFields(req.body);

    if (!payload.ma_ch) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mã cửa hàng" });
    }

    const newItem = new NhaXe(payload);
    await newItem.save();

    return res.status(201).json({
      success: true,
      message: "Tạo nhà xe thành công",
      data: newItem,
    });
  } catch (error) {
    console.error("createNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tạo nhà xe",
      error: error.message,
    });
  }
};

// POST /api/nha-xe/import-many
// body: { data: [{ ma_ch, ten_ch, quan, thoi_gian_xuat, lich_di_hang, nvc, ghi_chu }, ...] }
const importManyNhaXe = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách dữ liệu import không hợp lệ",
      });
    }

    const invalidIndex = data.findIndex((item) => !item || !item.ma_ch);
    if (invalidIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Bản ghi thứ ${invalidIndex + 1} thiếu mã cửa hàng`,
      });
    }

    const docs = data.map((item) => pickFields(item));

    const inserted = await NhaXe.insertMany(docs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `Import thành công ${inserted.length} bản ghi`,
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (error) {
    console.error("importManyNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi import nhiều nhà xe",
      error: error.message,
    });
  }
};

// PUT /api/nha-xe/:id
const updateNhaXe = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = pickFields(req.body);

    const updated = await NhaXe.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhà xe" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("updateNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật nhà xe",
      error: error.message,
    });
  }
};

// PUT /api/nha-xe/update-many
// Cập nhật nhiều bản ghi, MỖI BẢN GHI CÓ GIÁ TRỊ RIÊNG (dùng bulkWrite, 1 lần gọi DB)
// body: { data: [{ _id: "...", nvc: "A", ghi_chu: "..." }, { _id: "...", quan: "Q1" }, ...] }
const updateManyNhaXe = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách dữ liệu cập nhật không hợp lệ",
      });
    }

    const invalidIndex = data.findIndex((item) => !item || !item._id);
    if (invalidIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Bản ghi thứ ${invalidIndex + 1} thiếu _id`,
      });
    }

    const operations = [];
    for (const item of data) {
      const fields = pickFields(item);
      if (Object.keys(fields).length === 0) continue; // không có gì để update

      operations.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: fields },
        },
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có trường dữ liệu hợp lệ để cập nhật",
      });
    }

    const result = await NhaXe.bulkWrite(operations, { ordered: false });

    return res.status(200).json({
      success: true,
      message: `Cập nhật thành công ${result.modifiedCount} bản ghi`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("updateManyNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật nhiều nhà xe",
      error: error.message,
    });
  }
};

// PUT /api/nha-xe/update-many-by-ids
// Cập nhật nhiều bản ghi CÙNG MỘT GIÁ TRỊ (vd: đổi nvc hàng loạt cho các cửa hàng được chọn)
// body: { ids: ["...", "..."], update: { nvc: "Nhà xe B" } }
const updateManyNhaXeByIds = async (req, res) => {
  try {
    const { ids, update } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách id không hợp lệ" });
    }

    const fields = pickFields(update);
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có trường dữ liệu hợp lệ để cập nhật",
      });
    }

    const result = await NhaXe.updateMany(
      { _id: { $in: ids } },
      { $set: fields },
      { runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: `Cập nhật thành công ${result.modifiedCount} bản ghi`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("updateManyNhaXeByIds error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi cập nhật nhiều nhà xe",
      error: error.message,
    });
  }
};

// DELETE /api/nha-xe/:id
const deleteNhaXe = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await NhaXe.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhà xe" });
    }

    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("deleteNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xóa nhà xe",
      error: error.message,
    });
  }
};

// DELETE /api/nha-xe (xóa nhiều theo mảng ids)
const deleteManyNhaXe = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách id không hợp lệ" });
    }

    const result = await NhaXe.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      success: true,
      message: "Xóa thành công",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("deleteManyNhaXe error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xóa nhiều nhà xe",
      error: error.message,
    });
  }
};

module.exports = {
  getAllNhaXe,
  getNhaXeById,
  createNhaXe,
  importManyNhaXe,
  updateNhaXe,
  updateManyNhaXe,
  updateManyNhaXeByIds,
  deleteNhaXe,
  deleteManyNhaXe,
};