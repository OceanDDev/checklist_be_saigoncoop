const express = require("express");
const router = express.Router();
const baoTaiController = require("../../controllers/baotai/baotai.controller");

router.post("/baotai", baoTaiController.createOneBaoTai);
router.post("/baotai/sll", baoTaiController.createOneBaoTaiSLL);
router.get("/baotai", baoTaiController.getAllBaoTai);
router.get("/baotai/:id", baoTaiController.getByIdBaoTai);
router.put("/baotai/:id", baoTaiController.updateOneBaoTai);
router.patch("/baotai/:id/nv-tk-cong-xuat", baoTaiController.updateNvTkCongXuat);
router.delete("/baotai/:id", baoTaiController.deleteOneBaoTai);

router.post("/baotai/import-many", baoTaiController.createManyBaoTai);

module.exports = router;