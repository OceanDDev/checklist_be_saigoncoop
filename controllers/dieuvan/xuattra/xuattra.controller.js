// controllers/xuatTra.controller.js
const XuatTra = require("../../../models/dieuvan/xuattra/xuattra");

// ====== CREATE ======
exports.createXuatTra = async (req, res) => {
  try {
    const newDoc = new XuatTra(req.body);
    await newDoc.save();
    res.status(201).json({
      success: true,
      message: "Tạo phiếu xuất trả thành công",
      data: newDoc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi tạo phiếu xuất trả", error });
  }
};

// ====== READ ALL ======
exports.getAllXuatTra = async (req, res) => {
  try {
    const filter = {};
    if (req.query.trangThai !== undefined) {
      filter.trangThai = req.query.trangThai === "true";
    }
    const list = await XuatTra.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách phiếu xuất trả", error });
  }
};

// ====== READ ONE ======
exports.getXuatTraById = async (req, res) => {
  try {
    const doc = await XuatTra.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất trả" });
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy chi tiết phiếu xuất trả", error });
  }
};

// ====== UPDATE ======
exports.updateXuatTra = async (req, res) => {
  try {
    const updated = await XuatTra.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất trả để cập nhật" });
    }
    res.json({ success: true, message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật phiếu xuất trả", error });
  }
};

// ====== DELETE ======
exports.deleteXuatTra = async (req, res) => {
  try {
    const deleted = await XuatTra.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất trả để xóa" });
    }
    res.json({ success: true, message: "Xóa phiếu xuất trả thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi xóa phiếu xuất trả", error });
  }
};
