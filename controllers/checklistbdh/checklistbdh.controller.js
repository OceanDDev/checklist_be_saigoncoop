const ChecklistBDH = require("../../models/checklistbdh/checklistbdh");

// Hàm validate và chuẩn hóa quy_dinh
const validateAndNormalizeQuyDinh = (quy_dinh) => {
  if (!quy_dinh) return null;

  const { loai, ngay_trong_tuan, ngay_trong_thang, tan_suat, phat_sinh } =
    quy_dinh;

  // Validate loai
  if (!loai || !["ngày", "tuần", "tháng", "phát sinh"].includes(loai)) {
    throw new Error("quy_dinh.loai phải là: ngày, tuần, tháng, hoặc phát sinh");
  }

  // ✅ Nếu là phát sinh, không cần validate các trường khác
  if (loai === "phát sinh" || phat_sinh === true) {
    return {
      loai: "phát sinh",
      ngay_trong_tuan: null,
      ngay_trong_thang: null,
      tan_suat: tan_suat || 1,
      phat_sinh: true,
    };
  }

  // ✅ Chuẩn hóa dựa trên loại được chọn
  const normalized = {
    loai,
    ngay_trong_tuan: null,
    ngay_trong_thang: null,
    tan_suat: tan_suat || 1,
    phat_sinh: phat_sinh || false,
  };

  // Chỉ giữ trường tương ứng với loại
  if (loai === "tuần") {
    if (!ngay_trong_tuan || !Array.isArray(ngay_trong_tuan)) {
      throw new Error("ngay_trong_tuan phải là mảng khi loai là 'tuần'");
    }
    if (ngay_trong_tuan.length === 0) {
      throw new Error("ngay_trong_tuan không được rỗng");
    }
    if (ngay_trong_tuan.some((n) => n < 0 || n > 6)) {
      throw new Error("ngay_trong_tuan phải chứa số từ 0 (CN) đến 6 (T7)");
    }
    normalized.ngay_trong_tuan = ngay_trong_tuan;
  } else if (loai === "tháng") {
    if (!ngay_trong_thang || !Array.isArray(ngay_trong_thang)) {
      throw new Error("ngay_trong_thang phải là mảng khi loai là 'tháng'");
    }
    if (ngay_trong_thang.length === 0) {
      throw new Error("ngay_trong_thang không được rỗng");
    }
    if (ngay_trong_thang.some((n) => n < 1 || n > 31)) {
      throw new Error("ngay_trong_thang phải chứa số từ 1 đến 31");
    }
    normalized.ngay_trong_thang = ngay_trong_thang;
  }
  // loai === "ngày" không cần trường bổ sung

  return normalized;
};

// Hàm validate cấu trúc cac_muc
const validateCacMuc = (cac_muc) => {
  if (!Array.isArray(cac_muc)) {
    throw new Error("cac_muc phải là mảng");
  }

  for (const muc of cac_muc) {
    if (muc.cong_viec && Array.isArray(muc.cong_viec)) {
      for (const cv of muc.cong_viec) {
        // Validate chi_tiet
        if (cv.chi_tiet && !Array.isArray(cv.chi_tiet)) {
          throw new Error("chi_tiet phải là mảng");
        }

        // ✅ Validate và chuẩn hóa quy_dinh
        if (cv.quy_dinh) {
          cv.quy_dinh = validateAndNormalizeQuyDinh(cv.quy_dinh);
        }
      }
    }
  }
};

// Hàm validate cong_viec_khac
const validateCongViecKhac = (cong_viec_khac) => {
  if (!cong_viec_khac || !Array.isArray(cong_viec_khac)) return;

  for (const cv of cong_viec_khac) {
    if (cv.chi_tiet && !Array.isArray(cv.chi_tiet)) {
      throw new Error("chi_tiet trong cong_viec_khac phải là mảng");
    }

    // ✅ Validate và chuẩn hóa quy_dinh
    if (cv.quy_dinh) {
      cv.quy_dinh = validateAndNormalizeQuyDinh(cv.quy_dinh);
    }
  }
};

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
      status,
    } = req.body;

    // Validate status nếu có
    if (
      status &&
      ![
        "Đi làm",
        "Nghỉ ca",
        "Nghỉ bù",
        "Nghỉ phép",
        "Nghỉ không lương",
      ].includes(status)
    ) {
      return res.status(400).json({
        error:
          "status phải là một trong: Đi làm, Nghỉ ca, Nghỉ bù, Nghỉ phép, Nghỉ không lương",
      });
    }

    // ✅ Validate và chuẩn hóa cac_muc
    try {
      validateCacMuc(cac_muc);
      validateCongViecKhac(cong_viec_khac);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const newChecklist = new ChecklistBDH({
      form_id: formId,
      ma_nhan_vien,
      ho_ten,
      don_vi,
      ghi_chu,
      cac_muc,
      cong_viec_khac,
      status,
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
    const checklist = await ChecklistBDH.findById(req.params.id).populate(
      "form_id"
    );
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
    // Validate status nếu có trong body
    if (
      req.body.status &&
      ![
        "Đi làm",
        "Nghỉ ca",
        "Nghỉ bù",
        "Nghỉ phép",
        "Nghỉ không lương",
      ].includes(req.body.status)
    ) {
      return res.status(400).json({
        error:
          "status phải là một trong: Đi làm, Nghỉ ca, Nghỉ bù, Nghỉ phép, Nghỉ không lương",
      });
    }

    // ✅ Validate và chuẩn hóa cac_muc nếu có
    try {
      if (req.body.cac_muc) {
        validateCacMuc(req.body.cac_muc);
      }
      if (req.body.cong_viec_khac) {
        validateCongViecKhac(req.body.cong_viec_khac);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message });
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
    const checklists = await ChecklistBDH.find({ form_id: formId }).populate(
      "form_id"
    );
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Lấy checklist theo status
exports.getChecklistsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    if (
      ![
        "Đi làm",
        "Nghỉ ca",
        "Nghỉ bù",
        "Nghỉ phép",
        "Nghỉ không lương",
      ].includes(status)
    ) {
      return res.status(400).json({
        error: "status không hợp lệ",
      });
    }

    const checklists = await ChecklistBDH.find({ status }).populate("form_id");
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Lấy checklist theo quy định (ngày/tuần/tháng/phát sinh)
exports.getChecklistsByQuyDinh = async (req, res) => {
  try {
    const { loai } = req.params;
    const { ngay } = req.query;

    if (!["ngày", "tuần", "tháng", "phát sinh"].includes(loai)) {
      return res.status(400).json({
        error: "loai phải là: ngày, tuần, tháng, hoặc phát sinh",
      });
    }

    const checklists = await ChecklistBDH.find().populate("form_id");

    const filteredChecklists = checklists.filter((checklist) => {
      return checklist.cac_muc.some((muc) => {
        return muc.cong_viec.some((cv) => {
          if (!cv.quy_dinh) return false;

          // ✅ Xử lý phát sinh
          if (loai === "phát sinh") {
            return (
              cv.quy_dinh.loai === "phát sinh" || cv.quy_dinh.phat_sinh === true
            );
          }

          if (cv.quy_dinh.loai !== loai) return false;

          if (loai === "ngày") return true;

          if (loai === "tuần" && ngay) {
            const date = new Date(ngay);
            const dayOfWeek = date.getDay();
            return cv.quy_dinh.ngay_trong_tuan?.includes(dayOfWeek);
          }

          if (loai === "tháng" && ngay) {
            const date = new Date(ngay);
            const dayOfMonth = date.getDate();
            return cv.quy_dinh.ngay_trong_thang?.includes(dayOfMonth);
          }

          return false;
        });
      });
    });

    res.json(filteredChecklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo quy định:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Lấy tất cả công việc phát sinh
exports.getPhatSinhChecklists = async (req, res) => {
  try {
    const checklists = await ChecklistBDH.find().populate("form_id");

    const filteredChecklists = checklists.filter((checklist) => {
      // Kiểm tra trong cac_muc
      const hasPhatSinhInMuc = checklist.cac_muc.some((muc) => {
        return muc.cong_viec.some((cv) => {
          return (
            cv.quy_dinh &&
            (cv.quy_dinh.loai === "phát sinh" || cv.quy_dinh.phat_sinh === true)
          );
        });
      });

      // Kiểm tra trong cong_viec_khac
      const hasPhatSinhInKhac = checklist.cong_viec_khac?.some((cv) => {
        return (
          cv.quy_dinh &&
          (cv.quy_dinh.loai === "phát sinh" || cv.quy_dinh.phat_sinh === true)
        );
      });

      return hasPhatSinhInMuc || hasPhatSinhInKhac;
    });

    res.json(filteredChecklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist phát sinh:", error);
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
      da_chon: false,
    });

    await checklist.save();
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Cập nhật quy định cho công việc (với logic reset)
exports.updateQuyDinhCongViec = async (req, res) => {
  try {
    const { checklistId, mucIndex, congViecIndex } = req.params;
    const { quy_dinh } = req.body;

    // ✅ Validate và chuẩn hóa quy_dinh
    let normalizedQuyDinh;
    try {
      normalizedQuyDinh = validateAndNormalizeQuyDinh(quy_dinh);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const checklist = await ChecklistBDH.findById(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const congViec = checklist.cac_muc[mucIndex].cong_viec[congViecIndex];
    if (!congViec) {
      return res.status(404).json({ message: "Công việc not found" });
    }

    // ✅ Gán quy định đã được chuẩn hóa
    congViec.quy_dinh = normalizedQuyDinh;
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

    const chiTiet =
      checklist.cac_muc[mucIndex].cong_viec[congViecIndex].chi_tiet[
        chiTietIndex
      ];
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
