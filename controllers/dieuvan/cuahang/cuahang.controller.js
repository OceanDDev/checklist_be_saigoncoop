const Cuahang = require("../../../models/dieuvan/cuahang/cuahang");

// Tạo cửa hàng mới
exports.createCuahang = async (req, res) => {
  try {
    const { maCH, tenCH, tenCHTruong, email } = req.body;

    // Kiểm tra trùng mã CH
    const existing = await Cuahang.findOne({ maCH });
    if (existing) {
      return res.status(400).json({ message: "Mã cửa hàng đã tồn tại." });
    }

    const newCH = new Cuahang({ maCH, tenCH, tenCHTruong, email });
    await newCH.save();

    res.status(201).json({ message: "Tạo cửa hàng thành công", data: newCH });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy danh sách tất cả cửa hàng
exports.getAllCuahang = async (req, res) => {
  try {
    const cuahangs = await Cuahang.find().sort({ createdAt: -1 });
    res.status(200).json(cuahangs);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy chi tiết 1 cửa hàng theo ID
exports.getCuahangById = async (req, res) => {
  try {
    const { id } = req.params;
    const cuahang = await Cuahang.findById(id);
    if (!cuahang) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    }
    res.status(200).json(cuahang);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật cửa hàng
exports.updateCuahang = async (req, res) => {
  try {
    const { id } = req.params;
    const { maCH, tenCH, tenCHTruong, email } = req.body;

    const updated = await Cuahang.findByIdAndUpdate(
      id,
      { maCH, tenCH, tenCHTruong, email },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy cửa hàng để cập nhật" });
    }

    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Xóa cửa hàng
exports.deleteCuahang = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Cuahang.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy cửa hàng để xóa" });
    }

    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
// Thêm nhiều cửa hàng cùng lúc
// Thêm nhiều cửa hàng cùng lúc
exports.createManyCuahang = async (req, res) => {
  try {
    const cuahangs = req.body; // nhận mảng các cửa hàng [{...}, {...}]

    if (!Array.isArray(cuahangs) || cuahangs.length === 0) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    // Kiểm tra trùng maCH với database
    const maCHs = cuahangs.map((ch) => ch.maCH);
    const existingCuahangs = await Cuahang.find({ maCH: { $in: maCHs } });
    const existingMaCHs = existingCuahangs.map((ch) => ch.maCH);

    // Tách các cửa hàng không trùng và bị trùng
    const validCuahangs = cuahangs.filter(
      (ch) => !existingMaCHs.includes(ch.maCH)
    );
    const duplicateCuahangs = cuahangs.filter((ch) =>
      existingMaCHs.includes(ch.maCH)
    );

    // Nếu không có cửa hàng nào hợp lệ
    if (validCuahangs.length === 0) {
      return res.status(400).json({
        message: "Tất cả mã cửa hàng đã tồn tại",
        duplicates: duplicateCuahangs.map((ch) => ({
          maCH: ch.maCH,
          tenCH: ch.tenCH,
        })),
        inserted: [],
      });
    }

    // Thêm các cửa hàng hợp lệ vào database
    const inserted = await Cuahang.insertMany(validCuahangs);

    // Trả về kết quả
    const response = {
      message: `Thêm thành công ${inserted.length} cửa hàng`,
      inserted: inserted,
      total: cuahangs.length,
      success: inserted.length,
      failed: duplicateCuahangs.length,
    };

    // Thêm thông tin về các cửa hàng bị trùng nếu có
    if (duplicateCuahangs.length > 0) {
      response.duplicates = duplicateCuahangs.map((ch) => ({
        maCH: ch.maCH,
        tenCH: ch.tenCH,
      }));
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
exports.getCuahangByMaCH = async (req, res) => {
  try {
    const cuahang = await Cuahang.findOne({ maCH: req.params.maCH });
    if (!cuahang) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    }
    res.json({ data: cuahang });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
