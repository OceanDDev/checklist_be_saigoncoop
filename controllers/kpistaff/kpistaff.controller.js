const KPIStaff = require("../../models/kpistaff/kpistaff");

// Lấy KPI của nhân viên theo tháng
exports.getKPIByStaffAndMonth = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { thang } = req.query;

    const filter = { staff_id: staffId };
    if (thang) filter.thang = Number(thang);

    const kpiData = await KPIStaff.findOne(filter).populate("staff_id");

    if (!kpiData) {
      return res.status(404).json({ message: "Không tìm thấy KPI" });
    }

    res.json(kpiData);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy KPI", error });
  }
};

// Tạo mới KPI theo tháng cho nhân viên
exports.createKPI = async (req, res) => {
  try {
    const { staff_id, thang } = req.body;

    // Kiểm tra đã tồn tại chưa
    const existing = await KPIStaff.findOne({ staff_id, thang });
    if (existing) {
      return res.status(400).json({ message: "Đã tồn tại KPI tháng này cho nhân viên này" });
    }

    const newKPI = new KPIStaff(req.body);
    const saved = await newKPI.save();

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: "Không thể tạo KPI", error });
  }
};

// Cập nhật KPI (toàn bộ danh sách KPI trong tháng)
exports.updateKPI = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await KPIStaff.findByIdAndUpdate(id, req.body, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy KPI để cập nhật" });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi cập nhật KPI", error });
  }
};

// Xoá KPI theo ID
exports.deleteKPI = async (req, res) => {
  try {
    const deleted = await KPIStaff.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy KPI để xoá" });
    }

    res.json({ message: "Đã xoá KPI thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xoá KPI", error });
  }
};

// Lấy tất cả KPI (tuỳ chọn lọc theo tháng)
exports.getAllKPI = async (req, res) => {
  try {
    const { thang } = req.query;
    const filter = {};
    if (thang) filter.thang = Number(thang);

    const kpis = await KPIStaff.find(filter).populate("staff_id");
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};

// Tạo nhiều KPI cho nhiều nhân viên một lúc
exports.createMultipleKPI = async (req, res) => {
  try {
    let kpiList = req.body; // Dữ liệu gửi lên là mảng

    if (!Array.isArray(kpiList)) {
      return res.status(400).json({ message: "Dữ liệu phải là một mảng" });
    }

    const toInsert = [];

    for (const kpiData of kpiList) {
      const { ma_nhan_vien, thang } = kpiData;

      // Kiểm tra KPI đã tồn tại chưa
      const existing = await KPIStaff.findOne({ ma_nhan_vien, thang });
      if (existing) {
        console.log(`Bỏ qua: ${ma_nhan_vien} - Tháng ${thang} đã tồn tại`);
        continue;
      }

      toInsert.push(kpiData);
    }

    if (toInsert.length === 0) {
      return res.status(400).json({ message: "Không có KPI mới để tạo" });
    }

    const savedKPI = await KPIStaff.insertMany(toInsert);

    res.status(201).json({
      message: "Tạo KPI hàng loạt thành công",
      data: savedKPI
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo KPI hàng loạt", error });
  }
};
