// controllers/phuXeController.js
const PhuXe = require("../../models/phuxe/phuxe");
const PhuXeName = require("../../models/phuxe/tenphuxe");

// 📦 Lấy danh sách tất cả phụ xe (có ngày import)
exports.getAllPhuXe = async (req, res) => {
  try {
    // Sắp xếp theo ngày tạo (ngày import) giảm dần
    const list = await PhuXe.find().sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách phụ xe", error });
  }
};

// 📄 Lấy thông tin 1 phụ xe theo ID
exports.getPhuXeById = async (req, res) => {
  try {
    const phuXe = await PhuXe.findById(req.params.id);
    if (!phuXe) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe" });
    }
    res.status(200).json(phuXe);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy thông tin phụ xe", error });
  }
};

// ➕ Thêm 1 phụ xe
exports.addPhuXe = async (req, res) => {
  try {
    const newPhuXe = new PhuXe(req.body);
    const saved = await newPhuXe.save();

    // trả về kèm ngày import
    res.status(201).json({
      message: "Thêm phụ xe thành công",
      data: saved,
      ngay_import: saved.createdAt, // 👈 thêm trường ngày import
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm phụ xe", error });
  }
};

// 🔥 Thêm nhiều phụ xe cùng lúc (import)
exports.addManyPhuXe = async (req, res) => {
  try {
    let data = req.body; // phải là mảng [{...}, {...}]

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ hoặc rỗng" });
    }

    // Lọc bỏ các bản ghi hoàn toàn rỗng
    data = data.filter(
      (item) =>
        item.khung_gio ||
        item.ten_cua_hang ||
        item.dich_vu ||
        item.ten_tai_xe ||
        item.bien_so_xe ||
        item.ten_phu_xe
    );

    if (data.length === 0) {
      return res.status(400).json({ message: "Dữ liệu sau khi lọc rỗng hết" });
    }

    const inserted = await PhuXe.insertMany(data);

    res.status(201).json({
      message: `Đã thêm ${inserted.length} phụ xe thành công`,
      data: inserted,
      ngay_import: inserted[0]?.createdAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi import danh sách phụ xe", error });
  }
};

// ✏️ Cập nhật phụ xe theo ID
exports.updatePhuXe = async (req, res) => {
  try {
    const updated = await PhuXe.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phụ xe để cập nhật" });
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi cập nhật phụ xe", error });
  }
};

// 🗑️ Xóa phụ xe theo ID
exports.deletePhuXe = async (req, res) => {
  try {
    const deleted = await PhuXe.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy phụ xe để xóa" });
    }
    res.status(200).json({ message: "Đã xóa phụ xe thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa phụ xe", error });
  }
};

exports.getAllPhuXeNames = async (req, res) => {
  try {
    const list = await PhuXeName.find().sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách tên phụ xe", error });
  }
};

// ➕ Thêm tên phụ xe mới
exports.addPhuXeName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên phụ xe" });

    const existed = await PhuXeName.findOne({ name });
    if (existed)
      return res.status(400).json({ message: "Tên phụ xe đã tồn tại" });

    const newName = new PhuXeName({ name });
    const saved = await newName.save();

    res.status(201).json({
      message: "Thêm tên phụ xe thành công",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm tên phụ xe", error });
  }
};

// 🗑️ Xóa tên phụ xe theo ID
exports.deletePhuXeName = async (req, res) => {
  try {
    const deleted = await PhuXeName.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tên phụ xe để xóa" });
    }
    res.status(200).json({ message: "Đã xóa tên phụ xe thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa tên phụ xe", error });
  }
};
