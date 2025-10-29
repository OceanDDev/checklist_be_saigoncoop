const express = require("express");
const router = express.Router();

const dinhViController = require("../../controllers/phieusoan/dinhvi.controller");
const donHangController = require("../../controllers/phieusoan/donhang.controller");
const phieuSoanController = require("../../controllers/phieusoan/phieusoan.controller");

// ==================== DINH VI ====================
router.post("/dinhvi/import", dinhViController.importManyDinhVi); // Import Excel
router.post("/dinhvi/clear-all", dinhViController.clearAllDinhVi); // Xóa toàn bộ
router.get("/dinhvi", dinhViController.getAllDinhVi); // Get all
router.get("/dinhvi/:id", dinhViController.getDinhViById); // Get by ID
router.post("/dinhvi", dinhViController.createDinhVi); // Create one
router.put("/dinhvi/:id", dinhViController.updateDinhVi); // Update
router.delete("/dinhvi/:id", dinhViController.deleteDinhVi); // Delete

// ==================== DON HANG ====================
router.get("/donhang/search", donHangController.searchDonHang); // Search
router.post("/donhang/many", donHangController.createManyDonHang); // Create many
router.post("/donhang/clear-all", donHangController.deleteManyDonHang); // Clear all
router.get("/donhang", donHangController.getAllDonHang); // Get all
router.post('/donhang/check-duplicate', donHangController.checkDuplicateDonHang);
router.get("/donhang/:id", donHangController.getDonHangById); // Get by ID
router.post("/donhang", donHangController.createDonHang); // Create one
router.put("/donhang/:id/trangthai", donHangController.updateTrangThai); // Update status
router.put("/donhang/:id", donHangController.updateDonHang); // Update
router.delete("/donhang/:id", donHangController.deleteDonHang); // Delete

// ==================== PHIEU SOAN ====================
// ✅ CRITICAL: Special routes MUST be BEFORE :id routes
// Đặt các routes có path cụ thể TRƯỚC các routes có :id parameter

// Statistics & Reports
router.get("/phieusoan/statistics", phieuSoanController.getStatistics); // Thống kê

// ✅ Special orders endpoints - UPDATED (MUST be before /:id)
router.get("/phieusoan/special-orders/count", phieuSoanController.getSpecialOrdersCount); // Đếm phiếu soạn pack=1
router.get("/phieusoan/special-orders", phieuSoanController.getSpecialOrders); // Lấy phiếu soạn pack=1

// ✅ Update chẵn/lẻ cho hàng đặc thù
router.post("/phieusoan/update-special-chan-le", phieuSoanController.updateSpecialChanLe);
router.put('/phieusoan/update-many', phieuSoanController.updateMany);

    
// Process orders
router.post("/phieusoan/process", phieuSoanController.processOrders); // Xử lý tất cả đơn hàng

// Bulk operations
router.post("/phieusoan/delete-many", phieuSoanController.deleteMany); // Xóa nhiều
router.post("/phieusoan/delete-all", phieuSoanController.deleteAll); // Xóa tất cả

// ✅ Standard CRUD routes (MUST be at the END)
router.get("/phieusoan", phieuSoanController.getAll); // Get all (có filter date)
router.get("/phieusoan/:id", phieuSoanController.getOne); // Get by ID
router.put("/phieusoan/:id", phieuSoanController.updateOne); // Update
router.patch("/phieusoan/:id/status", phieuSoanController.updateStatus); // Update status only
router.delete("/phieusoan/:id", phieuSoanController.deleteOne); // Delete one

module.exports = router;