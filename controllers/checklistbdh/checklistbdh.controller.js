const ChecklistBDH = require("../../models/checklistbdh/checklistbdh");

// Tạo checklist đã thực hiện
exports.createChecklistByFormId = async (req, res) => {
  try {
    const { formId } = req.params;
    const {
      ma_nhan_vien,
      ho_ten,
      don_vi,
      ghi_chu,
      cac_muc,
      cong_viec_khac,
    } = req.body;

    // Kiểm tra dữ liệu đầu vào hợp lệ
    if (!Array.isArray(cac_muc)) {
      return res.status(400).json({ error: "cac_muc phải là mảng" });
    }

    // Validate cấu trúc chi tiết nếu có
    for (const muc of cac_muc) {
      if (muc.cong_viec && Array.isArray(muc.cong_viec)) {
        for (const cv of muc.cong_viec) {
          if (cv.chi_tiet && !Array.isArray(cv.chi_tiet)) {
            return res.status(400).json({ 
              error: "chi_tiet phải là mảng" 
            });
          }
        }
      }
    }

    const newChecklist = new ChecklistBDH({
      form_id: formId,
      ma_nhan_vien,
      ho_ten,
      don_vi,
      ghi_chu,
      cac_muc,
      cong_viec_khac,
    });

    const savedChecklist = await newChecklist.save();
    res.status(201).json(savedChecklist);
  } catch (err) {
    console.error("Lỗi tạo checklist:", err);
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả checklist
exports.getAllChecklists = async (req, res) => {
  try {
    const lists = await ChecklistBDH.find().populate("form_id");
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy checklist theo ID
exports.getChecklistById = async (req, res) => {
  try {
    const checklist = await ChecklistBDH.findById(req.params.id).populate("form_id");
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật checklist theo ID
exports.updateChecklist = async (req, res) => {
  try {
    // Validate cấu trúc chi tiết nếu cập nhật cac_muc
    if (req.body.cac_muc && Array.isArray(req.body.cac_muc)) {
      for (const muc of req.body.cac_muc) {
        if (muc.cong_viec && Array.isArray(muc.cong_viec)) {
          for (const cv of muc.cong_viec) {
            if (cv.chi_tiet && !Array.isArray(cv.chi_tiet)) {
              return res.status(400).json({ 
                error: "chi_tiet phải là mảng" 
              });
            }
          }
        }
      }
    }

    const updated = await ChecklistBDH.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("form_id");

    if (!updated) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa checklist theo ID
exports.deleteChecklist = async (req, res) => {
  try {
    const deleted = await ChecklistBDH.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    res.json({ message: "Checklist deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy checklist theo form_id
exports.getCheckListsByFormIdBDH = async (req, res) => {
  try {
    const { formId } = req.params;
    const checklists = await ChecklistBDH.find({ form_id: formId }).populate("form_id");
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Thêm chi tiết cho công việc cụ thể
exports.addChiTietToCongViec = async (req, res) => {
  try {
    const { checklistId, mucIndex, congViecIndex } = req.params;
    const { noi_dung_chi_tiet } = req.body;

    const checklist = await ChecklistBDH.findById(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const congViec = checklist.cac_muc[mucIndex].cong_viec[congViecIndex];
    if (!congViec) {
      return res.status(404).json({ message: "Công việc not found" });
    }

    congViec.chi_tiet.push({
      noi_dung_chi_tiet,
      da_chon: false
    });

    await checklist.save();
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật trạng thái chi tiết
exports.updateChiTietStatus = async (req, res) => {
  try {
    const { checklistId, mucIndex, congViecIndex, chiTietIndex } = req.params;
    const { da_chon } = req.body;

    const checklist = await ChecklistBDH.findById(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const chiTiet = checklist.cac_muc[mucIndex].cong_viec[congViecIndex].chi_tiet[chiTietIndex];
    if (!chiTiet) {
      return res.status(404).json({ message: "Chi tiết not found" });
    }

    chiTiet.da_chon = da_chon;
    await checklist.save();
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa chi tiết
exports.deleteChiTiet = async (req, res) => {
  try {
    const { checklistId, mucIndex, congViecIndex, chiTietIndex } = req.params;

    const checklist = await ChecklistBDH.findById(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const congViec = checklist.cac_muc[mucIndex].cong_viec[congViecIndex];
    if (!congViec || !congViec.chi_tiet[chiTietIndex]) {
      return res.status(404).json({ message: "Chi tiết not found" });
    }

    congViec.chi_tiet.splice(chiTietIndex, 1);
    await checklist.save();
    res.json({ message: "Chi tiết deleted successfully", checklist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};