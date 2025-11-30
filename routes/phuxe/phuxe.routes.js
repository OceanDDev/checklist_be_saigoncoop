const express = require("express");
const router = express.Router();
const phuXeController = require("../../controllers/phuxe/phuxe.controller"); // sửa tên file nếu cần

// CRUD routes
router.get("/phuxe", phuXeController.getAllPhuXe);
router.get("/phuxe/:id", phuXeController.getPhuXeById);
router.post("/phuxe", phuXeController.addPhuXe);
router.post("/phuxe/addmany", phuXeController.addManyPhuXe);
router.put("/phuxe/:id", phuXeController.updatePhuXe);
router.delete("/phuxe/:id", phuXeController.deletePhuXe);

router.get("/tenphuxe", phuXeController.getAllPhuXeNames);
router.post("/tenphuxe",phuXeController.addPhuXeName);
router.delete("/tenphuxe/:id",phuXeController.deletePhuXeName);

module.exports = router;
