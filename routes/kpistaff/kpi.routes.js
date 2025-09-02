const express = require("express");
const router = express.Router();
const kpiStaffController = require("../../controllers/kpistaff/kpistaff.controller");

// Lấy tất cả KPI (có thể lọc theo tháng)
router.get("/kpistaff", kpiStaffController.getAllKPI);

// Lấy KPI của 1 nhân viên theo tháng
// Ví dụ: /api/kpi-staff/staff/64abc12345?thang=8
router.get("/kpistaff/:ma_nhan_vien", kpiStaffController.getKPIByStaffAndMonth);

// Tạo KPI mới cho 1 nhân viên
router.post("/kpistaff", kpiStaffController.createKPI);

// Cập nhật KPI theo ID
router.put("/kpistaff/:id", kpiStaffController.updateKPI);  

// Xoá KPI theo ID
router.delete("/kpistaff/:id", kpiStaffController.deleteKPI);

router.post("/kpistaff/multiple", kpiStaffController.createMultipleKPI);

module.exports = router;    
