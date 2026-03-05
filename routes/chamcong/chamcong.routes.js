const express = require("express");
const router = express.Router();
const chamCongController = require("../../controllers/chamcong/chamcong.controller");
const nhanVienController = require("../../controllers/chamcong/nhanvien.controller");
const qrController = require("../../controllers/chamcong/qr.controller");

// ── QR ───────────────────────────────────────────────────────────────────────
router.get("/chamcong/qr/current", qrController.getCurrentQr);
router.post(
  "/chamcong/check-qr",
  qrController.kiemTraQrToken,
  chamCongController.kiemTraGPS, // ✅ thêm lại
  chamCongController.kiemTraNhanVien,
  chamCongController.chamCong,
);

// ── Chấm công ─────────────────────────────────────────────────────────────────
router.post(
  "/chamcong/check",
  chamCongController.kiemTraGPS,
  chamCongController.kiemTraNhanVien,
  chamCongController.chamCong,
);

// ✅ Route tĩnh trước route động 
router.get("/chamcong/trang-thai-hom-nay", chamCongController.trangThaiHomNay);
router.post("/chamcong/delete-many", chamCongController.deleteManyChamCong);
router.get("/chamcong", chamCongController.getDanhSach);
router.get("/chamcong/:id", chamCongController.getChiTiet);
router.patch("/chamcong/:id/ghi-chu", chamCongController.updateGhiChu);
router.delete("/chamcong/:id", chamCongController.xoaChamCong);

// ── Nhân viên ─────────────────────────────────────────────────────────────────
router.get("/nhanvien", nhanVienController.getDanhSach);
router.post("/nhanvien", nhanVienController.themNhanVien);
router.post("/nhanvien/import", nhanVienController.themNhieuNhanVien);
router.get("/nhanvien/:ma_nhan_vien", nhanVienController.traCuuNhanVien);
router.patch("/nhanvien/:id", nhanVienController.capNhatNhanVien);
router.patch("/nhanvien/:id/toggle", nhanVienController.toggleActive);
router.delete("/nhanvien/:id", nhanVienController.xoaNhanVien);

module.exports = router;
