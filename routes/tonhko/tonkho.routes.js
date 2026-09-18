const express = require("express");
const multer = require("multer");
const router = express.Router();
const tonKhoController = require("../../controllers/tonkho/tonkho.controller");

// Lưu file tạm trong memory (buffer) — parser đọc trực tiếp từ buffer,
// không cần ghi ra ổ đĩa.
const upload = multer({ storage: multer.memoryStorage() });

// ⚠️ Đặt các route tĩnh ("/import", "/match-import") và bulk "/" (DELETE)
// TRƯỚC route "/:id" để tránh Express hiểu nhầm là 1 giá trị :id.
  
// GET /khuyenmai — danh sách (phân trang + lọc + sort ưu tiên trangThai)
router.get("/tonkho", tonKhoController.getAll);

// POST /khuyenmai/match-import — upload 4 file cho 2 kho (810, 8101):
// mỗi kho gồm 1 file excel tồn kho + 1 file txt MMS. Tự parse + validate
// header "Store <số>: ..." của từng file txt khớp đúng kho, so khớp
// luong_onhand vs luong_mms, ghi đè toàn bộ dữ liệu (cả 2 kho).
router.post(
  "/tonkho/match-import",
  upload.fields([
    { name: "excel810", maxCount: 1 },
    { name: "txt810", maxCount: 1 },
    { name: "excel8101", maxCount: 1 },
    { name: "txt8101", maxCount: 1 },
  ]),
  tonKhoController.matchImport,
);

// POST /khuyenmai/import — import nhiều dòng cùng lúc (upsert theo lpn+sku)
router.post("/tonkho/import", tonKhoController.importMany);

router.delete("/tonkho/all", tonKhoController.deleteAll);

// DELETE /khuyenmai — xoá nhiều theo danh sách id, body: { ids: [...] }
router.delete("/tonkho", tonKhoController.deleteMany);

// POST /khuyenmai — tạo 1 bản ghi
router.post("/tonkho", tonKhoController.create);

// GET /khuyenmai/:id — xem chi tiết 1 bản ghi
router.get("/tonkho/:id", tonKhoController.getById);

// PUT /khuyenmai/:id — cập nhật 1 bản ghi
router.put("/tonkho/:id", tonKhoController.update);

// DELETE /khuyenmai/:id — xoá 1 bản ghi
router.delete("/tonkho/:id", tonKhoController.deleteOne);

module.exports = router;