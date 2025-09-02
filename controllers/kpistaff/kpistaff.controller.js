const KPIStaff = require("../../models/kpistaff/kpistaff");

// Lấy KPI của 1 nhân viên theo tháng (và / hoặc năm)
exports.getKPIByStaffAndMonth = async (req, res) => {
  try {
    // đổi param từ staffId -> ma_nv cho rõ nghĩa (hoặc vẫn giữ staffId nhưng map sang ma_nhan_vien)
    const { maNV } = req.params; // route nên là /kpistaff/ma-nv/:maNV
    const { thang, nam } = req.query;

    const filter = { ma_nhan_vien: maNV };
    if (thang) filter.thang = Number(thang);
    if (nam) filter.nam = Number(nam);

    const kpiData = await KPIStaff.findOne(filter); // KHÔNG populate vì không có ref

    if (!kpiData) {
      return res.status(404).json({ message: "Không tìm thấy KPI" });
    }

    res.json(kpiData);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy KPI", error });
  }
};

// Tạo mới KPI cho 1 nhân viên theo tháng/năm
exports.createKPI = async (req, res) => {
  try {
    // chỉ dùng ma_nhan_vien
    const { ma_nhan_vien, thang, nam } = req.body;
    if (!ma_nhan_vien) {
      return res.status(400).json({ message: "Thiếu ma_nhan_vien" });
    }
    if (!thang || !nam) {
      return res.status(400).json({ message: "Thiếu thang/nam" });
    }

    const existing = await KPIStaff.findOne({ ma_nhan_vien, thang, nam });
    if (existing) {
      return res.status(400).json({ message: "Đã tồn tại KPI tháng/năm này cho nhân viên này" });
    }

    const newKPI = new KPIStaff(req.body);
    const saved = await newKPI.save();

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: "Không thể tạo KPI", error });
  }
};

// Cập nhật KPI theo _id
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

// Xoá KPI theo _id
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

// Lấy tất cả KPI (tùy chọn lọc theo thang/nam/ma_nhan_vien)
exports.getAllKPI = async (req, res) => {
  try {
    const { thang, nam, ma_nhan_vien } = req.query;

    const filter = {};
    if (thang) filter.thang = Number(thang);
    if (nam) filter.nam = Number(nam);
    if (ma_nhan_vien) filter.ma_nhan_vien = ma_nhan_vien;

    const kpis = await KPIStaff.find(filter); // KHÔNG populate
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};

// Tạo nhiều KPI cho nhiều nhân viên một lúc
exports.createMultipleKPI = async (req, res) => {
  try {
    const kpiList = req.body;
    if (!Array.isArray(kpiList)) {
      return res.status(400).json({ message: "Dữ liệu phải là một mảng" });
    }

    const toInsert = [];
    for (const kpiData of kpiList) {
      const { ma_nhan_vien, thang, nam } = kpiData;
      if (!ma_nhan_vien || !thang || !nam) continue;

      const existing = await KPIStaff.findOne({ ma_nhan_vien, thang, nam });
      if (existing) {
        console.log(`Bỏ qua: ${ma_nhan_vien} - Tháng ${thang}/${nam} đã tồn tại`);
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
      data: savedKPI,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo KPI hàng loạt", error });
  }
};
