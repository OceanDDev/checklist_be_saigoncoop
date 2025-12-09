// routes/xuatTra.routes.js
const express = require("express");
const router = express.Router();
const xuatTraCtrl = require("../../../controllers/dieuvan/xuattra/xuattra.controller");
const productController = require("../../../controllers/dieuvan/xuattra/product.controller");
const vendorController = require("../../../controllers/dieuvan/xuattra/vendor.controller");

// Tạo mới
router.post("/xuattra", xuatTraCtrl.createXuatTra);

// Lấy tất cả (có thể lọc ?trangThai=true/false)
router.get("/xuattra", xuatTraCtrl.getAllXuatTra);

// Lấy 1 phiếu theo id
router.get("/xuattra/:id", xuatTraCtrl.getXuatTraById);

// Cập nhật 1 phiếu
router.put("/xuattra/:id", xuatTraCtrl.updateXuatTra);

// Xóa 1 phiếu
router.delete("/xuattra/:id", xuatTraCtrl.deleteXuatTra);

//PRODUCT
router.post("/product", productController.createProduct);
router.post("/product/bulk", productController.createManyProducts);

router.get("/product", productController.getAllProducts);

// ⚠️ CẦN PHẢI THÊM ROUTE NÀY VÀO ĐÂY:
router.get("/product/upc/:upc", productController.getProductByUPC);

// LƯU Ý QUAN TRỌNG VỀ THỨ TỰ:
// Định nghĩa route tham số tĩnh (/sku/:sku, /upc/:upc) phải được đặt trước
// route tham số động chung (/product/:id)
router.get("/product/sku/:sku", productController.getProductBySKU);
router.get("/product/:id", productController.getProductById);

// UPDATE
router.put("/product/:id", productController.updateProduct);

// DELETE
router.delete("/product/:id", productController.deleteProduct);
router.post("/product/delete-many", productController.deleteManyProducts);

//VENDOR
router.post("/vendor", vendorController.createVendor);
router.post("/vendor/bulk", vendorController.createManyVendors);

// READ
router.get("/vendor", vendorController.getAllVendors);
router.get("/vendor/:id", vendorController.getVendorById);

// DELETE
router.delete("/vendor/:id", vendorController.deleteVendor);
router.post("/vendor/delete-many", vendorController.deleteManyVendors);

module.exports = router;
