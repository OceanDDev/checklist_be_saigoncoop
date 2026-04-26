const KhoaHoc = require("../../models/learningSCL/khoaHoc");

// Lấy tất cả khóa học đã xuất bản
exports.layTatCa = async (req, res) => {
  try {
    const danhSach = await KhoaHoc.find({});

    res.json(danhSach);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Lấy 1 khóa học theo id
exports.layMot = async (req, res) => {
  try {
    const khoaHoc = await KhoaHoc.findById(req.params.id).populate({
      path: "danhSachBaiHoc",
      select: "tieuDe thuTu video taiLieu baiKiemTraId",
      options: { sort: { thuTu: 1 } },
    });
    if (!khoaHoc)
      return res.status(404).json({ loi: "Không tìm thấy khóa học" });
    res.json(khoaHoc);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Tạo khóa học mới
exports.taoMoi = async (req, res) => {
  try {
    const khoaHoc = await KhoaHoc.create({
      ...req.body,
      nguoiTao: req.user.id,
    });
    res.status(201).json(khoaHoc);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// Cập nhật khóa học
exports.capNhat = async (req, res) => {
  try {
    const khoaHoc = await KhoaHoc.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!khoaHoc)
      return res.status(404).json({ loi: "Không tìm thấy khóa học" });
    res.json(khoaHoc);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// Xóa khóa học
exports.xoa = async (req, res) => {
  try {
    await KhoaHoc.findByIdAndDelete(req.params.id);
    res.json({ thongBao: "Đã xóa khóa học" });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};
