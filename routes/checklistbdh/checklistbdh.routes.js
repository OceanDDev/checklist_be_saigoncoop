const express = require("express");
const router = express.Router();
const controller = require("../../controllers/checklistbdh/checklistbdh.controller");

// Thêm checklist mới
router.post("/checklistbdh/:formId", controller.createChecklistByFormId);

// Lấy checklist theo form ID (đặt trước route :id để tránh conflict)
router.get("/checklistbdh/form/:formId", controller.getCheckListsByFormIdBDH);

// Lấy toàn bộ checklist
router.get("/checklistbdh", controller.getAllChecklists);

// Lấy checklist theo ID
router.get("/checklistbdh/:id", controller.getChecklistById);

// Cập nhật checklist theo ID
router.put("/checklistbdh/:id", controller.updateChecklist);

// Xoá checklist theo ID
router.delete("/checklistbdh/:id", controller.deleteChecklist);

// === ROUTES CHO CHI TIẾT ===

// Thêm chi tiết cho công việc
router.post(
  "/checklistbdh/:checklistId/muc/:mucIndex/congviec/:congViecIndex/chitiet",
  controller.addChiTietToCongViec
);

// Cập nhật trạng thái chi tiết
router.patch(
  "/checklistbdh/:checklistId/muc/:mucIndex/congviec/:congViecIndex/chitiet/:chiTietIndex",
  controller.updateChiTietStatus
);

// Xóa chi tiết
router.delete(
  "/checklistbdh/:checklistId/muc/:mucIndex/congviec/:congViecIndex/chitiet/:chiTietIndex",
  controller.deleteChiTiet
);

module.exports = router;