const express = require("express");
const router = express.Router();
const phuXeController = require("../../controllers/phuxe/phuxe.controller");
const chbxController = require("../../controllers/phuxe/phuxe.controller");

// CRUD routes cho phụ xe
router.get("/phuxe", phuXeController.getAllPhuXe);
router.post("/phuxe/addmany", phuXeController.addManyPhuXe); // ⬅️ addmany trước /:id
router.post("/phuxe", phuXeController.uploadImage, phuXeController.addPhuXe);
router.get("/phuxe/:id", phuXeController.getPhuXeById);
router.put("/phuxe/:id", phuXeController.uploadImages, phuXeController.updatePhuXe);
router.delete("/phuxe/:id", phuXeController.deletePhuXe);

// Routes cho tên phụ xe
router.get("/tenphuxe", phuXeController.getAllPhuXeNames);
router.post("/tenphuxe", phuXeController.addPhuXeName);
router.delete("/tenphuxe/:id", phuXeController.deletePhuXeName);

// ⬅️ Routes cho CHBX - Thứ tự QUAN TRỌNG
router.post("/chbx/addmany", chbxController.addManyStores); // ⬅️ 1. addmany PHẢI LÊN TRƯỚC
router.get("/chbx", chbxController.getAllStores);            // ⬅️ 2. Sau đó mới get all
router.post("/chbx", chbxController.createStore);            // ⬅️ 3. Rồi post single
router.get("/chbx/:id", chbxController.getStoreById);        // ⬅️ 4. Cuối cùng các route có :id
router.put("/chbx/:id", chbxController.updateStore);
router.delete("/chbx/:id", chbxController.deleteStore);

module.exports = router;