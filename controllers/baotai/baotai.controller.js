// controllers/phieusoan/baotai.controller.js
const BaoTai = require("../../models/baotai/baotai");

// GET /baotai - lấy danh sách (có filter cơ bản theo nvc, chuyen, trangThai)
const getAllBaoTai = async (req, res) => {
  try {
    const { nvc, chuyen, trangThai, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (nvc) filter.nvc = nvc;
    if (chuyen) filter.chuyen = chuyen;
    if (trangThai) filter.trangThai = trangThai;

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      BaoTai.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BaoTai.countDocuments(filter),
    ]);

    return res
      .status(200)
      .json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách BaoTai", error: error.message });
  }
};

// GET /baotai/:id
const getByIdBaoTai = async (req, res) => {
  try {
    const item = await BaoTai.findById(req.params.id);
    if (!item)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    return res.status(200).json(item);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi lấy bản ghi BaoTai", error: error.message });
  }
};

// createOneBaoTai
const createOneBaoTai = async (req, res) => {
  try {
    const nvc = req.body.nvc || req.body.supplier;
    const {
      chuyen,
      bsx,
      thoi_gian_vao,
      check_in,
      check_out,
      trangThai,
      nv_tk,
      cong_xuat,
    } = req.body;

    if (!nvc || !chuyen) {
      return res
        .status(400)
        .json({ message: "Thiếu trường bắt buộc: nvc, chuyen" });
    }

    const newItem = await BaoTai.create({
      nvc,
      chuyen,
      stt: "", // chưa checkin -> chưa có STT
      bsx,
      thoi_gian_vao,
      check_in,
      check_out,
      trangThai,
      nv_tk,
      cong_xuat,
    });

    return res.status(201).json(newItem);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi tạo BaoTai", error: error.message });
  }
};
// PUT /baotai/:id - cập nhật chung (mọi field)
const updateOneBaoTai = async (req, res) => {
  try {
    const updated = await BaoTai.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    return res.status(200).json(updated);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi cập nhật BaoTai", error: error.message });
  }
};

// DELETE /baotai/:id
const deleteOneBaoTai = async (req, res) => {
  try {
    const deleted = await BaoTai.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    return res.status(200).json({ message: "Đã xóa", id: req.params.id });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi xóa BaoTai", error: error.message });
  }
};

// PATCH /baotai/:id/nv-tk-cong-xuat
// Endpoint riêng để THÊM / SỬA / XÓA 2 field nv_tk và cong_xuat
// - Gửi giá trị string bình thường để thêm/sửa
// - Gửi "" hoặc null để xóa (clear) field đó
const updateNvTkCongXuat = async (req, res) => {
  try {
    const { nv_tk, cong_xuat } = req.body;

    if (nv_tk === undefined && cong_xuat === undefined) {
      return res
        .status(400)
        .json({ message: "Cần ít nhất 1 trong 2 field: nv_tk hoặc cong_xuat" });
    }

    const updateFields = {};
    // undefined = không đụng tới field đó; null/"" = xóa field đó
    if (nv_tk !== undefined) {
      updateFields.nv_tk = nv_tk === null ? "" : String(nv_tk).trim();
    }
    if (cong_xuat !== undefined) {
      updateFields.cong_xuat =
        cong_xuat === null ? "" : String(cong_xuat).trim();
    }

    const updated = await BaoTai.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi khi cập nhật nv_tk/cong_xuat",
      error: error.message,
    });
  }
};

// POST /baotai/import - import nhiều (bulk create)
// Import kế hoạch xe từ Excel chỉ có: "supplier" (Nhà vận chuyển), "chuyen"
// (Siêu thị), "bsx" (Số xe) — KHÔNG có "stt" (STT được nhập tay sau trên
// bảng UI) và KHÔNG có "nvc" (frontend đặt tên field là "supplier").
// => chỉ bắt buộc nvc/supplier, KHÔNG bắt buộc chuyen/stt khi import.
const createManyBaoTai = async (req, res) => {
  try {
    const { items } = req.body; // items: mảng object BaoTai

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "items phải là mảng và không được rỗng" });
    }

    const validItems = [];
    const invalidItems = [];

    items.forEach((item, index) => {
      // Chấp nhận cả "nvc" lẫn "supplier" (alias)
      const nvc = (item.nvc || item.supplier || "").toString().trim();

      if (!nvc) {
        invalidItems.push({
          index,
          item,
          reason: "Thiếu nvc/supplier (Nhà vận chuyển)",
        });
        return;
      }

      validItems.push({
        nvc,
        chuyen: item.chuyen || "",
        stt: item.stt || "", // không bắt buộc khi import, điền tay sau
        bsx: item.bsx || "",
        thoi_gian_vao: item.thoi_gian_vao || "",
        check_in: item.check_in || "",
        check_out: item.check_out || "",
        trangThai: item.trangThai || "",
        nv_tk: item.nv_tk || "",
        cong_xuat: item.cong_xuat || "",
      });
    });

    let inserted = [];
    if (validItems.length > 0) {
      inserted = await BaoTai.insertMany(validItems, { ordered: false });
    }

    return res.status(201).json({
      message: `Đã import ${inserted.length}/${items.length} bản ghi`,
      insertedCount: inserted.length,
      failedCount: invalidItems.length,
      failedItems: invalidItems,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi import BaoTai", error: error.message });
  }
};

// createOneBaoTaiSLL
const createOneBaoTaiSLL = async (req, res) => {
  try {
    const nvc = req.body.nvc || req.body.supplier;
    const {
      bsx,
      thoi_gian_vao,
      check_in,
      check_out,
      trangThai,
      nv_tk,
      cong_xuat,
    } = req.body;

    if (!nvc) {
      return res
        .status(400)
        .json({ message: "Thiếu trường bắt buộc: nvc" });
    }

    const newItem = await BaoTai.create({
      nvc,
      chuyen: "SLL",
      stt: "", // chưa checkin -> chưa có STT
      bsx,
      thoi_gian_vao,
      check_in,
      check_out,
      trangThai,
      nv_tk,
      cong_xuat,
    });

    return res.status(201).json(newItem);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi khi tạo BaoTai (SLL)", error: error.message });
  }
};

module.exports = {
  getAllBaoTai,
  getByIdBaoTai,
  createOneBaoTai,
  createManyBaoTai,
  createOneBaoTaiSLL,
  updateOneBaoTai,
  deleteOneBaoTai,
  updateNvTkCongXuat,
};
