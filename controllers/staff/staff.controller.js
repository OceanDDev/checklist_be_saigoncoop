const Staff = require("../../models/staff/staff");

// Lấy toàn bộ nhân viên
exports.getAllStaffs = async (req, res) => {
  try {
    const staffs = await Staff.find();
    res.json(staffs);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách nhân viên", details: err.message });
  }
};



// Lấy theo ID
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy nhân viên", details: err.message });
  }
};

// Tạo 1 nhân viên
exports.createStaff = async (req, res) => {
  try {
    const { ma_nhan_vien, ho_ten, don_vi } = req.body;

    if (!ma_nhan_vien || !ho_ten || !don_vi) {
      return res.status(400).json({ error: "Thiếu thông tin nhân viên" });
    }

    const newStaff = new Staff({ ma_nhan_vien, ho_ten, don_vi });
    const saved = await newStaff.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Tạo nhân viên thất bại", details: err.message });
  }
};

// Tạo nhiều nhân viên
exports.createManyStaffs = async (req, res) => {
  try {
    const data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Dữ liệu phải là một mảng nhân viên." });
    }

    const result = await Staff.insertMany(data, { ordered: false });
    res.status(201).json({ success: true, inserted: result.length });
  } catch (err) {
    res.status(500).json({ error: "Tạo nhiều nhân viên thất bại", details: err.message });
  }
};

// Cập nhật
exports.updateStaff = async (req, res) => {
  try {
    const updated = await Staff.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Cập nhật thất bại", details: err.message });
  }
};

// Xóa
exports.deleteStaff = async (req, res) => {
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Xóa thất bại", details: err.message });
  }
};

// Tìm nhân viên theo mã nhân viên
exports.getStaffByMaNV = async (req, res) => {
  try {
    const { ma_nhan_vien } = req.query;
    if (!ma_nhan_vien) {
      return res.status(400).json({ error: "Thiếu mã nhân viên" });
    }

    const staff = await Staff.findOne({ ma_nhan_vien });

    if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi tìm nhân viên", details: err.message });
  }
};
