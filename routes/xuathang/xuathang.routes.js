const express = require("express");
const router = express.Router();
const xuatHangController = require("../../controllers/xuathang/xuathang.controller"); // sửa lại đường dẫn cho đúng
const keHoachXeController = require("../../controllers/xuathang/kehoachxe.controller"); // sửa lại đường dẫn cho đúng

// ============ XUẤT HÀNG ============
// ============ IMPORT NHIỀU / UPSERT ============
// Đặt route này TRƯỚC route /:id để tránh bị nuốt bởi param
router.post("/xuathang/import-many", xuatHangController.importMany);

// ============ CRUD ============
router.get("/xuathang", xuatHangController.getAll);
router.get("/xuathang/:id", xuatHangController.getById);
router.post("/xuathang", xuatHangController.create);
router.put("/xuathang/:id", xuatHangController.update);
router.delete("/xuathang/:id", xuatHangController.remove);

// ============ KẾ HOẠCH XE ============
// Các route cố định (import-many, add-many, delete-many) đặt TRƯỚC route /:id
router.post("/kehoachxe/import-many", keHoachXeController.importMany);
router.post("/kehoachxe/add-many", keHoachXeController.addMany);
router.post("/kehoachxe/delete-many", keHoachXeController.deleteMany);

router.get("/kehoachxe", keHoachXeController.getAll);
router.get("/kehoachxe/:id", keHoachXeController.getById);
router.post("/kehoachxe", keHoachXeController.create);
router.put("/kehoachxe/:id", keHoachXeController.update);
router.delete("/kehoachxe/:id", keHoachXeController.remove);

module.exports = router;
