const express = require("express");
const router = express.Router();
const chamCongController = require("../../controllers/chamcong/chamcong.controller");

router.post("/cham-cong/check",chamCongController.chamCong );          // chấm công vào/ra
router.get("/cham-cong", chamCongController.getDanhSach);                  // danh sách (filter theo query)
router.get("/cham-cong/:id", chamCongController.getChiTiet);               // chi tiết 1 bản ghi
router.patch("/cham-cong/:id/ghi-chu", chamCongController.updateGhiChu);   // cập nhật ghi chú
router.delete("/cham-cong/:id", chamCongController.xoaChamCong);           // xóa bản ghi

module.exports = router;