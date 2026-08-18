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
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`,
    ),
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

/**
 * Bọc upload.fields(...) lại để bắt được LỖI MULTER (vượt dung lượng, sai định dạng,
 * lỗi ghi disk giữa chừng do mất kết nối...) và trả về JSON rõ ràng thay vì để Express
 * rơi vào error handler mặc định (thường trả HTML/stack trace, FE không parse được).
 *
 * Đồng thời: nếu multer đã lỡ ghi một phần file lên disk trước khi lỗi xảy ra (VD do
 * kết nối bị reset giữa chừng — đúng kiểu lỗi mạng nội bộ đã gặp), ta chủ động dọn
 * file rác đó luôn, tránh tích file mồ côi trong uploadDir theo thời gian.
 */
function uploadFields(fieldName) {
  const middleware = upload.fields([{ name: fieldName, maxCount: 1 }]);

  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        // Dọn mọi file đã lỡ ghi lên disk trước khi lỗi xảy ra (nếu có)
        const uploadedFiles = Object.values(req.files || {}).flat();
        for (const f of uploadedFiles) {
          fs.unlink(f.path, () => {});
        }

        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res
              .status(400)
              .json({ message: "File vượt quá dung lượng cho phép (200MB)" });
          }
          return res
            .status(400)
            .json({ message: `Lỗi upload: ${err.message}` });
        }

        // Lỗi từ fileFilter (sai định dạng) hoặc lỗi ghi disk khác
        return res.status(400).json({
          message: err.message || "Upload thất bại, vui lòng thử lại",
        });
      }

      const file = req.files?.[fieldName]?.[0];
      if (!file) {
        return res.status(400).json({ message: `Cần upload ${fieldName}` });
      }
      // Chặn sớm file rỗng (VD người dùng chọn nhầm file tạm ~$ của Excel đang mở)
      if (file.size === 0) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({
          message:
            "File rỗng hoặc không hợp lệ (có thể file Excel gốc đang được mở — hãy đóng file rồi chọn lại)",
        });
      }

      next();
    });
  };
}

router.get("/quanlyhd", quanlyhdController.getDanhSach);
router.patch(
  "/quanlyhd/:id/xac-nhan-hoan-thanh",
  quanlyhdController.xacNhanHoanThanh,
);

// POST /quanlyhd/import-wms — form-data field "file_wms"
router.post(
  "/quanlyhd/import-wms",
  uploadFields("file_wms"),
  quanlyhdController.importWms,
);

// POST /quanlyhd/import-hd — form-data field "file_hd"
router.post(
  "/quanlyhd/import-hd",
  uploadFields("file_hd"),
  quanlyhdController.importHd,
);

module.exports = router;
