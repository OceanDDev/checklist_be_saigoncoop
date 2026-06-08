const BaiKiemTra = require("../../models/learningSCL/BaiKiemTra");
const BaiHoc = require("../../models/learningSCL/BaiHoc");
const jwt = require("jsonwebtoken");

// ── Helpers ────────────────────────────────────────────────────────────────

const sinhQrToken = (baiKiemTraId) =>
  jwt.sign(
    { baiKiemTraId: String(baiKiemTraId), loai: "qr_truy_cap" },
    process.env.JWT_SECRET,
    // Không set expiresIn — kiểm soát qua trangThai
  );

const anDapAn = (danhSachCauHoi) =>
  danhSachCauHoi.map(({ dapAnDung, giaiThich, ...an }) => an);

const tinhDiem = (danhSachCauHoi, danhSachCauTraLoi = [], diemDauVao = 60) => {
  const tongSoCau = danhSachCauHoi.length;
  if (!tongSoCau) return { diem: 0, soCauDung: 0, tongSoCau: 0, dat: false };

  // Map theo index câu hỏi
  const mapTraLoi = {};
  danhSachCauTraLoi.forEach((tl) => {
    mapTraLoi[tl.cauHoiIndex] = tl.dapAnChon;
  });

  let soCauDung = 0;
  danhSachCauHoi.forEach((cau, idx) => {
    if (mapTraLoi[idx] === cau.dapAnDung) soCauDung++;
  });

  const diem = Math.round((soCauDung / tongSoCau) * 100);
  return { diem, soCauDung, tongSoCau, dat: diem >= diemDauVao };
};

// ── Tạo mới ───────────────────────────────────────────────────────────────

/**
 * POST /bai-kiem-tra
 * Tạo quiz + tự sinh QR luôn.
 * Body: { tieuDe, moTa?, baiHocId?, danhSachCauHoi[], caiDat? }
 */
exports.taoMoi = async (req, res) => {
  try {
    const {
      cauHoi,
      thoiGianLamBai,
      diemDauVao,
      soLanLamToiDa,
      troLaiXemDapAn,
      khoaHocId,
      ...rest
    } = req.body;

    // Map frontend format → schema format
    const danhSachCauHoi = (cauHoi || []).map((c) => ({
      noiDung: c.noiDung,
      cacLuaChon: c.dapAn, // frontend gửi "dapAn" → schema dùng "cacLuaChon"
      dapAnDung: c.dapAnDung,
      giaiThich: c.giaiThich || "",
    }));

    const baiKiemTra = await BaiKiemTra.create({
      ...rest,
      danhSachCauHoi,
      caiDat: {
        diemDauVao: diemDauVao ?? 60,
        soLanToiDa: soLanLamToiDa ?? 0,
        hienThiKetQua: troLaiXemDapAn ?? true,
        thoiGianLamBai: thoiGianLamBai ?? 0, // ← thêm dòng này
      },
      nguoiTao: req.user.id,
      trangThai: "nhap",
    });

    // Sinh QR
    const qrToken = sinhQrToken(baiKiemTra._id);
    const qrUrl = `${process.env.FRONTEND_URL}/lam-bai?token=${qrToken}`;
    baiKiemTra.qrToken = qrToken;
    baiKiemTra.qrUrl = qrUrl;
    await baiKiemTra.save();

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
// ── Lấy 1 bài (không kèm ketQua) ─────────────────────────────────────────

/**
 * GET /bai-kiem-tra/:id
 */
exports.layMot = async (req, res) => {
  try {
    // Mặc định không trả ketQua (dùng xemKetQua riêng)
    const baiKiemTra = await BaiKiemTra.findById(req.params.id).select(
      "-ketQua",
    );
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    const ketQua = baiKiemTra.toObject();
    if (req.user.role !== "admin" && req.user.role !== "teacher") {
      ketQua.danhSachCauHoi = anDapAn(ketQua.danhSachCauHoi);
    }

    res.json(ketQua);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// ── Cập nhật ──────────────────────────────────────────────────────────────

/**
 * PUT /bai-kiem-tra/:id
 * Chỉ cho phép sửa khi trangThai = "nhap"
 */
exports.capNhat = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai !== "nhap")
      return res.status(400).json({
        loi: "Không thể sửa bài kiểm tra đang mở hoặc đã kết thúc",
      });

    // Bảo vệ các field hệ thống
    const {
      qrToken,
      qrUrl,
      trangThai,
      thoiGianMo,
      thoiGianKetThuc,
      ketQua,
      ...body
    } = req.body;

    const updated = await BaiKiemTra.findByIdAndUpdate(req.params.id, body, {
      new: true,
    }).select("-ketQua");

    res.json(updated);
  } catch (err) {
    res.status(400).json({ loi: err.message });
  }
};

// ── Xóa ──────────────────────────────────────────────────────────────────

/**
 * DELETE /bai-kiem-tra/:id
 */
exports.xoa = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findByIdAndDelete(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

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

// ── Mở phiên ─────────────────────────────────────────────────────────────

/**
 * POST /bai-kiem-tra/:id/mo-phien
 */
exports.moPhien = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai === "dang_mo")
      return res.status(400).json({ loi: "Phiên đã được mở rồi" });

    if (baiKiemTra.trangThai === "da_ket_thuc")
      return res
        .status(400)
        .json({ loi: "Phiên đã kết thúc, không thể mở lại" });

    baiKiemTra.trangThai = "dang_mo";
    baiKiemTra.thoiGianMo = new Date();
    await baiKiemTra.save();

    res.json({
      thongBao: "Đã mở phiên làm bài",
      qrUrl: baiKiemTra.qrUrl,
      thoiGianMo: baiKiemTra.thoiGianMo,
    });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// ── Kết thúc phiên ────────────────────────────────────────────────────────

/**
 * POST /bai-kiem-tra/:id/ket-thuc
 * Đóng phiên — ai đang làm dở (thoiGianBatDau có nhưng thoiGianNop null)
 * sẽ bị đánh dấu tuDongNop = true, tính điểm với những câu đã chọn.
 */
exports.ketThuc = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai !== "dang_mo")
      return res.status(400).json({ loi: "Phiên chưa được mở" });

    const thoiGianKetThuc = new Date();
    const diemDauVao = baiKiemTra.caiDat.diemDauVao;

    // Tính điểm cho những ai chưa nộp (thoiGianNop = null)
    let soChuaNop = 0;
    baiKiemTra.ketQua.forEach((kq) => {
      if (!kq.thoiGianNop) {
        const { diem, soCauDung, tongSoCau, dat } = tinhDiem(
          baiKiemTra.danhSachCauHoi,
          kq.danhSachCauTraLoi,
          diemDauVao,
        );
        kq.thoiGianNop = thoiGianKetThuc;
        kq.thoiGianLamBai = Math.round(
          (thoiGianKetThuc - kq.thoiGianBatDau) / 1000,
        );
        kq.diem = diem;
        kq.soCauDung = soCauDung;
        kq.tongSoCau = tongSoCau;
        kq.dat = dat;
        kq.tuDongNop = true;
        soChuaNop++;
      }
    });

    baiKiemTra.trangThai = "da_ket_thuc";
    baiKiemTra.thoiGianKetThuc = thoiGianKetThuc;
    await baiKiemTra.save();

    res.json({
      thongBao: "Đã kết thúc phiên làm bài",
      soLuotTuDongNop: soChuaNop,
      thoiGianKetThuc,
    });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// ── Xác thực QR → trả đề ─────────────────────────────────────────────────

/**
 * GET /bai-kiem-tra/xac-thuc-qr?token=...
 * Học viên quét QR → lấy đề bài (ẩn đáp án).
 * Trả về thêm ketQuaId tạm để dùng khi nộp bài.
 */
exports.xacThucQR = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ loi: "Thiếu token" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ hopLe: false, loi: "Token không hợp lệ" });
    }

    if (decoded.loai !== "qr_truy_cap")
      return res.status(403).json({ hopLe: false, loi: "Sai loại token" });

    const baiKiemTra = await BaiKiemTra.findById(decoded.baiKiemTraId).select(
      "-ketQua", // không cần trả ketQua cho học viên
    );
    if (!baiKiemTra)
      return res
        .status(404)
        .json({ hopLe: false, loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai === "nhap")
      return res.status(403).json({ hopLe: false, loi: "Phiên chưa được mở" });

    if (baiKiemTra.trangThai === "da_ket_thuc")
      return res
        .status(403)
        .json({ hopLe: false, loi: "Phiên làm bài đã kết thúc" });

    const de = baiKiemTra.toObject();
    de.danhSachCauHoi = anDapAn(de.danhSachCauHoi);

    res.json({ hopLe: true, baiKiemTra: de });
  } catch (err) {
    res.status(500).json({ hopLe: false, loi: err.message });
  }
};

// ── Bắt đầu làm bài ──────────────────────────────────────────────────────

/**
 * POST /bai-kiem-tra/:id/bat-dau
 * Học viên nhập tên → tạo slot kết quả, trả về ketQuaId để track.
 * Body: { tenNguoiLam }
 */
exports.batDau = async (req, res) => {
  try {
    const { tenNguoiLam } = req.body;
    if (!tenNguoiLam?.trim())
      return res.status(400).json({ loi: "Vui lòng nhập tên" });

    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai !== "dang_mo")
      return res.status(403).json({ loi: "Phiên không còn hoạt động" });

    // Kiểm tra số lần tối đa
    const soLanToiDa = baiKiemTra.caiDat.soLanToiDa;
    if (soLanToiDa > 0) {
      const soLanDaLam = baiKiemTra.ketQua.filter(
        (kq) =>
          kq.tenNguoiLam.toLowerCase() === tenNguoiLam.trim().toLowerCase(),
      ).length;
      if (soLanDaLam >= soLanToiDa)
        return res.status(403).json({
          loi: `Bạn đã làm tối đa ${soLanToiDa} lần`,
        });
    }

    // Tạo slot kết quả trống
    baiKiemTra.ketQua.push({
      tenNguoiLam: tenNguoiLam.trim(),
      thoiGianBatDau: new Date(),
      danhSachCauTraLoi: [],
      tongSoCau: baiKiemTra.danhSachCauHoi.length,
    });

    await baiKiemTra.save();

    // Trả về _id của slot vừa tạo
    const slot = baiKiemTra.ketQua[baiKiemTra.ketQua.length - 1];

    res.json({
      ketQuaId: slot._id,
      tongSoCau: baiKiemTra.danhSachCauHoi.length,
      thoiGianBatDau: slot.thoiGianBatDau,
    });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// ── Nộp bài ───────────────────────────────────────────────────────────────

/**
 * POST /bai-kiem-tra/:id/nop-bai
 * Body: { ketQuaId, danhSachCauTraLoi: [{ cauHoiIndex, dapAnChon }] }
 */
exports.nopBai = async (req, res) => {
  try {
    const { ketQuaId, danhSachCauTraLoi = [] } = req.body;
    if (!ketQuaId) return res.status(400).json({ loi: "Thiếu ketQuaId" });

    const baiKiemTra = await BaiKiemTra.findById(req.params.id);
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    if (baiKiemTra.trangThai === "nhap")
      return res.status(403).json({ loi: "Phiên chưa được mở" });

    // Tìm slot
    const slot = baiKiemTra.ketQua.id(ketQuaId);
    if (!slot)
      return res.status(404).json({ loi: "Không tìm thấy lượt làm bài" });
    if (slot.thoiGianNop)
      return res.status(400).json({ loi: "Bài đã được nộp rồi" });

    const thoiGianNop = new Date();
    const { diem, soCauDung, tongSoCau, dat } = tinhDiem(
      baiKiemTra.danhSachCauHoi,
      danhSachCauTraLoi,
      baiKiemTra.caiDat.diemDauVao,
    );

    slot.danhSachCauTraLoi = danhSachCauTraLoi;
    slot.thoiGianNop = thoiGianNop;
    slot.thoiGianLamBai = Math.round(
      (thoiGianNop - slot.thoiGianBatDau) / 1000,
    );
    slot.diem = diem;
    slot.soCauDung = soCauDung;
    slot.tongSoCau = tongSoCau;
    slot.dat = dat;

    await baiKiemTra.save();

    // Nếu caiDat.hienThiKetQua = false → không trả điểm chi tiết
    if (!baiKiemTra.caiDat.hienThiKetQua) {
      return res.json({ thongBao: "Nộp bài thành công" });
    }

    // Trả kết quả kèm giải thích từng câu
    const chiTiet = baiKiemTra.danhSachCauHoi.map((cau, idx) => {
      const traLoi = danhSachCauTraLoi.find((tl) => tl.cauHoiIndex === idx);
      return {
        cauHoiIndex: idx,
        noiDung: cau.noiDung,
        cacLuaChon: cau.cacLuaChon,
        dapAnDung: cau.dapAnDung,
        dapAnChon: traLoi?.dapAnChon ?? null,
        dung: traLoi?.dapAnChon === cau.dapAnDung,
        giaiThich: cau.giaiThich,
      };
    });

    res.json({
      thongBao: "Nộp bài thành công",
      diem,
      soCauDung,
      tongSoCau,
      dat,
      thoiGianLamBai: slot.thoiGianLamBai,
      chiTiet,
    });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

// ── Xem kết quả (admin/teacher) ───────────────────────────────────────────

/**
 * GET /bai-kiem-tra/:id/ket-qua
 * Trả về bảng kết quả để hiển thị table điểm.
 * Query: ?sapXep=diem|ten|thoiGian&thuTu=asc|desc
 */
exports.xemKetQua = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findById(req.params.id).select(
      "tieuDe trangThai thoiGianMo thoiGianKetThuc caiDat.diemDauVao ketQua",
    );
    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    const { sapXep = "thoiGianNop", thuTu = "asc" } = req.query;

    const sapXepMap = {
      diem: (a, b) => a.diem - b.diem,
      ten: (a, b) => a.tenNguoiLam.localeCompare(b.tenNguoiLam, "vi"),
      thoiGianNop: (a, b) => new Date(a.thoiGianNop) - new Date(b.thoiGianNop),
      thoiGianLam: (a, b) => (a.thoiGianLamBai ?? 0) - (b.thoiGianLamBai ?? 0),
    };

    const fn = sapXepMap[sapXep] ?? sapXepMap.thoiGianNop;
    const dsMoi = [...baiKiemTra.ketQua].sort(
      thuTu === "desc" ? (a, b) => fn(b, a) : fn,
    );

    // Thống kê nhanh
    const daNop = dsMoi.filter((kq) => kq.thoiGianNop);
    const tongDat = daNop.filter((kq) => kq.dat).length;
    const diemTB = daNop.length
      ? Math.round(daNop.reduce((s, kq) => s + kq.diem, 0) / daNop.length)
      : 0;

    res.json({
      tieuDe: baiKiemTra.tieuDe,
      trangThai: baiKiemTra.trangThai,
      thoiGianMo: baiKiemTra.thoiGianMo,
      thoiGianKetThuc: baiKiemTra.thoiGianKetThuc,
      diemDauVao: baiKiemTra.caiDat.diemDauVao,
      thongKe: {
        tongSoNguoi: dsMoi.length,
        soNguoiDaLam: daNop.length,
        soNguoiDat: tongDat,
        diemTrungBinh: diemTB,
      },
      ketQua: dsMoi.map((kq, idx) => ({
        stt: idx + 1,
        _id: kq._id,
        tenNguoiLam: kq.tenNguoiLam,
        diem: kq.diem,
        soCauDung: kq.soCauDung,
        tongSoCau: kq.tongSoCau,
        dat: kq.dat,
        thoiGianLamBai: kq.thoiGianLamBai, // giây
        thoiGianNop: kq.thoiGianNop,
        tuDongNop: kq.tuDongNop,
      })),
    });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

exports.layTatCa = async (req, res) => {
  try {
    const danhSach = await BaiKiemTra.find()
      .select("-ketQua")
      .sort({ createdAt: -1 });
    res.json(danhSach);
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};

exports.resetPhien = async (req, res) => {
  try {
    const baiKiemTra = await BaiKiemTra.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: "nhap",
        thoiGianMo: null,
        thoiGianKetThuc: null,
        ketQua: [], // xóa toàn bộ kết quả người làm
      },
      { new: true },
    ).select("-ketQua");

    if (!baiKiemTra)
      return res.status(404).json({ loi: "Không tìm thấy bài kiểm tra" });

    res.json({ thongBao: "Đã reset phiên", baiKiemTra });
  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
};
