// routes/xuatTra.routes.js
const express = require("express");
const router = express.Router();
const xuatTraCtrl = require("../../../controllers/dieuvan/xuattra/xuattra.controller");

// Tạo mới
router.post("/xuattra", xuatTraCtrl.createXuatTra);

// Lấy tất cả (có thể lọc ?trangThai=true/false)
router.get("/xuattra", xuatTraCtrl.getAllXuatTra);

// Lấy 1 phiếu theo id
router.get("/xuattra/:id", xuatTraCtrl.getXuatTraById);

// Cập nhật 1 phiếu
router.put("/xuattra/:id", xuatTraCtrl.updateXuatTra);

// Xóa 1 phiếu
router.delete("/xuattra/:id", xuatTraCtrl.deleteXuatTra);

module.exports = router;
