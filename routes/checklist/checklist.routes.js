const express = require("express");
const router = express.Router();
const checklistController = require("../../controllers/checklist/checklist.controller");

// POST: tạo checklist mới
router.post("/checklist", checklistController.createChecklist);

// GET: lấy danh sách checklist
router.get("/checklist", checklistController.getAllChecklist);
router.get("/checklist/:id", checklistController.getChecklistById);
router.post("/checklist/:formId", checklistController.createChecklist);
router.get("/checklist/form/:formId", checklistController.getCheckListsByFormId);
router.get("/checklist/check-duplicate/:formId", checklistController.checkDuplicate);
router.delete("/checklist/:id", checklistController.deleteChecklist);
router.get("/checklist/options-available/:formId", checklistController.getAvailableOptions);

module.exports = router;    
