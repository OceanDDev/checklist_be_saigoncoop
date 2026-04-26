const Inventory = require("../../models/tonkho/tonkho");

// ==========================
// 📥 GET ALL
// ==========================
exports.getInventories = async (req, res) => {
  try {
    const { sku } = req.query; // Lấy SKU từ query string (?sku=...)

    let filter = {};
    if (sku) {
      // Nếu có truyền SKU, hệ thống sẽ lọc đúng SKU đó (ra nhiều vị trí nếu có)
      filter.sku = sku;
    } else {
      // Nếu KHÔNG truyền SKU, ta có thể giới hạn trả về 50 dòng mới nhất
      // Tránh việc trả về 7619 dòng gây lag máy và lỗi giao diện
      const data = await Inventory.find().sort({ createdAt: -1 }).limit(50);
      return res.json(data);
    }

    // Thực hiện tìm kiếm theo bộ lọc SKU
    const data = await Inventory.find(filter).sort({ createdAt: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Trong controllers/TonKho/tonkho.controller.js

exports.getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm theo trường SKU (vì bạn đang truyền SKU vào URL)
    // Nếu database của bạn dùng SKU làm _id thì dùng findById
    // Nếu SKU là một field riêng thì dùng findOne
    const data = await Inventory.findOne({ sku: id });

    if (!data) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy SKU này trong kho" });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// ==========================
// ➕ ADD 1
// ==========================
exports.addInventory = async (req, res) => {
  try {
    const item = req.body;

    const newItem = new Inventory({
      zone: item.zone?.trim(),
      slot: item.slot?.trim(),
      sku: item.sku?.trim(),
      name: item.name?.trim(),
      onHand: Number(item.onHand) || 0,
      pack: Number(item.pack) || 1,
      ngay_ton: item.ngay_ton ? new Date(item.ngay_ton) : new Date(),
    });

    const saved = await newItem.save();

    res.json({
      message: "Thêm thành công",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// ➕ ADD MANY
// ==========================
exports.addManyInventory = async (req, res) => {
  try {
    const data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "Data phải là array",
      });
    }

    const cleanData = data.map((item) => ({
      zone: item.zone?.trim(),
      slot: item.slot?.trim(),
      sku: item.sku?.trim(),
      name: item.name?.trim(),
      onHand: Number(item.onHand) || 0,
      pack: Number(item.pack) || 1,
      ngay_ton: item.ngay_ton ? new Date(item.ngay_ton) : new Date(),
    }));

    const result = await Inventory.insertMany(cleanData, {
      ordered: false,
    });

    res.json({
      message: "Thêm nhiều thành công",
      total: result.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi addMany",
      error: error.message,
    });
  }
};

// ==========================
// 🔥 UPSERT MANY (QUAN TRỌNG)
// ==========================
exports.upsertManyInventory = async (req, res) => {
  try {
    let data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "Data phải là array và không được rỗng",
      });
    }

    const cleanData = data.map((item) => ({
      zone: item.zone?.trim(),
      slot: item.slot?.trim(),
      sku: item.sku?.trim(),
      name: item.name?.trim(),
      onHand: Number(item.onHand) || 0,
      pack: Number(item.pack) || 1,
      ngay_ton: item.ngay_ton ? new Date(item.ngay_ton) : new Date(),
    }));

    const validData = cleanData.filter(
      (item) => item.zone && item.slot && item.sku,
    );

    if (validData.length === 0) {
      return res.status(400).json({
        message: "Không có dữ liệu hợp lệ",
      });
    }

    const bulkOps = validData.map((item) => ({
      updateOne: {
        filter: {
          zone: item.zone,
          slot: item.slot,
          sku: item.sku,
          ngay_ton: item.ngay_ton,
        },
        update: {
          $set: {
            name: item.name,
            onHand: item.onHand,
            pack: item.pack,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await Inventory.bulkWrite(bulkOps, {
      ordered: false,
    });

    res.json({
      message: "Upsert thành công",
      totalInput: data.length,
      valid: validData.length,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi upsertMany",
      error: error.message,
    });
  }
};

// ==========================
// 🔄 UPDATE 1
// ==========================
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Inventory.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy dữ liệu",
      });
    }

    res.json({
      message: "Update thành công",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// ❌ DELETE 1
// ==========================
exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Inventory.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        message: "Không tìm thấy dữ liệu",
      });
    }

    res.json({
      message: "Xóa thành công",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// ❌ DELETE MANY
// ==========================
exports.deleteManyInventory = async (req, res) => {
  try {
    const ids = req.body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids phải là array",
      });
    }

    const result = await Inventory.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      message: "Xóa nhiều thành công",
      deleted: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi deleteMany",
      error: error.message,
    });
  }
};
