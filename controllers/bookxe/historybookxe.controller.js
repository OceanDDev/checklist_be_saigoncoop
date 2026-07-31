const HistoryBookXe = require("../../models/bookxe/historybookxe"); // chỉnh lại path cho đúng vị trí model thực tế

// GET /api/history-book-xe
const getAllHistoryBookXe = async (req, res) => {
  try {
    const {
      ma_ch,
      ma_ncv,
      lenh_dieu_dong,
      tu_ngay,
      den_ngay,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (ma_ch) filter.ma_ch = ma_ch;
    if (ma_ncv) filter.ma_ncv = ma_ncv;
    if (lenh_dieu_dong) filter.lenh_dieu_dong = lenh_dieu_dong;

    if (tu_ngay || den_ngay) {
      // Lọc theo ngày ghi nhận (createdAt), vì thoi_gian_tao thường không
      // được set khi import Excel (chỉ map 6 cột: concept, lenh_dieu_dong,
      // ma_ch, ten_ch, ma_ncv, ten_nvc) nên lọc theo field đó sẽ luôn rỗng.
      filter.createdAt = {};
      if (tu_ngay) {
        filter.createdAt.$gte = new Date(`${tu_ngay}T00:00:00.000Z`);
      }
      if (den_ngay) {
        filter.createdAt.$lte = new Date(`${den_ngay}T23:59:59.999Z`);
      }
    }

    if (search) {
      filter.$or = [
        { ten_ch: { $regex: search, $options: "i" } },
        { ten_nvc: { $regex: search, $options: "i" } },
        { ma_ch: { $regex: search, $options: "i" } },
        { lenh_dieu_dong: { $regex: search, $options: "i" } },
        { concept: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      HistoryBookXe.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      HistoryBookXe.countDocuments(filter),
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
    console.error("getAllHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi lấy danh sách lịch sử book xe",
        error: error.message,
      });
  }
};

// GET /api/history-book-xe/:id
const getHistoryBookXeById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await HistoryBookXe.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy lịch sử book xe" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("getHistoryBookXeById error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi lấy lịch sử book xe",
        error: error.message,
      });
  }
};

// POST /api/history-book-xe
const createHistoryBookXe = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.lenh_dieu_dong) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu lệnh điều động" });
    }

    const newItem = new HistoryBookXe(payload);
    await newItem.save();

    return res
      .status(201)
      .json({
        success: true,
        message: "Tạo lịch sử book xe thành công",
        data: newItem,
      });
  } catch (error) {
    console.error("createHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi tạo lịch sử book xe",
        error: error.message,
      });
  }
};

// POST /api/history-book-xe/import-many
const importManyHistoryBookXe = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Danh sách dữ liệu import không hợp lệ",
        });
    }

    const invalidIndex = data.findIndex((item) => !item.lenh_dieu_dong);
    if (invalidIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Bản ghi thứ ${invalidIndex + 1} thiếu lệnh điều động`,
      });
    }

    const docs = data.map((item) => ({
      concept: item.concept,
      lenh_dieu_dong: item.lenh_dieu_dong,
      ma_ch: item.ma_ch,
      ten_ch: item.ten_ch,
      ma_ncv: item.ma_ncv,
      ten_nvc: item.ten_nvc,
      thoi_gian_tao: item.thoi_gian_tao
        ? new Date(item.thoi_gian_tao)
        : undefined,
    }));

    const inserted = await HistoryBookXe.insertMany(docs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `Import thành công ${inserted.length} bản ghi`,
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (error) {
    console.error("importManyHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi import nhiều lịch sử book xe",
        error: error.message,
      });
  }
};

// PUT /api/history-book-xe/:id
const updateHistoryBookXe = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const updated = await HistoryBookXe.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy lịch sử book xe" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("updateHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi cập nhật lịch sử book xe",
        error: error.message,
      });
  }
};

// DELETE /api/history-book-xe/:id
const deleteHistoryBookXe = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await HistoryBookXe.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy lịch sử book xe" });
    }

    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("deleteHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi xóa lịch sử book xe",
        error: error.message,
      });
  }
};

// DELETE /api/history-book-xe (xóa nhiều theo mảng ids)
const deleteManyHistoryBookXe = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách id không hợp lệ" });
    }

    const result = await HistoryBookXe.deleteMany({ _id: { $in: ids } });

    return res
      .status(200)
      .json({
        success: true,
        message: "Xóa thành công",
        deletedCount: result.deletedCount,
      });
  } catch (error) {
    console.error("deleteManyHistoryBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi xóa nhiều lịch sử book xe",
        error: error.message,
      });
  }
};

module.exports = {
  getAllHistoryBookXe,
  getHistoryBookXeById,
  createHistoryBookXe,
  importManyHistoryBookXe,
  updateHistoryBookXe,
  deleteHistoryBookXe,
  deleteManyHistoryBookXe,
};
