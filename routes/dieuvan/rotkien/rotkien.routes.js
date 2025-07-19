const express = require("express");
const router = express.Router();
const controller = require("../../../controllers/dieuvan/rotkien/rotkien.controller");

// CRUD routes
router.post("/rotkien", controller.createRotKien);
router.post("/rotkien/bulk", controller.createManyRotKien);
router.get("/rotkien", controller.getAllRotKien);
router.get("/rotkien/:id", controller.getRotKienById);
router.put("/rotkien/:id", controller.updateRotKien);
router.delete("/rotkien/:id", controller.deleteRotKien);

module.exports = router;
