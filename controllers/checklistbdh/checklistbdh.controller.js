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

    const newChecklist = new ChecklistBDH({
      form_id: formId,
      ma_nhan_vien,
      ho_ten,
      don_vi,
      ghi_chu,
      cac_muc, // dạng mảng các mục, mỗi mục có ten_muc và cong_viec
      cong_viec_khac, // dạng mảng công việc tùy chọn
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
    const lists = await ChecklistBDH.find().populate("checklist_form_id");  
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy checklist theo ID
exports.getChecklistById = async (req, res) => {
  try {
    const checklist = await ChecklistBDH.findById(req.params.id).populate("checklist_form_id");
    if (!checklist) return res.status(404).json({ message: "Checklist not found" });
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật checklist theo ID
exports.updateChecklist = async (req, res) => {
  try {
    const updated = await ChecklistBDH.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("checklist_form_id");

    if (!updated) return res.status(404).json({ message: "Checklist not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa checklist theo ID
exports.deleteChecklist = async (req, res) => {
  try {
    const deleted = await ChecklistBDH.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ message: "Checklist not found" });

    res.json({ message: "Checklist deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy checklist theo checklist_form_id
exports.getCheckListsByFormIdBDH = async (req, res) => {
  try {
    const { formId } = req.params;
    const checklists = await ChecklistBDH.find({ form_id: formId });
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error); 
    res.status(500).json({ error: "Server error" });
  }
};
