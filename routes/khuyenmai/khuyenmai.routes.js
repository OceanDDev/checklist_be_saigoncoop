// routes/move/khuyenmai.routes.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const khuyenMaiController = require("../../controllers/khuyenmai/khuyenmai.controller");

// Lưu file tạm trong memory (buffer) — parser đọc trực tiếp từ buffer,
// không cần ghi ra ổ đĩa.
const upload = multer({ storage: multer.memoryStorage() });

// ⚠️ Đặt các route tĩnh ("/import", "/match-import") và bulk "/" (DELETE)
// TRƯỚC route "/:id" để tránh Express hiểu nhầm là 1 giá trị :id.

// GET /khuyenmai — danh sách (phân trang + lọc + sort ưu tiên trangThai)
router.get("/khuyenmai", khuyenMaiController.getAll);

// POST /khuyenmai/match-import — upload 2 file (excelFile + txtFile),
// tự parse + so khớp luong_onhand vs luong_mms, ghi đè toàn bộ dữ liệu.
router.post(
  "/khuyenmai/match-import",
  upload.fields([
    { name: "excelFile", maxCount: 1 },
    { name: "txtFile", maxCount: 1 },
  ]),
  khuyenMaiController.matchImport,
);

// POST /khuyenmai/import — import nhiều dòng cùng lúc (upsert theo lpn+sku)
router.post("/khuyenmai/import", khuyenMaiController.importMany);

router.delete("/khuyenmai/all", khuyenMaiController.deleteAll);

// DELETE /khuyenmai — xoá nhiều theo danh sách id, body: { ids: [...] }
router.delete("/khuyenmai", khuyenMaiController.deleteMany);

// POST /khuyenmai — tạo 1 bản ghi
router.post("/khuyenmai", khuyenMaiController.create);

// GET /khuyenmai/:id — xem chi tiết 1 bản ghi
router.get("/khuyenmai/:id", khuyenMaiController.getById);

// PUT /khuyenmai/:id — cập nhật 1 bản ghi
router.put("/khuyenmai/:id", khuyenMaiController.update);

// DELETE /khuyenmai/:id — xoá 1 bản ghi
router.delete("/khuyenmai/:id", khuyenMaiController.deleteOne);

module.exports = router;