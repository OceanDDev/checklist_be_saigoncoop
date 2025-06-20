const express = require("express");
const router = express.Router();
const checklistController = require("../../controllers/checklist/checklist.controller");

// POST: tạo checklist mới
router.post("/checklist", checklistController.createChecklist);

// GET: lấy danh sách checklist
router.get("/checklist", checklistController.getAllChecklist);
router.get("/checklist/:id", checklistController.getChecklistById);

module.exports = router;
