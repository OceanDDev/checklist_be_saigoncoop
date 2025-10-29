const express = require("express");
const router = express.Router();
const cuahangController = require("../../../controllers/dieuvan/cuahang/cuahang.controller");

router.post("/cuahang", cuahangController.createCuahang);
router.get("/cuahang", cuahangController.getAllCuahang);
router.get("/cuahang/:id", cuahangController.getCuahangById);
router.put("/cuahang/:id", cuahangController.updateCuahang);
router.delete("/cuahang/:id", cuahangController.deleteCuahang);
router.post("/cuahang/bulk", cuahangController.createManyCuahang);
router.get("/cuahang/ma/:maCH", cuahangController.getCuahangByMaCH);

module.exports = router;
