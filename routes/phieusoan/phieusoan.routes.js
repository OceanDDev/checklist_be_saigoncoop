const express = require("express");
const router = express.Router();

const dinhViController = require("../../controllers/phieusoan/dinhvi.controller");
const donHangController = require("../../controllers/phieusoan/donhang.controller");
const phieuSoanController = require("../../controllers/phieusoan/phieusoan.controller");
const phanBoController = require("../../controllers/phieusoan/phanbo.controller");
const phanBoCSController = require("../../controllers/phieusoan/phanbocs.controller");
const { verifyToken } = require("../../middlewares/authMiddleware");

// ==================== DINH VI ====================
router.post("/dinhvi/import", verifyToken, dinhViController.importManyDinhVi);
router.post("/dinhvi/clear-all", verifyToken, dinhViController.clearAllDinhVi);
router.patch("/dinhvi/update-pack", verifyToken, dinhViController.updatePackBySKU);
router.post("/dinhvi/pack/bulk", verifyToken, dinhViController.getPackByMultipleSKU);
router.get("/dinhvi/pack/:sku", verifyToken, dinhViController.getPackBySKU);
router.post("/dinhvi/khoi-luong/bulk", verifyToken, dinhViController.getKhoiLuongByMultipleSKU);
router.get("/dinhvi/khoi-luong/:sku", verifyToken, dinhViController.getKhoiLuongBySKU);
router.get("/dinhvi", verifyToken, dinhViController.getAllDinhVi);
router.get("/dinhvi/:id", verifyToken, dinhViController.getDinhViById);
router.post("/dinhvi", verifyToken, dinhViController.createDinhVi);
router.put("/dinhvi/:id", verifyToken, dinhViController.updateDinhVi);
router.delete("/dinhvi/:id", verifyToken, dinhViController.deleteDinhVi);

// ==================== DON HANG ====================
router.get("/donhang/search", verifyToken, donHangController.searchDonHang);
router.post("/donhang/many", verifyToken, donHangController.createManyDonHang);
router.post("/donhang/clear-all", verifyToken, donHangController.deleteManyDonHang);
router.get("/donhang", verifyToken, donHangController.getAllDonHang);
router.post("/donhang/check-duplicate", verifyToken, donHangController.checkDuplicateDonHang);
router.get("/donhang/:id", verifyToken, donHangController.getDonHangById);
router.post("/donhang", verifyToken, donHangController.createDonHang);
router.put("/donhang/:id/trangthai", verifyToken, donHangController.updateTrangThai);
router.put("/donhang/:id", verifyToken, donHangController.updateDonHang);
router.delete("/donhang/:id", verifyToken, donHangController.deleteDonHang);

// ==================== PHIEU SOAN ====================
router.get("/phieusoan/statistics", verifyToken, phieuSoanController.getStatistics);
router.get("/phieusoan/special-orders/count", verifyToken, phieuSoanController.getSpecialOrdersCount);
router.get("/phieusoan/special-orders", verifyToken, phieuSoanController.getSpecialOrders);
router.post("/phieusoan/update-special-chan-le", verifyToken, phieuSoanController.updateSpecialChanLe);
router.put("/phieusoan/update-many", verifyToken, phieuSoanController.updateMany);
router.post("/phieusoan/process", verifyToken, phieuSoanController.processOrders);
router.post("/phieusoan/delete-many", verifyToken, phieuSoanController.deleteMany);
router.post("/phieusoan/delete-all", verifyToken, phieuSoanController.deleteAll);
router.get("/phieusoan", verifyToken, phieuSoanController.getAll);
router.get("/phieusoan/:id", verifyToken, phieuSoanController.getOne);
router.put("/phieusoan/:id", verifyToken, phieuSoanController.updateOne);
router.patch("/phieusoan/:id/status", verifyToken, phieuSoanController.updateStatus);
router.delete("/phieusoan/:id", verifyToken, phieuSoanController.deleteOne);

// ==================== PHAN BO ====================
router.post("/phanbo/import", verifyToken, phanBoController.importManyPhanBo);
router.put("/phanbo/bulk-update", verifyToken, phanBoController.updateManyPhanBo);
router.delete("/phanbo/bulk-delete", verifyToken, phanBoController.deleteManyPhanBo);
router.delete("/phanbo/delete-all", verifyToken, phanBoController.deleteAllPhanBo);
router.get("/phanbo", verifyToken, phanBoController.getAllPhanBo);
router.patch("/phanbo/trang-thai", verifyToken, phanBoController.updateTrangThaiPhanBo);
router.post("/phanbo/import-sdtf", phanBoController.importSdTf);
router.get("/phanbo/:id", verifyToken, phanBoController.getByIdPhanBo);
router.post("/phanbo", verifyToken, phanBoController.createOnePhanBo);
router.put("/phanbo/:id", verifyToken, phanBoController.updateOnePhanBo);
router.delete("/phanbo/:id", verifyToken, phanBoController.deleteOnePhanBo);

// ==================== PHAN BO CS ====================
router.post("/phanbo-cs/import", verifyToken, phanBoCSController.importManyPhanBoCS);
router.put("/phanbo-cs/bulk-update", verifyToken, phanBoCSController.updateManyPhanBoCS);
router.delete("/phanbo-cs/bulk-delete", verifyToken, phanBoCSController.deleteManyPhanBoCS);
router.delete("/phanbo-cs/delete-all", verifyToken, phanBoCSController.deleteAllPhanBoCS);
router.get("/phanbo-cs", verifyToken, phanBoCSController.getAllPhanBoCS);
router.patch("/phanbo-cs/trang-thai", verifyToken, phanBoCSController.updateTrangThaiPhanBoCS);
router.post("/phanbo-cs/import-sdtf", phanBoCSController.importSdTfCS);
router.get("/phanbo-cs/:id", verifyToken, phanBoCSController.getByIdPhanBoCS);
router.post("/phanbo-cs", verifyToken, phanBoCSController.createOnePhanBoCS);
router.put("/phanbo-cs/:id", verifyToken, phanBoCSController.updateOnePhanBoCS);
router.delete("/phanbo-cs/:id", verifyToken, phanBoCSController.deleteOnePhanBoCS);

module.exports = router;