const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const quanlyhdController = require("../../controllers/quanlyhd/quanlyhd.controller");

const uploadDir = path.join(__dirname, "../uploads/tmp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      return cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"));
    }
    cb(null, true);
  },
});

router.get("/quanlyhd", quanlyhdController.getDanhSach);
router.patch("/quanlyhd/:id/xac-nhan-hoan-thanh", quanlyhdController.xacNhanHoanThanh);

// POST /quanlyhd/import-wms — form-data field "file_wms"
router.post(
  "/quanlyhd/import-wms",
  upload.fields([{ name: "file_wms", maxCount: 1 }]),
  quanlyhdController.importWms,
);

// POST /quanlyhd/import-hd — form-data field "file_hd"
router.post(
  "/quanlyhd/import-hd",
  upload.fields([{ name: "file_hd", maxCount: 1 }]),
  quanlyhdController.importHd,
);

module.exports = router;