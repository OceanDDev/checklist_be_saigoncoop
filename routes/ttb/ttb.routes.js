// routes/ttbRoutes.js
const express = require("express");
const router = express.Router();
const ttbController = require("../../controllers/ttb/ttb.controller");
const thietBiConfigController = require("../../controllers/ttb/thietBiConfig.controller");

router.post("/ttb", ttbController.createTtb);
router.post("/ttb/add-many", ttbController.addManyTtb);
router.get("/ttb", ttbController.getAllTtb);
router.get("/ttb/stats", ttbController.getStatsByStore);
router.get("/ttb/:id", ttbController.getTtbById);
router.put("/ttb/:id", ttbController.updateTtb);
router.delete("/ttb/:id", ttbController.deleteTtb);
router.delete("/ttb/bulk/delete", ttbController.deleteManyTtb);
router.put("/ttb/update-many", ttbController.updateManyTtb);

router.get("/thietbi", thietBiConfigController.getAllThietBi);
router.get("/thietbi/:id", thietBiConfigController.getThietBiById);
router.post("/thietbi", thietBiConfigController.createThietBi);
router.put("/thietbi/:id", thietBiConfigController.updateThietBi);
router.delete("/thietbi/:id", thietBiConfigController.deleteThietBi);

module.exports = router;