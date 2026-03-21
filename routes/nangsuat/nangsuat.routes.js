// routes/move/nangSuat.routes.js
const express = require("express");
const router = express.Router();
const nangSuatController = require("../../controllers/nangsuat/nangsuat.controller");

// Collection
router.get("/nangsuat", nangSuatController.getAllNangSuat);
router.post("/nangsuat", nangSuatController.addOneNangSuat);
router.post("/nangsuat/many", nangSuatController.addManyNangSuat);
router.put("/nangsuat/many", nangSuatController.updateManyNangSuat);
router.delete("/nangsuat/many", nangSuatController.deleteManyNangSuat);

// Doc number (phải trước /:id)
router.get("/nangsuat/doc/:doc_number", nangSuatController.getByDocNumberNangSuat);

// Single
router.get("/nangsuat/:id", nangSuatController.getOneNangSuat);
router.put("/nangsuat/:id", nangSuatController.updateOneNangSuat);
router.delete("/nangsuat/:id", nangSuatController.deleteOneNangSuat);
router.patch("/nangsuat/:id/assign", nangSuatController.assignOneNangSuat);
router.patch("/nangsuat/:id/complete", nangSuatController.completeOneNangSuat);

module.exports = router;