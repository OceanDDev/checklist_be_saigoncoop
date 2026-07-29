const BookXe = require("../../models/bookxe/bookxe"); // chỉnh lại path cho đúng vị trí model thực tế

const getAllBookXe = async (req, res) => {
  try {
    const {
      quan,
      ma_ch,
      ma_ncv,
      trangThai,
      tu_ngay,
      den_ngay,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (quan) filter.quan = quan;
    if (ma_ch) filter.ma_ch = ma_ch;
    if (ma_ncv) filter.ma_ncv = ma_ncv;
    if (trangThai) filter.trangThai = trangThai;

    if (tu_ngay || den_ngay) {
      filter.thoi_gian_xuat = {};
      if (tu_ngay) filter.thoi_gian_xuat.$gte = tu_ngay;
      if (den_ngay) filter.thoi_gian_xuat.$lte = den_ngay;
    }

    if (search) {
      filter.$or = [
        { ten_ch: { $regex: search, $options: "i" } },
        { ten_nvc: { $regex: search, $options: "i" } },
        { ma_ch: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      BookXe.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BookXe.countDocuments(filter),
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
    console.error("getAllBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi lấy danh sách book xe",
        error: error.message,
      });
  }
};

// GET /api/book-xe/:id
const getBookXeById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await BookXe.findById(id);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("getBookXeById error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi lấy phiếu book xe",
        error: error.message,
      });
  }
};

// POST /api/book-xe
const createBookXe = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.thoi_gian_xuat) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thời gian xuất" });
    }

    const newItem = new BookXe({
      ...payload,
      thoi_gian_tao: new Date(),
    });

    await newItem.save();

    return res
      .status(201)
      .json({
        success: true,
        message: "Tạo phiếu book xe thành công",
        data: newItem,
      });
  } catch (error) {
    console.error("createBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi tạo phiếu book xe",
        error: error.message,
      });
  }
};

// PUT /api/book-xe/:id
const updateBookXe = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const updated = await BookXe.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    console.error("updateBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi cập nhật phiếu book xe",
        error: error.message,
      });
  }
};

// PATCH /api/book-xe/:id/trang-thai
const updateTrangThai = async (req, res) => {
  try {
    const { id } = req.params;
    const { trangThai } = req.body;

    const validStatuses = ["Chưa Book", "Chờ xe", "Hoàn thành"];
    if (!validStatuses.includes(trangThai)) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const update = { trangThai };
    if (trangThai === "Hoàn thành") {
      update.thoi_gian_hoan_thanh = new Date();
    }

    const updated = await BookXe.findByIdAndUpdate(id, update, { new: true });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Cập nhật trạng thái thành công",
        data: updated,
      });
  } catch (error) {
    console.error("updateTrangThai error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi cập nhật trạng thái",
        error: error.message,
      });
  }
};

// DELETE /api/book-xe/:id
const deleteBookXe = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BookXe.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiếu book xe" });
    }

    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("deleteBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi xóa phiếu book xe",
        error: error.message,
      });
  }
};

// DELETE /api/book-xe (xóa nhiều theo mảng ids)
const deleteManyBookXe = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách id không hợp lệ" });
    }

    const result = await BookXe.deleteMany({ _id: { $in: ids } });

    return res
      .status(200)
      .json({
        success: true,
        message: "Xóa thành công",
        deletedCount: result.deletedCount,
      });
  } catch (error) {
    console.error("deleteManyBookXe error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi xóa nhiều phiếu book xe",
        error: error.message,
      });
  }
};

module.exports = {
  getAllBookXe,
  getBookXeById,
  createBookXe, 
  updateBookXe,
  updateTrangThai,
  deleteBookXe,
  deleteManyBookXe,
};
