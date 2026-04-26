const BaiKiemTra = require("../../models/learningSCL/BaiKiemTra");
const BaiHoc = require("../../models/learningSCL/BaiHoc");
const jwt = require("jsonwebtoken");

// Tạo bài kiểm tra mới
exports.taoMoi = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.create({
      ...req.body,
      nguoiTao: req.user.id,
    });
    // Gắn vào bài học nếu có lessonId
    if (req.body.baiHocId) {
      await BaiHoc.findByIdAndUpdate(req.body.baiHocId, {
        baiKiemTraId: baiKiemTra._id,
      });
    }
    res.status(201).json(baiKiemTra);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// Lấy 1 bài kiểm tra (ẩn đáp án với học viên)
exports.layMot = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra) return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    const ketQua = baiKiemTra.toObject();

    // Ẩn đáp án đúng với học viên
    if (req.user.role !== "admin" && req.user.role !== "teacher") {
      ketQua.danhSachCauHoi = ketQua.danhSachCauHoi.map((cau) => {
        const { dapAnDung, giaiThich, ...an } = cau;
        return an;
      });
    }

    res.json(ketQua);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Cập nhật bài kiểm tra
exports.capNhat = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!baiKiemTra) return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });
    res.json(baiKiemTra);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// Xóa bài kiểm tra
exports.xoa = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findByIdAndDelete(req.params.id);
    if (!baiKiemTra) return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });
    if (baiKiemTra.baiHocId) {
      await BaiHoc.findByIdAndUpdate(baiKiemTra.baiHocId, {
        $unset: { baiKiemTraId: 1 },
      });
    }
    res.json({ thongBao: "Đã xóa bài kiểm tra" });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Tạo QR token cho bài kiểm tra
exports.taoQR = async (req, res) => {
  try {
    const { thoiGianHetHan = 30 } = req.body; // phút, mặc định 30 phút

    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra) return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    const hetHanLuc = new Date(Date.now() + thoiGianHetHan * 60 * 1000);
    const token = jwt.sign(
      { baiKiemTraId: req.params.id, loai: "qr_truy_cap" },
      process.env.JWT_SECRET,
      { expiresIn: `${thoiGianHetHan}m` }
    );

    await BaiKiemTra.findByIdAndUpdate(req.params.id, {
      qrToken: token,
      qrHetHanLuc: hetHanLuc,
    });

    // URL frontend scan vào
    const qrUrl = `${process.env.FRONTEND_URL}/bai-kiem-tra/qr?token=${token}`;

    res.json({ token, qrUrl, hetHanLuc });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Xác thực QR token trước khi làm bài
exports.xacThucQR = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ loi: "Thiếu token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.loai !== "qr_truy_cap")
      return res.status(403).json({ loi: "Sai loại token" });

    const baiKiemTra = await BaiKiemTra.findById(decoded.baiKiemTraId);
    if (!baiKiemTra) return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    // Ẩn đáp án
    const ketQua = baiKiemTra.toObject();
    ketQua.danhSachCauHoi = ketQua.danhSachCauHoi.map((cau) => {
      const { dapAnDung, giaiThich, ...an } = cau;
      return an;
    });

    res.json({ hopLe: true, baiKiemTra: ketQua });
  } catch (err) {
    res.status(401).json({ hopLe: false, loi: "Token hết hạn hoặc không hợp lệ" });
  }
};