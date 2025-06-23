const express = require("express");
const router = express.Router();

const {
  createChecklistForm,
  getAllChecklistForms,
  getChecklistFormById,
} = require("../../controllers/checklistform/checklistform.controller");

router.post("/checklistform", createChecklistForm);
router.get("/checklistform", getAllChecklistForms);
router.get("/checklistform/:id", getChecklistFormById);



module.exports = router;
