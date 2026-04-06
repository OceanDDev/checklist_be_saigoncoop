const express = require("express");
const router = express.Router();
const chamCongController = require("../../controllers/chamcong/chamcong.controller");
const nhanVienController = require("../../controllers/chamcong/nhanvien.controller");
const qrController = require("../../controllers/chamcong/qr.controller");
const { verifyToken } = require("../../middlewares/authMiddleware");

function kiemTraGioHoatDong(req, res, next) {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const tongPhut = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
  if (tongPhut < 390 || tongPhut >= 1320) {
    // 6:30 = 390, 22:00 = 1320
    return res.status(403).json({
      message: "Hệ thống chỉ hoạt động từ 06:30 đến 22:00.",
      code: "OUTSIDE_WORKING_HOURS",
    });
  }
  next();
}
// ── QR (public - nhân viên chấm công không cần login) ─────────────   ───────────
router.get("/chamcong/qr/current", qrController.getCurrentQr);
router.get("/chamcong/qr/validate", qrController.validateQrToken);
router.post(
  "/chamcong/check-qr",
  kiemTraGioHoatDong,
  qrController.kiemTraQrToken,
  chamCongController.kiemTraGPS,
  chamCongController.kiemTraNhanVien,
  chamCongController.kiemTraDeviceId,
  chamCongController.chamCong,
);
router.post(
  "/chamcong/check",
  chamCongController.kiemTraGPS,
  chamCongController.kiemTraNhanVien,
  chamCongController.kiemTraDeviceId,
  chamCongController.chamCong,
);
router.get("/chamcong/trang-thai-hom-nay", chamCongController.trangThaiHomNay);
router.get("/nhanvien/:ma_nhan_vien", nhanVienController.traCuuNhanVien);

// ── Chấm công (admin - cần login) ────────────────────────────────────────────
router.post(
  "/chamcong/admin-add",
  verifyToken,
  chamCongController.adminAddChamCong,
);
router.post(
  "/chamcong/import-nang-suat",
  verifyToken,
  chamCongController.importNangSuat,
);
router.post(
  "/chamcong/delete-many",
  verifyToken,
  chamCongController.deleteManyChamCong,
);
router.patch(
  "/chamcong/:id/admin-edit",
  verifyToken,
  chamCongController.adminEditChamCong,
);
router.patch(
  "/chamcong/:id/ghi-chu",
  verifyToken,
  chamCongController.updateGhiChu,
);
router.patch(
  "/chamcong/:id/toggle-khoa",
  verifyToken,
  chamCongController.toggleKhoa,
);

router.get("/chamcong", verifyToken, chamCongController.getDanhSach);
router.get("/chamcong/:id", verifyToken, chamCongController.getChiTiet);
router.delete("/chamcong/:id", verifyToken, chamCongController.xoaChamCong);

// ── Nhân viên (admin - cần login) ────────────────────────────────────────────
router.get("/nhanvien", verifyToken, nhanVienController.getDanhSach);
router.post("/nhanvien", verifyToken, nhanVienController.themNhanVien);
router.post(
  "/nhanvien/import",
  verifyToken,
  nhanVienController.themNhieuNhanVien,
);
router.patch("/nhanvien/:id", verifyToken, nhanVienController.capNhatNhanVien);
router.patch(
  "/nhanvien/:id/toggle",
  verifyToken,
  nhanVienController.toggleActive,
);
router.delete("/nhanvien/:id", verifyToken, nhanVienController.xoaNhanVien);

module.exports = router;
