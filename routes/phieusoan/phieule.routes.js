const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const phieuLeController = require("../../controllers/phieusoan/phieule.controller");
const dataCHController = require("../../controllers/phieusoan/dataCH.controller");

// ===== MULTER CONFIG =====
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../../uploads"));
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + "-" + Math.random().toString(36).slice(2) + path.extname(file.originalname);
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    file.originalname.endsWith(".txt")
      ? cb(null, true)
      : cb(new Error("Chỉ cho phép .txt"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
});

// ===== PHIẾU LẺ ROUTES =====
router.get("/phieule/migrate-loai-phieu",phieuLeController.migrateLoaiPhieu);
router.post("/phieule/import-soda-txt", upload.single("file"), phieuLeController.importSodaTxtPhieuLe);
router.post("/phieule/import-soda-txt-multiple", upload.array("files", 50), phieuLeController.importSodaTxtPhieuLeMultiple);
router.get("/phieule", phieuLeController.getAllPhieuLe);
router.get("/phieule/statistics", phieuLeController.getPhieuLeStatistics);
router.get("/phieule/document/:so_document", phieuLeController.getPhieuLeBySoDocument);
router.get("/phieule/:id", phieuLeController.getPhieuLeById);
router.post("/phieule", phieuLeController.createPhieuLe);
router.post("/phieule/import", phieuLeController.importManyPhieuLe);
router.post("/phieule/import-txt", upload.single("file"), phieuLeController.importTxtPhieuLe);
router.post("/phieule/import-txt-multiple", upload.array("files", 50), phieuLeController.importTxtPhieuLeMultiple);
router.post("/phieule/clear-all", phieuLeController.clearAllPhieuLe);
router.put("/phieule/update-by-sdtf", phieuLeController.updateTrangThaiBySDTF);

router.patch('/phieule/:id/chi-tiet/bulk-update', phieuLeController.updateMultipleChiTiet);
router.put('/phieule/:id/chitiet', phieuLeController.updateChiTietPhieuLe);
router.put("/phieule/update-many",phieuLeController.updateManyPhieuLe);
router.put("/phieule/:id", phieuLeController.updatePhieuLe);
router.put("/phieule/:id/status", phieuLeController.updatePhieuLeStatus);
router.delete("/phieule/:id", phieuLeController.deletePhieuLe);

// ===== DATA CỬA HÀNG ROUTES =====
router.delete("/dataCH/delete-all", dataCHController.deleteAllDataCH);
router.get("/dataCH", dataCHController.getAllDataCH);
router.get("/dataCH/:id", dataCHController.getDataCHById);
router.post("/dataCH", dataCHController.addDataCH);
router.post("/dataCH/addmany", dataCHController.importManyDataCH);
router.put("/dataCH/:id", dataCHController.updateDataCH);
router.delete("/dataCH/:id", dataCHController.deleteDataCH);


module.exports = router;