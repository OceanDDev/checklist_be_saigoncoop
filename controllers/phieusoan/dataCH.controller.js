const DataCH = require("../../models/phieusoan/dataCH");

// Lấy tất cả dữ liệu cửa hàng
exports.getAllDataCH = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    let filter = {};
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const searchNum = Number(search.trim());

      const orConditions = [];

      // String fields — dùng regex
      const stringFields = ["mach", "tench", "quan", "ghi_chu_ch"];
      stringFields.forEach((field) => orConditions.push({ [field]: regex }));

      // Number fields — chỉ add nếu search là số hợp lệ
      const numberFields = ["sd_tf", "so_document"];
      if (!isNaN(searchNum)) {
        numberFields.forEach((field) =>
          orConditions.push({ [field]: searchNum }),
        );
      }

      filter = { $or: orConditions };
    }

    // Run song: count + find
    const [total, dataCHs] = await Promise.all([
      DataCH.countDocuments(filter),
      DataCH.find(filter).sort({ ngay_import: -1 }).skip(skip).limit(limitNum),
    ]);

    res.status(200).json({
      data: dataCHs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách cửa hàng", error });
  }
};

// Lấy dữ liệu cửa hàng theo ID
exports.getDataCHById = async (req, res) => {
  try {
    const dataCH = await DataCH.findById(req.params.id);
    if (!dataCH)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    res.status(200).json(dataCH);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy dữ liệu cửa hàng", error });
  }
};

// Thêm một cửa hàng
exports.addDataCH = async (req, res) => {
  try {
    const newDataCH = new DataCH(req.body);
    await newDataCH.save();
    res
      .status(201)
      .json({ message: "Thêm dữ liệu cửa hàng thành công", data: newDataCH });
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi thêm dữ liệu cửa hàng", error });
  }
};

exports.importManyDataCH = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "Dữ liệu không hợp lệ hoặc rỗng",
      });
    }

    console.log(`📦 Bắt đầu import batch: ${data.length} records`);

    // ✅ VALIDATE TẤT CẢ RECORDS TRƯỚC
     const invalidRecords = data.filter(
      (record) => !record.mach || !record.tench || !record.lich_di_hang,
    );

    if (invalidRecords.length > 0) {
      return res.status(400).json({
        message: `Có ${invalidRecords.length} records thiếu mach, tench hoặc lich_di_hang`,
        invalidRecords: invalidRecords.slice(0, 5),
      });
    }

    // ✅ SỬ DỤNG bulkWrite VỚI UPSERT
    // Nhanh hơn rất nhiều so với insert từng record
    const bulkOps = data.map((record) => ({
      updateOne: {
        filter: {
          // Tìm theo mã cửa hàng và số document (nếu có)
          mach: record.mach,
          ...(record.so_document && { so_document: record.so_document }),
        },
        update: {
          $set: {
            sd_tf: record.sd_tf || null,
            so_document: record.so_document || null,
            tench: record.tench,
            quan: record.quan || "",
            chuyen: record.chuyen || "",
              lich_di_hang: record.lich_di_hang || "",
            ghi_chu_ch: record.ghi_chu_ch || "",
            ngay_cap_nhat: new Date(),
          },
          $setOnInsert: {
            ngay_import: record.ngay_import || new Date(),
          },
        },
        upsert: true, // Tạo mới nếu chưa tồn tại
      },
    }));

    // ✅ THỰC HIỆN BULK WRITE
    const result = await DataCH.bulkWrite(bulkOps, {
      ordered: false, // Tiếp tục ngay cả khi có lỗi
    });

    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const matched = result.matchedCount || 0;

    console.log(`✅ Batch import hoàn tất:`, {
      inserted,
      updated,
      matched,
      total: data.length,
    });

    res.status(201).json({
      message: `✅ Import thành công batch ${data.length} records`,
      stats: {
        inserted,
        updated,
        matched,
        total: data.length,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi importManyDataCH:", error);

    // ✅ XỬ LÝ BULK WRITE ERROR
    if (error.name === "BulkWriteError" && error.writeErrors) {
      const errorCount = error.writeErrors.length;
      const errorSamples = error.writeErrors.slice(0, 5).map((e) => ({
        index: e.index,
        message: e.errmsg,
      }));

      return res.status(207).json({
        // 207 = Multi-Status
        message: `Import hoàn tất với ${errorCount} lỗi`,
        stats: {
          inserted: error.result?.nUpserted || 0,
          updated: error.result?.nModified || 0,
          errors: errorCount,
        },
        errorSamples,
      });
    }

    res.status(500).json({
      message: "Lỗi khi import batch DataCH",
      error: error.message,
    });
  }
};

// Cập nhật dữ liệu cửa hàng
exports.updateDataCH = async (req, res) => {
  try {
    const updated = await DataCH.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    res
      .status(200)
      .json({ message: "Cập nhật dữ liệu cửa hàng thành công", data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi cập nhật dữ liệu cửa hàng", error });
  }
};

// Xóa dữ liệu cửa hàng
exports.deleteDataCH = async (req, res) => {
  try {
    const deleted = await DataCH.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    res.status(200).json({ message: "Xóa dữ liệu cửa hàng thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa dữ liệu cửa hàng", error });
  }
};

exports.deleteAllDataCH = async (req, res) => {
  try {
    const result = await DataCH.deleteMany({});
    res.status(200).json({
      message: `Đã xóa toàn bộ dữ liệu cửa hàng (${result.deletedCount} bản ghi)`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi xóa toàn bộ dữ liệu cửa hàng", error });
  }
};
