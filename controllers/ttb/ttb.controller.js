// controllers/ttbController.js
const Ttb = require("../../models/ttb/ttb");
const Cuahang = require("../../models/dieuvan/cuahang/cuahang");

// Hàm helper để lấy thông tin cửa hàng
const getCuahangInfo = async (maCH) => {
  const cuahang = await Cuahang.findOne({ maCH: maCH });
  if (!cuahang) {
    throw new Error(`Không tìm thấy cửa hàng với mã: ${maCH}`);
  }
  return cuahang;
};

// Hàm helper để validate và tính can_tru cho TTB
const validateAndCalculateTtb = (ttbArray) => {
  if (!Array.isArray(ttbArray)) {
    throw new Error("TTB phải là một mảng");
  }

  return ttbArray.map((item) => {
    const di_ch = item.di_ch || 0;
    const ch_tra_ve = item.ch_tra_ve || 0;

    // Tự động tính CẤN TRỪ (có thể âm nếu CH TRẢ VỀ > ĐI CH - trường hợp nợ tháng trước)
    const can_tru = di_ch - ch_tra_ve;

    return {
      ten_ttb: item.ten_ttb,
      di_ch,
      ch_tra_ve,
      can_tru,
    };
  });
};

// Tạo một TTB mới
exports.createTtb = async (req, res) => {
  try {
    const { ma_cua_hang, day, so_bb, ttb, tai_xe, bien_so_xe, ghi_chu } =
      req.body;

    // Lấy thông tin cửa hàng từ mã cửa hàng
    const cuahang = await getCuahangInfo(ma_cua_hang);

    // Validate và tính can_tru cho TTB
    const processedTtb = validateAndCalculateTtb(ttb);

    // Tạo TTB mới với tên cửa hàng tự động
    const newTtb = new Ttb({
      day,
      so_bb,
      ma_cua_hang: cuahang.maCH,
      cua_hang: cuahang.tenCH,
      tai_xe,
      bien_so_xe,
      ttb: processedTtb,
      ghi_chu,
    });

    const savedTtb = await newTtb.save();

    res.status(201).json({
      success: true,
      message: "Tạo TTB thành công",
      data: savedTtb,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo nhiều TTB cùng lúc
exports.addManyTtb = async (req, res) => {
  try {
    const ttbList = req.body.ttbList;

    if (!Array.isArray(ttbList) || ttbList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng ttbList",
      });
    }

    // Xử lý từng TTB để lấy tên cửa hàng và validate
    const processedTtbList = await Promise.all(
      ttbList.map(async (item) => {
        const cuahang = await getCuahangInfo(item.ma_cua_hang);

        // Validate và tính can_tru
        const processedTtb = validateAndCalculateTtb(item.ttb);

        return {
          ...item,
          ma_cua_hang: cuahang.maCH,
          cua_hang: cuahang.tenCH,
          ttb: processedTtb,
        };
      })
    );

    // Insert nhiều TTB
    const savedTtbs = await Ttb.insertMany(processedTtbList);

    res.status(201).json({
      success: true,
      message: `Tạo thành công ${savedTtbs.length} TTB`,
      data: savedTtbs,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật hàm getAllTtb để tích hợp search đầy đủ
exports.getAllTtb = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 999999,
      ma_cua_hang,
      so_bb,
      tai_xe,
      bien_so_xe,
      ngay_di_start, // Từ ngày
      ngay_di_end, // Đến ngày
    } = req.query;

    console.log("=== GET ALL TTB ===");
    console.log("Query params:", req.query);

    // Tạo filter động
    const filter = {};

    // Tìm theo số BB (không phân biệt hoa thường)
    if (so_bb && so_bb.trim() !== "") {
      filter.so_bb = new RegExp(so_bb.trim(), "i");
    }

    // Tìm theo mã cửa hàng (chính xác)
    if (ma_cua_hang && ma_cua_hang.trim() !== "") {
      filter.ma_cua_hang = ma_cua_hang.trim();
    }

    // Tìm theo tài xế (không phân biệt hoa thường)
    if (tai_xe && tai_xe.trim() !== "") {
      filter.tai_xe = new RegExp(tai_xe.trim(), "i");
    }

    // Tìm theo biển số xe (không phân biệt hoa thường)
    if (bien_so_xe && bien_so_xe.trim() !== "") {
      filter.bien_so_xe = new RegExp(bien_so_xe.trim(), "i");
    }

    // Tìm theo khoảng ngày
    if (ngay_di_start || ngay_di_end) {
      filter["day.ngay_di"] = {};

      if (ngay_di_start) {
        // Bắt đầu từ 00:00:00 của ngày start
        const startDate = new Date(ngay_di_start);
        startDate.setHours(0, 0, 0, 0);
        filter["day.ngay_di"].$gte = startDate;
      }

      if (ngay_di_end) {
        // Kết thúc ở 23:59:59 của ngày end
        const endDate = new Date(ngay_di_end);
        endDate.setHours(23, 59, 59, 999);
        filter["day.ngay_di"].$lte = endDate;
      }
    }

    console.log("Filter:", JSON.stringify(filter, null, 2));

    // Query với pagination
    const ttbs = await Ttb.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ "day.ngay_di": -1, createdAt: -1 }); // Sắp xếp theo ngày đi giảm dần

    const count = await Ttb.countDocuments(filter);

    console.log("Kết quả:", {
      found: count,
      returned: ttbs.length,
    });

    res.status(200).json({
      success: true,
      data: ttbs,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalItems: count,
    });
  } catch (error) {
    console.error("=== LỖI GET ALL TTB ===", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy TTB theo ID
exports.getTtbById = async (req, res) => {
  try {
    const ttb = await Ttb.findById(req.params.id);

    if (!ttb) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy TTB",
      });
    }

    res.status(200).json({
      success: true,
      data: ttb,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật TTB
exports.updateTtb = async (req, res) => {
  try {
    console.log("=== BACKEND NHẬN ĐƯỢC ===");
    console.log("ID:", req.params.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    const { ma_cua_hang, ttb, ...otherFields } = req.body;

    // Tạo updateData
    let updateData = { ...otherFields };

    // Nếu có thay đổi mã cửa hàng, lấy tên mới
    if (ma_cua_hang) {
      const cuahang = await getCuahangInfo(ma_cua_hang);
      updateData.ma_cua_hang = cuahang.maCH;
      updateData.cua_hang = cuahang.tenCH;
    }

    // Validate và tính can_tru cho TTB nếu có update
    if (ttb && Array.isArray(ttb)) {
      const processedTtb = validateAndCalculateTtb(ttb);
      updateData.ttb = processedTtb;
    }

    console.log("=== UPDATE DATA ===");
    console.log(JSON.stringify(updateData, null, 2));

    const updatedTtb = await Ttb.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTtb) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy TTB",
      });
    }

    console.log("=== SAU KHI UPDATE ===");
    console.log("TTB field:", JSON.stringify(updatedTtb.ttb, null, 2));

    res.status(200).json({
      success: true,
      message: "Cập nhật TTB thành công",
      data: updatedTtb,
    });
  } catch (error) {
    console.error("=== LỖI UPDATE ===", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa TTB
exports.deleteTtb = async (req, res) => {
  try {
    const deletedTtb = await Ttb.findByIdAndDelete(req.params.id);

    if (!deletedTtb) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy TTB",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa TTB thành công",
      data: deletedTtb,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa nhiều TTB
exports.deleteManyTtb = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng ids",
      });
    }

    const result = await Ttb.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} TTB`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Thống kê TTB theo cửa hàng
exports.getStatsByStore = async (req, res) => {
  try {
    const stats = await Ttb.aggregate([
      {
        $group: {
          _id: "$ma_cua_hang",
          cua_hang: { $first: "$cua_hang" },
          so_luong_bb: { $sum: 1 },
          tong_di_ch: {
            $sum: {
              $reduce: {
                input: "$ttb",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.di_ch"] },
              },
            },
          },
          tong_ch_tra_ve: {
            $sum: {
              $reduce: {
                input: "$ttb",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.ch_tra_ve"] },
              },
            },
          },
        },
      },
      { $sort: { so_luong_bb: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Thêm function này vào ttbController.js

// Cập nhật nhiều TTB cùng lúc
exports.updateManyTtb = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mảng updates",
      });
    }

    console.log("=== BACKEND NHẬN ĐƯỢC ===");
    console.log("Số lượng records cần update:", updates.length);

    // Xử lý từng update
    const updatePromises = updates.map(async (item) => {
      const { _id, ma_cua_hang, ttb, ...otherFields } = item;

      if (!_id) {
        throw new Error("Mỗi item phải có _id");
      }

      // Tạo updateData
      let updateData = { ...otherFields };

      // Nếu có thay đổi mã cửa hàng, lấy tên mới
      if (ma_cua_hang) {
        const cuahang = await getCuahangInfo(ma_cua_hang);
        updateData.ma_cua_hang = cuahang.maCH;
        updateData.cua_hang = cuahang.tenCH;
      }

      // Validate và tính can_tru cho TTB nếu có update
      if (ttb && Array.isArray(ttb)) {
        const processedTtb = validateAndCalculateTtb(ttb);
        updateData.ttb = processedTtb;
      }

      return Ttb.findByIdAndUpdate(
        _id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    });

    const results = await Promise.all(updatePromises);

    // Đếm số records thành công
    const successCount = results.filter((r) => r !== null).length;

    console.log("=== KẾT QUẢ UPDATE ===");
    console.log("Thành công:", successCount);
    console.log("Thất bại:", updates.length - successCount);

    res.status(200).json({
      success: true,
      message: `Cập nhật thành công ${successCount}/${updates.length} TTB`,
      data: results,
      successCount,
      totalCount: updates.length,
    });
  } catch (error) {
    console.error("=== LỖI UPDATE MANY ===", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
