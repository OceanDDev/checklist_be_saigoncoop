const express = require("express");
const router = express.Router();
const phuXeController = require("../../controllers/phuxe/phuxe.controller");

// ============================================
// PHỤ XE ROUTES
// ============================================

// Bulk operations (phải đặt trước các route có :id)
router.post("/phuxe/addmany", phuXeController.addManyPhuXe);

// CRUD operations
router.get("/phuxe", phuXeController.getAllPhuXe);
router.post(
  "/phuxe",
  phuXeController.autoCleanupMiddleware, // ✅ Auto cleanup trước upload
  phuXeController.uploadImage, // ✅ single("hinh_anh")
  phuXeController.addPhuXe
);
router.get("/phuxe/:id", phuXeController.getPhuXeById);
router.put(
  "/phuxe/:id",
  phuXeController.autoCleanupMiddleware, // ✅ Auto cleanup trước upload
  phuXeController.uploadImage, // ✅ FIXED: Đổi từ uploadImages → uploadImage
  phuXeController.updatePhuXe
);
router.delete("/phuxe/:id", phuXeController.deletePhuXe);

// Xác nhận điều vận
router.patch("/phuxe/:id/xac-nhan", phuXeController.xacNhanDieuVan);

// ============================================
// TÊN PHỤ XE ROUTES
// ============================================

router.get("/tenphuxe", phuXeController.getAllPhuXeNames);
router.post("/tenphuxe", phuXeController.addPhuXeName);
router.delete("/tenphuxe/:id", phuXeController.deletePhuXeName);

// ============================================
// CỬA HÀNG BẢO XE (CHBX) ROUTES
// ============================================

// Bulk operations (phải đặt trước các route có :id)
router.post("/chbx/addmany", phuXeController.addManyStores);

// CRUD operations
router.get("/chbx", phuXeController.getAllStores);
router.post("/chbx", phuXeController.createStore);
router.get("/chbx/:id", phuXeController.getStoreById);
router.put("/chbx/:id", phuXeController.updateStore);
router.delete("/chbx/:id", phuXeController.deleteStore);

module.exports = router;
