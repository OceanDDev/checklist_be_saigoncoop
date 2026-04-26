const LuotLamBai = require("../../models/learningSCL/LuotLamBai");
const BaiKiemTra = require("../../models/learningSCL/BaiKiemTra");
const jwt = require("jsonwebtoken");

// Xác thực QR token → trả về bài kiểm tra (không cần đăng nhập)
exports.xacThucQR = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ loi: "Thiếu token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.loai !== "qr_truy_cap")
      return res.status(403).json({ loi: "Sai loại token" });

    const baiKiemTra = await BaiKiemTra.findById(decoded.baiKiemTraId);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    // Ẩn đáp án trước khi trả về
    const data = baiKiemTra.toObject();
    data.danhSachCauHoi = data.danhSachCauHoi.map(({ dapAnDung, giaiThich, ...cau }) => cau);

    res.json({ hopLe: true, baiKiemTra: data });
  } catch (err) {
    res.status(401).json({ hopLe: false, loi: "Token hết hạn hoặc không hợp lệ" });
  }
};

// Nộp bài qua QR — không cần đăng nhập, chỉ cần tên
exports.nopBaiQR = async (req, res) => {
  try {
    const { tenNguoiLam, baiKiemTraId, danhSachCauTraLoi, qrToken } = req.body;

    if (!tenNguoiLam?.trim())
      return res.status(400).json({ loi: "Vui lòng nhập tên" });

    // Xác thực QR token
    try {
      const decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
      if (decoded.loai !== "qr_truy_cap")
        return res.status(403).json({ loi: "Token QR không hợp lệ" });
    } catch {
      return res.status(401).json({ loi: "Token QR hết hạn hoặc không hợp lệ" });
    }

    const baiKiemTra = await BaiKiemTra.findById(baiKiemTraId);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    // Chấm điểm
    let soCauDung = 0;
    const ketQua = danhSachCauTraLoi.map((tra) => {
      const cauHoi = baiKiemTra.danhSachCauHoi[tra.viTriCauHoi];
      const dung = cauHoi && cauHoi.dapAnDung === tra.luaChonCuaHoc;
      if (dung) soCauDung++;
      return { ...tra, dung };
    });

    const tongSoCau = baiKiemTra.danhSachCauHoi.length;
    const diem = Math.round((soCauDung / tongSoCau) * 100);
    const dat = diem >= baiKiemTra.caiDat.diemDauVao;

    const luot = await LuotLamBai.create({
      tenNguoiLam: tenNguoiLam.trim(),
      baiKiemTraId,
      baiHocId: baiKiemTra.baiHocId,
      danhSachCauTraLoi: ketQua,
      diem,
      soCauDung,
      tongSoCau,
      dat,
      nopLuc: new Date(),
      quaKenh: "qr",
    });

    // Trả kết quả
    const phanHoi = {
      tenNguoiLam: luot.tenNguoiLam,
      diem,
      soCauDung,
      tongSoCau,
      dat,
      luotId: luot._id,
    };

    // Kèm giải thích nếu settings cho phép
    if (baiKiemTra.caiDat.hienThiKetQua) {
      phanHoi.chiTiet = ketQua.map((tra) => ({
        ...tra,
        giaiThich: baiKiemTra.danhSachCauHoi[tra.viTriCauHoi]?.giaiThich || null,
      }));
    }

    res.status(201).json(phanHoi);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Xem tất cả lượt làm của 1 bài kiểm tra (admin/teacher xem)
exports.tatCaLuotLam = async (req, res) => {
  try {
    const danhSach = await LuotLamBai.find({ baiKiemTraId: req.params.id })
      .select("tenNguoiLam diem soCauDung tongSoCau dat nopLuc quaKenh")
      .sort({ createdAt: -1 });
    res.json(danhSach);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// Lịch sử làm bài (admin/teacher xem theo tên)
exports.timTheoTen = async (req, res) => {
  try {
    const { ten } = req.query;
    const danhSach = await LuotLamBai.find({
      tenNguoiLam: { $regex: ten, $options: "i" },
    })
      .populate("baiKiemTraId", "tieuDe")
      .populate("baiHocId", "tieuDe")
      .sort({ createdAt: -1 });
    res.json(danhSach);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};