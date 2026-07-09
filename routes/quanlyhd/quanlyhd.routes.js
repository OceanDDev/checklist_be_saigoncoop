const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const quanlyhdController = require("../../controllers/quanlyhd/quanlyhd.controller");

// Đảm bảo thư mục tạm tồn tại trước khi multer ghi file vào đó
const uploadDir = path.join(__dirname, "../uploads/tmp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Dùng diskStorage (không phải memoryStorage) để không load cả file lớn vào RAM
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`,
    ),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB/file, tùy chỉnh theo nhu cầu
  fileFilter: (req, file, cb) => {
    const allowedExt = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      return cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"));
    }
    cb(null, true);
  },
});

// GET /quanlyhd
// Query: page, limit, ma_ch, sku, so_hoa_don, name, trangThai, tu_ngay_hoa_don,
// den_ngay_hoa_don, tu_ngay_import, den_ngay_import, sortBy, sortOrder
router.get("/quanlyhd", quanlyhdController.getDanhSach);
router.patch("/quanlyhd/:id/xac-nhan-hoan-thanh", quanlyhdController.xacNhanHoanThanh);

// POST /quanlyhd/import
// form-data gồm 2 field file: "file_wms" và "file_hd"
router.post(
  "/quanlyhd/import",
  upload.fields([
    { name: "file_wms", maxCount: 1 },
    { name: "file_hd", maxCount: 1 },
  ]),
  quanlyhdController.importQuanLyHD,
);

module.exports = router;
