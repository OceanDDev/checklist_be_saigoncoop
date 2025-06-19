const express = require("express");
const router = express.Router();
const checklistController = require("../../controllers/checklist/checklist.controller");

// POST: tạo checklist mới
router.post("/", checklistController.createChecklist);

// GET: lấy danh sách checklist
router.get("/", checklistController.getAllChecklist);

module.exports = router;
