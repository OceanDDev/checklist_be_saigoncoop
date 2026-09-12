const express = require("express");
const router = express.Router();
const baoBiController = require("../../controllers/baobi/baobi.controller");
const { verifyToken } = require("../../middlewares/authMiddleware");

// --- Các route cụ thể PHẢI đặt trước /baobi/:id ---
router.get(
  "/baobi/ton-hien-tai",
  verifyToken,
  baoBiController.getTonHienTaiBySku,
);
router.get(
  "/baobi/kha-dung-xuat",
  verifyToken,
  baoBiController.getKhaDungXuatBySku,
);
router.get(
  "/baobi/ton-kho-tat-ca",
  verifyToken,
  baoBiController.getTonKhoTatCa,
);
router.get("/baobi/search/ma-ch", verifyToken, baoBiController.getBaoBiByMaCH);

router.get("/baobi", verifyToken, baoBiController.getAllBaoBi);

router.post("/baobi/xuat", verifyToken, baoBiController.createXuatBaoBi);
router.post("/baobi/many", verifyToken, baoBiController.createManyBaoBi);
router.post("/baobi", verifyToken, baoBiController.createBaoBi);

// --- Route có /:id đặt CUỐI CÙNG ---
router.get("/baobi/:id", verifyToken, baoBiController.getBaoBiById);
router.put("/baobi/:id", verifyToken, baoBiController.updateBaoBi);
router.delete("/baobi/:id", verifyToken, baoBiController.deleteBaoBiById);

module.exports = router;
