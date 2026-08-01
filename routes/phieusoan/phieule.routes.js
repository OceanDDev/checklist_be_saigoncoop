const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const phieuLeController = require("../../controllers/phieusoan/phieule.controller");
const dataCHController = require("../../controllers/phieusoan/dataCH.controller");
const { verifyToken } = require("../../middlewares/authMiddleware");
const apiKeyAuth = require("../../middlewares/apiKeyAuth");

const {
  createNhanSuSoan,
  importManyNhanSuSoan,
  getAllNhanSuSoan,
  getNhanSuSoanById,
  updateNhanSuSoan,
  updateManyNhanSuSoan,
  deleteNhanSuSoan,
  deleteManyNhanSuSoan,
  deleteAllNhanSuSoan,
  importPhanBo  
} = require("../../controllers/phieusoan/nhansusoan.controller"); 

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
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ===== PHIẾU LẺ ROUTES =====
router.post("/phieule/import-soda", verifyToken, phieuLeController.importSDPhieuLe);
router.get("/phieule/migrate-loai-phieu", verifyToken, phieuLeController.migrateLoaiPhieu);
router.post("/phieule/import-8101", verifyToken, phieuLeController.import8101PhieuLe);
router.post("/phieule/import-soda-txt", verifyToken, upload.single("file"), phieuLeController.importSodaTxtPhieuLe);
router.post("/phieule/import-soda-txt-multiple", verifyToken, upload.array("files", 50), phieuLeController.importSodaTxtPhieuLeMultiple);
router.get("/phieule", verifyToken, phieuLeController.getAllPhieuLe);
router.get("/phieule/statistics", verifyToken, phieuLeController.getPhieuLeStatistics);
router.get("/phieule/document/:so_document", verifyToken, phieuLeController.getPhieuLeBySoDocument);
router.get("/phieule/:id", verifyToken, phieuLeController.getPhieuLeById);
router.post("/phieule", apiKeyAuth, verifyToken, phieuLeController.createPhieuLe);
router.post("/phieule/import", verifyToken, phieuLeController.importManyPhieuLe);
router.post("/phieule/import-txt", verifyToken, upload.single("file"), phieuLeController.importTxtPhieuLe);
router.post("/phieule/import-txt-multiple", verifyToken, upload.array("files", 50), phieuLeController.importTxtPhieuLeMultiple);
router.post("/phieule/clear-all", verifyToken, phieuLeController.clearAllPhieuLe);
router.put("/phieule/update-by-sdtf", verifyToken, phieuLeController.updateTrangThaiBySDTF);
router.patch("/phieule/:id/chi-tiet/bulk-update", verifyToken, phieuLeController.updateMultipleChiTiet);
router.put("/phieule/:id/chitiet", verifyToken, phieuLeController.updateChiTietPhieuLe);
router.put("/phieule/update-many", verifyToken, phieuLeController.updateManyPhieuLe);
router.put("/phieule/:id", verifyToken, phieuLeController.updatePhieuLe);
router.put("/phieule/:id/status", verifyToken, phieuLeController.updatePhieuLeStatus);
router.delete("/phieule/many", verifyToken, phieuLeController.deleteManyPhieuLe);
router.delete("/phieule/by-filter", verifyToken, phieuLeController.deleteManyPhieuLeByFilter);
router.delete("/phieule/:id", verifyToken, phieuLeController.deletePhieuLe);

// ===== DATA CỬA HÀNG ROUTES =====
router.delete("/dataCH/delete-all", verifyToken, dataCHController.deleteAllDataCH);
router.get("/dataCH", verifyToken, dataCHController.getAllDataCH);
router.get("/dataCH/:id", verifyToken, dataCHController.getDataCHById);
router.post("/dataCH", verifyToken, dataCHController.addDataCH);
router.post("/dataCH/addmany", verifyToken, dataCHController.importManyDataCH);
router.put("/dataCH/:id", verifyToken, dataCHController.updateDataCH);
router.delete("/dataCH/:id", verifyToken, dataCHController.deleteDataCH);

// ===== NHÂN SỰ SOẠN ROUTES =====
router.delete("/nhansusoan/delete-all", verifyToken, deleteAllNhanSuSoan);
router.post("/nhansusoan/import-phanbo",verifyToken, importPhanBo)
router.get("/nhansusoan", verifyToken, getAllNhanSuSoan);
router.get("/nhansusoan/:id", verifyToken, getNhanSuSoanById);
router.post("/nhansusoan", verifyToken, createNhanSuSoan);
router.post("/nhansusoan/import", verifyToken, importManyNhanSuSoan);
router.put("/nhansusoan/update-many", verifyToken, updateManyNhanSuSoan);
router.put("/nhansusoan/:id", verifyToken, updateNhanSuSoan);
router.delete("/nhansusoan/many", verifyToken, deleteManyNhanSuSoan);
router.delete("/nhansusoan/:id", verifyToken, deleteNhanSuSoan);

module.exports = router;