const express = require("express");
const router = express.Router();
const checkKPIStaffController = require("../../controllers/checkkpistaff/checkkpistaff.controller");

// POST /api/check-kpi - Tạo check KPI từ form KPI
router.post("/checkkpistaff", checkKPIStaffController.createCheckKPI);

// POST /api/check-kpi/from-staff - Tạo check KPI từ thông tin nhân viên
router.post("/checkkpistaff/from-staff", checkKPIStaffController.createCheckKPIFromStaff);

// GET /api/check-kpi - Lấy tất cả check KPI (có filter)
router.get("/checkkpistaff", checkKPIStaffController.getAllCheckKPI);

// GET /api/check-kpi/stats - Lấy thống kê check KPI
router.get("/checkkpistaff/stats", checkKPIStaffController.getCheckKPIStats);

// GET /api/check-kpi/:id - Lấy check KPI theo ID
router.get("/checkkpistaff/:id", checkKPIStaffController.getCheckKPIById);

// GET /api/check-kpi/staff/:ma_nhan_vien/:thang/:nam - Lấy check KPI theo nhân viên và tháng/năm
router.get('/checkkpistaff/staff/:ma_nhan_vien/year/:nam', checkKPIStaffController.getCheckKPIByStaff);

// PUT /api/check-kpi/:id - Cập nhật check KPI (nhập lỗi)
router.put("/checkkpistaff/:id", checkKPIStaffController.updateCheckKPI);

// DELETE /api/check-kpi/:id - Xóa check KPI
router.delete("/checkkpistaff/:id", checkKPIStaffController.deleteCheckKPI);

module.exports = router;