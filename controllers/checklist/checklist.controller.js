const Checklist = require("../../models/checklist/checklist");
const dayjs = require("dayjs");

// Tạo checklist mới
exports.createChecklist = async (req, res) => {
  try {
    const formId = req.params.formId;

    if (!formId) {
      return res.status(400).json({ error: "Thiếu formId trong URL." });
    }

    req.body.form_id = formId;

    // Kiểm tra xem option_da_chon có đúng định dạng không
    if (req.body.option_da_chon && !Array.isArray(req.body.option_da_chon)) {
      return res.status(400).json({ error: "Trường option_da_chon phải là mảng." });
    }

    const checklist = new Checklist(req.body);
    await checklist.save();

    res.status(201).json({ message: "Checklist đã được lưu", checklist });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};



// Lấy toàn bộ checklist
exports.getAllChecklist = async (req, res) => {
  try {
    const data = await Checklist.find().sort({ ngay_tao: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChecklistById = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: "Checklist không tồn tại" });
    }
    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCheckListsByFormId = async (req, res) => {
  try {
    const { formId } = req.params;
    const checklists = await Checklist.find({ form_id: formId });
    res.json(checklists);
  } catch (error) {
    console.error("Lỗi khi lấy checklist theo form:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.checkDuplicate = async (req, res) => {
  const { formId } = req.params;
  const { ma_nhan_vien } = req.query;

  const start = dayjs().startOf("day").toDate();
  const end = dayjs().endOf("day").toDate();

  const exists = await Checklist.findOne({
    form_id: formId,
    ma_nhan_vien,
    ngay_tao: { $gte: start, $lte: end },
  });

  res.json({ exists: !!exists });
};