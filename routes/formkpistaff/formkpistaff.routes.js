const express = require("express");
const router = express.Router();
const formKPIStaffController = require("../../controllers/formkpistaff/formkpistaff.controller");

// POST /api/form-kpi - Tạo form KPI cho nhân viên
router.post("/formkpistaff", formKPIStaffController.createFormKPI);

// GET /api/form-kpi - Lấy tất cả form KPI (có filter)
router.get("/formkpistaff", formKPIStaffController.getAllFormKPI);

// GET /api/form-kpi/staff-list - Lấy danh sách nhân viên có KPI
router.get("/formkpistaff/staff-list", formKPIStaffController.getStaffList);

// GET /api/form-kpi/:id - Lấy form KPI theo ID
router.get("/formkpistaff/:id", formKPIStaffController.getFormKPIById);

// GET /api/form-kpi/staff/:ma_nhan_vien/:thang/:nam - Lấy form KPI theo nhân viên và tháng/năm
router.get("/formkpistaff/:ma_nhan_vien/:thang/:nam", formKPIStaffController.getFormKPIByStaff);

// PUT /api/form-kpi/:id - Cập nhật form KPI
router.put("/formkpistaff/:id", formKPIStaffController.updateFormKPI);

// DELETE /api/form-kpi/:id - Xóa form KPI
router.delete("/formkpistaff/:id", formKPIStaffController.deleteFormKPI);

router.post("/formkpistaff/addmany", formKPIStaffController.createManyFormKPI);


module.exports = router;