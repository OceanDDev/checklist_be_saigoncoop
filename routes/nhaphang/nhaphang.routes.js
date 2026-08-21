const express = require("express");
const router = express.Router();
const nhapHangController = require("../../controllers/nhaphang/nhaphang.controller");

// CRUD cơ bản
router.post("/nhaphang", nhapHangController.create);
router.get("/nhaphang", nhapHangController.getAll);
router.get("/nhaphang/:id", nhapHangController.getOne);
router.put("/nhaphang/:id", nhapHangController.update);
router.delete("/nhaphang/:id", nhapHangController.remove);

// Bulk operations
router.post("/nhaphang/import-many", nhapHangController.importMany);
router.put("/nhaphang/update-many", nhapHangController.updateMany);
router.delete("/nhaphang/delete-many", nhapHangController.deleteMany);

module.exports = router;