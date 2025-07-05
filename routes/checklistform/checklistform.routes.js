const express = require("express");
const router = express.Router();

const {
  createChecklistForm,
  getAllChecklistForms,
  getChecklistFormById,
  updateChecklistForm,
  deleteChecklistForm,
} = require("../../controllers/checklistform/checklistform.controller");

// Tạo checklist form
router.post("/checklistform", createChecklistForm);

// Lấy tất cả checklist form
router.get("/checklistform", getAllChecklistForms);

// Lấy checklist form theo ID
router.get("/checklistform/:id", getChecklistFormById);

// Cập nhật checklist form theo ID
router.put("/checklistform/:id", updateChecklistForm);

// Xóa checklist form theo ID
router.delete("/checklistform/:id", deleteChecklistForm);

module.exports = router;
