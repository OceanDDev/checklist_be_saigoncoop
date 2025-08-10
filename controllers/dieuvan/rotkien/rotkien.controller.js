const RotKien = require("../../../models/dieuvan/rotkien/rotkien");

const mappingBoPhan = {
  "Dieu Van": "Điều Vận",
  "XU LY DON HANG": "XLĐH"
};

// Tạo mới một bản ghi rớt kiện
exports.createRotKien = async (req, res) => {
  try {
    const name = req.headers["x-user-name"] || "Unknown";

    const { maCH, tenCH, soKienRot, soSoda, ngayRotKien, ghiChu, trangThai } = req.body;
    const boPhan = mappingBoPhan[name] || "Không xác định";

    const newData = new RotKien({
      name,
      boPhan,
      maCH,
      tenCH,
      soKienRot,
      soSoda,
      ngayRotKien,
      ghiChu,
      trangThai
    });

    const saved = await newData.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Thêm nhiều bản ghi một lúc
exports.createManyRotKien = async (req, res) => {
  try {
    const name = req.headers["x-user-name"] || "Unknown";
    const data = req.body; // phải là mảng

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    const boPhan = mappingBoPhan[name] || "Không xác định";
    const dataWithBoPhan = data.map((item) => ({
      ...item,
      name,
      boPhan
    }));

    const inserted = await RotKien.insertMany(dataWithBoPhan);
    res.status(201).json({ message: "Thêm nhiều rớt kiện thành công", data: inserted });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy tất cả bản ghi
exports.getAllRotKien = async (req, res) => {
  try {
    const result = await RotKien.find().sort({ createdAt: -1 });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy theo ID
exports.getRotKienById = async (req, res) => {
  try {
    const rk = await RotKien.findById(req.params.id);
    if (!rk) return res.status(404).json({ message: "Không tìm thấy dữ liệu" });
    res.status(200).json(rk);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật
exports.updateRotKien = async (req, res) => {
  try {
    const updated = await RotKien.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy dữ liệu để cập nhật" });
    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Xoá
exports.deleteRotKien = async (req, res) => {
  try {
    const deleted = await RotKien.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy dữ liệu để xoá" });
    res.status(200).json({ message: "Xoá thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
