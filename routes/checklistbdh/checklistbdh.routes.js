const express = require("express");
const router = express.Router();
const controller = require("../../controllers/checklistbdh/checklistbdh.controller");

// Thêm checklist mới
router.post("/checklistbdh/:formId", controller.createChecklistByFormId);

// Lấy toàn bộ checklist
router.get("/checklistbdh", controller.getAllChecklists);

// Lấy checklist theo ID
router.get("/checklistbdh/:id", controller.getChecklistById);

// Cập nhật checklist theo ID
router.put("/checklistbdh/:id", controller.updateChecklist); // 👈 thêm route PUT

// Xoá checklist theo ID
router.delete("/checklistbdh/:id", controller.deleteChecklist); // 👈 thêm route DELETE

router.get("/checklistbdh/form/:formId", controller.getCheckListsByFormIdBDH);


module.exports = router;
