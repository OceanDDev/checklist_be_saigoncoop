// routes/checkkpistaff/checkkpistaff.routes.js
const express = require("express");
const router = express.Router();
const checkKPIStaffController = require("../../controllers/checkkpistaff/checkkpistaff.controller");

// ✅ QUAN TRỌNG: Đặt route CỤ THỂ TRƯỚC route ĐỘNG

// POST /api/saigoncoop/checkkpistaff/from-staff - Tạo từ mã NV
router.post(
  "/checkkpistaff/from-staff",
  checkKPIStaffController.createCheckKPIFromStaff,
);

// GET /api/saigoncoop/checkkpistaff/stats - Thống kê
router.get("/checkkpistaff/stats", checkKPIStaffController.getCheckKPIStats);

// GET /api/saigoncoop/checkkpistaff/staff/:ma_nhan_vien/year/:nam - Lấy theo nhân viên
router.get(
  "/checkkpistaff/staff/:ma_nhan_vien/year/:nam",
  checkKPIStaffController.getCheckKPIByStaff,
);

// POST /api/saigoncoop/checkkpistaff - Tạo từ form KPI
router.post("/checkkpistaff", checkKPIStaffController.createCheckKPI);

// GET /api/saigoncoop/checkkpistaff - Lấy tất cả (có filter)
router.get("/checkkpistaff", checkKPIStaffController.getAllCheckKPI);

// ✅ Đặt route động CUỐI CÙNG
// GET /api/saigoncoop/checkkpistaff/:id - Lấy theo ID
router.get("/checkkpistaff/:id", checkKPIStaffController.getCheckKPIById);

// PUT /api/saigoncoop/checkkpistaff/:id - Cập nhật
router.put("/checkkpistaff/:id", checkKPIStaffController.updateCheckKPI);

// DELETE /api/saigoncoop/checkkpistaff/:id - Xóa
router.delete("/checkkpistaff/:id", checkKPIStaffController.deleteCheckKPI);

module.exports = router;
