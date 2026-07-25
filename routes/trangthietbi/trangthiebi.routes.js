const express = require("express");
const multer = require("multer");
const router = express.Router();
const verifyToken = require("../../middlewares/apiKeyAuth"); // chỉnh lại path cho đúng vị trí middleware của bạn

const upload = multer({ storage: multer.memoryStorage() });

const {
  getAllTrangThietBi,
  getDistinctLoaiTTB,
  getByIdTrangThietBi,
  createOneTrangThietBi,
  createManyTrangThietBi,
  updateOneTrangThietBi,
  bulkUpdateTrangThietBi,
  deleteOneTrangThietBi,
  bulkDeleteTrangThietBi,
  deleteAllTrangThietBi,
} = require("../../controllers/trangthietbi/trangthietbi.controller");

const {
  getBangTonKho,
  getByIdTonKho,
  chotKyTheoCuaHang,
  updateTonKho,
  deleteTonKho,
} = require("../../controllers/trangthietbi/tonkhocuahang.controller");

// ===== TrangThietBi: routes tĩnh (đứng trước /:id) =====
router.get("/trang-thiet-bi", verifyToken, getAllTrangThietBi);
// Danh sách loại TTB (distinct trực tiếp từ dữ liệu, không cần danh mục riêng)
router.get("/trang-thiet-bi/loai-ttb", verifyToken, getDistinctLoaiTTB);
router.post("/trang-thiet-bi", verifyToken, createOneTrangThietBi);
router.post(
  "/trang-thiet-bi/bulk-create",
  verifyToken,
  upload.single("file"),
  createManyTrangThietBi,
);
router.put("/trang-thiet-bi/bulk-update", verifyToken, bulkUpdateTrangThietBi);
router.delete(
  "/trang-thiet-bi/bulk-delete",
  verifyToken,
  bulkDeleteTrangThietBi,
);
router.delete("/trang-thiet-bi/delete-all", verifyToken, deleteAllTrangThietBi);

// ===== TrangThietBi: routes động (/:id) =====
router.get("/trang-thiet-bi/:id", verifyToken, getByIdTrangThietBi);
router.put("/trang-thiet-bi/:id", verifyToken, updateOneTrangThietBi);
router.delete("/trang-thiet-bi/:id", verifyToken, deleteOneTrangThietBi);

// ===== Tồn Kho Theo Cửa Hàng: routes tĩnh (đứng trước /:id) =====
// GET /ton-kho-cua-hang?ky=2026-06&ma_ch=112&loai_ttb=Tote Nhua
router.get("/ton-kho-cua-hang", verifyToken, getBangTonKho);
// POST /ton-kho-cua-hang/chot-ky   body: { "ky": "2026-06" }
router.post("/ton-kho-cua-hang/chot-ky", verifyToken, chotKyTheoCuaHang);

// ===== Tồn Kho Theo Cửa Hàng: routes động (/:id) =====
router.get("/ton-kho-cua-hang/:id", verifyToken, getByIdTonKho);
router.put("/ton-kho-cua-hang/:id", verifyToken, updateTonKho);
router.delete("/ton-kho-cua-hang/:id", verifyToken, deleteTonKho);

module.exports = router;