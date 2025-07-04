// routes/staffRoutes.js
const express = require("express");
const router = express.Router();
const staffController = require("../../controllers/staff/staff.controller");

router.get("/", staffController.getAllStaffs);
router.get("/:id", staffController.getStaffById);
router.post("/", staffController.createStaff);
router.post("/manystaff", staffController.createManyStaffs);
router.put("/:id", staffController.updateStaff);
router.delete("/:id", staffController.deleteStaff);

module.exports = router;
