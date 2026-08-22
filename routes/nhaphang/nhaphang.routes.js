const express = require("express");
const router = express.Router();
const nhapHangController = require("../../controllers/nhaphang/nhaphang.controller");
const qcDacThuController = require("../../controllers/nhaphang/qcdacthu.controller");

// ─────────────────────────────────────────────
// NHẬP HÀNG
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// QC ĐẶC THÙ
// ─────────────────────────────────────────────
// CRUD cơ bản
router.post("/qcdacthu", qcDacThuController.create);
router.get("/qcdacthu", qcDacThuController.getAll);
router.get("/qcdacthu/:id", qcDacThuController.getOne);
router.put("/qcdacthu/:id", qcDacThuController.update);
router.delete("/qcdacthu/:id", qcDacThuController.remove);

// Bulk operations
router.post("/qcdacthu/import-many", qcDacThuController.importMany);
router.put("/qcdacthu/update-many", qcDacThuController.updateMany);
router.delete("/qcdacthu/delete-many", qcDacThuController.deleteMany);

module.exports = router;