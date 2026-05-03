const express = require("express");
const router = express.Router();
const { verifyToken: auth } = require("../../middlewares/authMiddleware");
const role = require("../../middlewares/role");
const {
  uploadTaiLieu,
  uploadTaiLieuToB2,
} = require("../../middlewares/uploadLearning");
const { uploadAnhBia } = require("../../middlewares/uploadLearning");

const khoaHocCtrl = require("../../controllers/learningSCL/course.controller");
const baiHocCtrl = require("../../controllers/learningSCL/lesson.controller");
const baiKiemTraCtrl = require("../../controllers/learningSCL/quiz.controller");
const luotLamBaiCtrl = require("../../controllers/learningSCL/attempt.controller");

// ─────────────────────────────────────────────
// KHÓA HỌC
// ─────────────────────────────────────────────
router.get("/khoa-hoc", khoaHocCtrl.layTatCa);
router.get("/khoa-hoc/:id", khoaHocCtrl.layMot);
router.post(
  "/khoa-hoc",
  auth,
  role(50),
  (req, res, next) => {
    uploadAnhBia(req, res, (err) => {
      if (err) return res.status(400).json({ loi: err.message });
      next();
    });
  },
  khoaHocCtrl.taoMoi,
);
router.put("/khoa-hoc/:id", auth, role(50), khoaHocCtrl.capNhat);
router.delete("/khoa-hoc/:id", auth, role(50), khoaHocCtrl.xoa);

// ─────────────────────────────────────────────
// BÀI HỌC
// ─────────────────────────────────────────────
router.post("/bai-hoc/khoa-hoc/:khoaHocId", auth, role(50), baiHocCtrl.taoMoi);
router.get("/bai-hoc/:id", auth, baiHocCtrl.layMot);
router.put("/bai-hoc/:id", auth, role(50), baiHocCtrl.capNhat);
router.delete("/bai-hoc/:id", auth, role(50), baiHocCtrl.xoa);

// Upload tài liệu → multer đọc vào RAM → đẩy lên B2
router.post(
  "/bai-hoc/:id/upload/tai-lieu",
  auth,
  role(50),
  (req, res, next) => {
    uploadTaiLieu(req, res, (err) => {
      if (err) return res.status(400).json({ loi: err.message });
      next();
    });
  },
  uploadTaiLieuToB2,
  baiHocCtrl.uploadTaiLieu,
);

// Lấy presigned URL để xem tài liệu (học viên gọi)
router.get(
  "/bai-hoc/:id/tai-lieu/:taiLieuId/url",
  auth,
  baiHocCtrl.layUrlTaiLieu,
);

// Xóa tài liệu
router.delete(
  "/bai-hoc/:id/tai-lieu/:taiLieuId",
  auth,
  role(50),
  baiHocCtrl.xoaTaiLieu,
);

// ─────────────────────────────────────────────
// BÀI KIỂM TRA
// ─────────────────────────────────────────────
router.post("/bai-kiem-tra", auth, role(50), baiKiemTraCtrl.taoMoi);
router.get("/bai-kiem-tra/xac-thuc-qr", baiKiemTraCtrl.xacThucQR);
router.get("/bai-kiem-tra/:id", auth, baiKiemTraCtrl.layMot);
router.put("/bai-kiem-tra/:id", auth, role(50), baiKiemTraCtrl.capNhat);
router.delete("/bai-kiem-tra/:id", auth, role(50), baiKiemTraCtrl.xoa);
router.post("/bai-kiem-tra/:id/tao-qr", auth, role(50), baiKiemTraCtrl.taoQR);

// ─────────────────────────────────────────────
// LƯỢT LÀM BÀI
// ─────────────────────────────────────────────
router.post("/luot-lam-bai/nop-qr", luotLamBaiCtrl.nopBaiQR);
router.get(
  "/luot-lam-bai/tat-ca/:id",
  auth,
  role(50),
  luotLamBaiCtrl.tatCaLuotLam,
);
router.get("/luot-lam-bai/tim-ten", auth, role(50), luotLamBaiCtrl.timTheoTen);

module.exports = router;
