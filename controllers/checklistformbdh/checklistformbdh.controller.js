const ChecklistBDHForm = require("../../models/checklistformbdh/checklistformbdh");

// Hàm validate quy_dinh
const validateQuyDinh = (quy_dinh) => {
  if (!quy_dinh) return true; // quy_dinh là optional

  const { loai, ngay_trong_tuan, ngay_trong_thang, tan_suat, phat_sinh } = quy_dinh;

  // Validate loai
  if (loai && !["ngày", "tuần", "tháng", "phát sinh"].includes(loai)) {
    return "loai phải là 'ngày', 'tuần', 'tháng', hoặc 'phát sinh'";
  }

  // Nếu là phát sinh, không cần validate các trường khác
  if (loai === "phát sinh" || phat_sinh === true) {
    return true;
  }

  // Validate ngay_trong_tuan khi loai = "tuần"
  if (loai === "tuần") {
    if (ngay_trong_tuan) {
      if (!Array.isArray(ngay_trong_tuan)) {
        return "ngay_trong_tuan phải là mảng";
      }
      if (ngay_trong_tuan.length === 0) {
        return "ngay_trong_tuan không được rỗng khi loai = 'tuần'";
      }
      if (ngay_trong_tuan.some(n => n < 0 || n > 6)) {
        return "ngay_trong_tuan phải chứa giá trị từ 0-6 (0=CN, 1=T2, ..., 6=T7)";
      }
    } else {
      return "ngay_trong_tuan là bắt buộc khi loai = 'tuần'";
    }
  }

  // Validate ngay_trong_thang khi loai = "tháng"
  if (loai === "tháng") {
    if (ngay_trong_thang) {
      if (!Array.isArray(ngay_trong_thang)) {
        return "ngay_trong_thang phải là mảng";
      }
      if (ngay_trong_thang.length === 0) {
        return "ngay_trong_thang không được rỗng khi loai = 'tháng'";
      }
      if (ngay_trong_thang.some(n => n < 1 || n > 31)) {
        return "ngay_trong_thang phải chứa giá trị từ 1-31";
      }
    } else {
      return "ngay_trong_thang là bắt buộc khi loai = 'tháng'";
    }
  }

  // Validate tan_suat
  if (tan_suat !== undefined && tan_suat !== null) {
    if (typeof tan_suat !== "number" || tan_suat < 1 || !Number.isInteger(tan_suat)) {
      return "tan_suat phải là số nguyên dương";
    }
  }

  // Validate phat_sinh
  if (phat_sinh !== undefined && typeof phat_sinh !== "boolean") {
    return "phat_sinh phải là boolean (true/false)";
  }

  return true;
};

// Hàm validate cấu trúc form
const validateFormStructure = (cac_muc) => {
  if (!cac_muc || !Array.isArray(cac_muc)) return true;

  for (const muc of cac_muc) {
    if (muc.cong_viec && Array.isArray(muc.cong_viec)) {
      for (const cv of muc.cong_viec) {
        // Validate chi_tiet
        if (cv.chi_tiet && !Array.isArray(cv.chi_tiet)) {
          return "chi_tiet phải là mảng";
        }

        // Validate quy_dinh
        const quyDinhValidation = validateQuyDinh(cv.quy_dinh);
        if (quyDinhValidation !== true) {
          return quyDinhValidation;
        }
      }
    }
  }

  return true;
};

// Tạo form
exports.createForm = async (req, res) => {
  try {
    // Validate cấu trúc
    const validation = validateFormStructure(req.body.cac_muc);
    if (validation !== true) {
      return res.status(400).json({ error: validation });
    }

    const newForm = new ChecklistBDHForm(req.body);
    const saved = await newForm.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả form
exports.getAllForms = async (req, res) => {
  try {
    const forms = await ChecklistBDHForm.find().sort({ created_at: -1 });
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy theo ID
exports.getFormById = async (req, res) => {
  try {
    const form = await ChecklistBDHForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    res.json(form);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa form theo ID
exports.deleteForm = async (req, res) => {
  try {
    const deletedForm = await ChecklistBDHForm.findByIdAndDelete(req.params.id);
    if (!deletedForm) {
      return res.status(404).json({ message: "Form not found" });
    }
    res.json({ message: "Form deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật form theo ID
exports.updateFormById = async (req, res) => {
  try {
    // Validate cấu trúc
    const validation = validateFormStructure(req.body.cac_muc);
    if (validation !== true) {
      return res.status(400).json({ error: validation });
    }

    const updatedForm = await ChecklistBDHForm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedForm) {
      return res.status(404).json({ message: "Form not found" });
    }
    
    res.json(updatedForm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lọc công việc theo loại quy định
exports.getFormsByLoaiQuyDinh = async (req, res) => {
  try {
    const { loai } = req.params; // "ngày", "tuần", "tháng", hoặc "phát sinh"

    if (!["ngày", "tuần", "tháng", "phát sinh"].includes(loai)) {
      return res.status(400).json({ 
        error: "loai phải là 'ngày', 'tuần', 'tháng', hoặc 'phát sinh'" 
      });
    }

    const forms = await ChecklistBDHForm.find({
      "cac_muc.cong_viec.quy_dinh.loai": loai
    }).sort({ created_at: -1 });

    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả công việc phát sinh
exports.getPhatSinhTasks = async (req, res) => {
  try {
    const forms = await ChecklistBDHForm.find({
      $or: [
        { "cac_muc.cong_viec.quy_dinh.loai": "phát sinh" },
        { "cac_muc.cong_viec.quy_dinh.phat_sinh": true }
      ]
    }).sort({ created_at: -1 });

    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};