const PhieuLe = require("../../models/phieusoan/phieule");
const DataCH = require("../../models/phieusoan/dataCH");
const DinhVi = require("../../models/phieusoan/dinhvi");

const fs = require("fs").promises;
const path = require("path");

// ===== HELPER - Map DataCH info by MACH (dùng cho Soda/WPK137) =====
async function mapDataCHInfoByMach(mach, sd_tf = null) {
  try {
    const dataCH = await DataCH.findOne({
      mach: { $regex: `^${mach}$`, $options: "i" },
    });

    if (dataCH) {
      return {
        sd_tf: sd_tf, // ✅ luôn lấy từ file WPK (SODA ORDER)
        mach: mach, // ✅ luôn lấy từ file WPK (STORE)
        tench: dataCH.tench, // lấy từ DataCH
        quan: dataCH.quan, // lấy từ DataCH
        chuyen: dataCH.chuyen, // lấy từ DataCH
        ghi_chu_ch: dataCH.ghi_chu_ch || "",
      };
    }

    // Không tìm thấy trong DataCH → vẫn lưu với mach + sd_tf từ file
    console.warn(`⚠️ Không tìm thấy DataCH cho mach: ${mach}`);
    return {
      sd_tf: sd_tf,
      mach: mach,
      tench: "",
      quan: "",
      chuyen: "",
      ghi_chu_ch: "",
    };
  } catch (error) {
    console.error(`❌ Lỗi mapDataCHInfoByMach cho mach ${mach}:`, error);
    return {
      sd_tf: sd_tf,
      mach: mach,
      tench: "",
      quan: "",
      chuyen: "",
      ghi_chu_ch: "",
    };
  }
}
// ===== HELPER: Lấy pack từ DinhVi theo nhiều SKU =====
async function getPackByMultipleSKU(skuList) {
  try {
    const dinhViList = await DinhVi.find(
      { sku: { $in: skuList } },
      { sku: 1, pack: 1 },
    ).lean();

    const packMap = {};
    dinhViList.forEach((dv) => {
      if (dv.pack && dv.pack > 0) {
        packMap[dv.sku] = dv.pack;
      }
    });

    return packMap;
  } catch (error) {
    console.error("❌ Error getting pack from DinhVi:", error);
    return {};
  }
}

// ===== HELPER: Populate khối lượng từ DinhVi vào chi_tiet =====
async function populateKhoiLuongForPhieuLe(phieuLe) {
  if (!phieuLe.chi_tiet || phieuLe.chi_tiet.length === 0) return;

  const skusNeedKhoiLuong = phieuLe.chi_tiet
    .filter((item) => !item.khoi_luong || item.khoi_luong === 0)
    .map((item) => item.sku);

  if (skusNeedKhoiLuong.length === 0) return;

  try {
    const dinhViList = await DinhVi.find(
      { sku: { $in: skusNeedKhoiLuong } },
      { sku: 1, khoiluong: 1 },
    ).lean();

    const khoiLuongMap = {};
    dinhViList.forEach((dv) => {
      if (dv.khoiluong && dv.khoiluong > 0) {
        khoiLuongMap[dv.sku] = dv.khoiluong;
      }
    });

    phieuLe.chi_tiet.forEach((item) => {
      if (!item.khoi_luong || item.khoi_luong === 0) {
        item.khoi_luong = khoiLuongMap[item.sku] || 0;
      }
    });
  } catch (error) {
    console.error("❌ Lỗi khi populate khối lượng:", error);
  }
}

// ===== CALCULATE TONG KIEN - TÍNH TỔNG TRƯỚC, LÀM TRÒN SAU =====
async function calculateTongKien(chiTiet) {
  let tongKien = 0;

  const skusNeedPack = chiTiet
    .filter((item) => item.pack_unit === 1)
    .map((item) => item.sku);

  let packUnit1Map = {};
  if (skusNeedPack.length > 0) {
    packUnit1Map = await getPackByMultipleSKU(skusNeedPack);
  }

  console.log("\n🔍 === BẮT ĐẦU TÍNH TỔNG KIỆN ===");
  console.log(`📋 Tổng số items: ${chiTiet.length}`);

  for (const item of chiTiet) {
    const before = tongKien;

    console.log(`\n📦 SKU ${item.sku}:`, {
      pack_unit: item.pack_unit,
      quantity: item.quantity,
      packs_to_pick: item.packs_to_pick,
      packs_to_pick_1: item.packs_to_pick_1,
    });

    // Ưu tiên packs_to_pick_1 nếu có giá trị > 0
    if (item.packs_to_pick_1 && item.packs_to_pick_1 > 0) {
      tongKien += item.packs_to_pick_1;
      console.log(`  ✅ Dùng packs_to_pick_1: ${item.packs_to_pick_1}`);
      console.log(`  📊 Tổng: ${before.toFixed(2)} → ${tongKien.toFixed(2)}`);
      continue;
    }

    if (item.pack_unit === 1) {
      const packUnit1 = packUnit1Map[item.sku];

      if (packUnit1 && packUnit1 > 0) {
        const rawValue = item.quantity / packUnit1;
        tongKien += rawValue;
        console.log(
          `  ✅ Tính từ pack: ${item.quantity}/${packUnit1} = ${rawValue.toFixed(2)}`,
        );
      } else if (item.packs_to_pick && item.packs_to_pick > 0) {
        tongKien += item.packs_to_pick;
        console.log(`  ✅ Dùng packs_to_pick: ${item.packs_to_pick}`);
      } else {
        console.log(`  ⚠️ KHÔNG CÓ GIÁ TRỊ ĐỂ TÍNH!`);
      }
    } else {
      if (item.packs_to_pick && item.packs_to_pick > 0) {
        tongKien += item.packs_to_pick;
        console.log(
          `  ✅ pack_unit=${item.pack_unit}, dùng packs_to_pick: ${item.packs_to_pick}`,
        );
      } else {
        console.log(
          `  ⚠️ pack_unit=${item.pack_unit} NHƯNG KHÔNG CÓ packs_to_pick!`,
        );
      }
    }

    console.log(
      `  📊 Tổng: ${before.toFixed(2)} → ${tongKien.toFixed(2)} (+${(tongKien - before).toFixed(2)})`,
    );
  }

  const finalTongKien = Math.ceil(tongKien);

  console.log(`\n✅ === KẾT QUẢ ===`);
  console.log(`📊 Tổng thập phân: ${tongKien.toFixed(2)}`);
  console.log(`📊 Tổng làm tròn: ${finalTongKien} KIỆN\n`);

  return finalTongKien;
}

/**
 * ✅ MỚI: Điền packs_to_pick_1 vào chi_tiet và tính tong_kien ngay tại thời điểm import.
 * Gọi hàm này ngay SAU KHI tạo phiếu mới (trước khi save lần cuối).
 * @param {Array} chiTiet - mảng chi_tiet (sẽ bị mutate trực tiếp)
 * @returns {number} tong_kien đã làm tròn
 */
async function populatePacksToPick1AndTongKien(chiTiet) {
  if (!chiTiet || chiTiet.length === 0) return 0;

  // Lấy pack cho tất cả SKU có pack_unit === 1
  const skusNeedPack = chiTiet
    .filter((item) => item.pack_unit === 1)
    .map((item) => item.sku);

  let packMap = {};
  if (skusNeedPack.length > 0) {
    packMap = await getPackByMultipleSKU(skusNeedPack);
  }

  // Điền packs_to_pick_1 vào từng item (chỉ khi chưa có)
  for (const item of chiTiet) {
    if (
      item.pack_unit === 1 &&
      (item.packs_to_pick_1 === undefined || item.packs_to_pick_1 === null)
    ) {
      const pack = packMap[item.sku];
      if (pack && pack > 0) {
        item.packs_to_pick_1 = parseFloat((item.quantity / pack).toFixed(2));
        item.pack_unit_1 = pack;
        console.log(
          `  ✅ SKU ${item.sku}: packs_to_pick_1 = ${item.packs_to_pick_1} (qty ${item.quantity} / pack ${pack})`,
        );
      }
    }
  }

  // Tính tong_kien dựa trên chi_tiet đã được điền
  return await calculateTongKien(chiTiet);
}

// ===== HELPER - Cập nhật packs_to_pick_1 cho nhiều chi tiết items =====
async function updateMultipleChiTietHelper(phieuId, updates) {
  try {
    const phieu = await PhieuLe.findById(phieuId);

    if (!phieu) {
      throw new Error("Không tìm thấy phiếu lẻ");
    }

    let updatedCount = 0;
    const notFoundSkus = [];

    for (const update of updates) {
      const itemIndex = phieu.chi_tiet.findIndex(
        (item) => item.sku === update.sku,
      );

      if (itemIndex !== -1) {
        phieu.chi_tiet[itemIndex].packs_to_pick_1 = parseFloat(
          parseFloat(update.packs_to_pick_1).toFixed(2),
        );
        updatedCount++;
      } else {
        notFoundSkus.push(update.sku);
      }
    }

    phieu.tong_kien = await calculateTongKien(phieu.chi_tiet);
    phieu.ngay_cap_nhat = new Date();

    await phieu.save();

    const result = {
      success: true,
      message: `Đã cập nhật ${updatedCount} items`,
      updated_count: updatedCount,
      tong_kien: phieu.tong_kien,
    };

    if (notFoundSkus.length > 0) {
      result.warning = `${notFoundSkus.length} SKU không tìm thấy`;
      result.not_found_skus = notFoundSkus;
    }

    return result;
  } catch (error) {
    console.error("❌ Error updating multiple chi tiet:", error);
    throw error;
  }
}

// ===== GET ALL - Có filter theo ngày import và ngày in phiếu =====
exports.getAllPhieuLe = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const {
      so_document,
      sku,
      slot,
      trang_thai,
      mach,
      loai_phieu,
      chuyen,
      quan,
      search,
      startDate,
      endDate,
      printStartDate,
      printEndDate,
    } = req.query;

    const filter = {};

    if (so_document) filter.so_document = parseInt(so_document);
    if (trang_thai) filter.trang_thai = trang_thai;
    if (loai_phieu) filter.loai_phieu = loai_phieu;
    if (mach) filter.mach = { $regex: `^${mach}$`, $options: "i" };
    if (chuyen) filter.chuyen = { $regex: chuyen, $options: "i" };
    if (quan) {
      const cleanQuan = quan.trim().replace(/\s+/g, "\\s+");
      filter.quan = { $regex: `^${cleanQuan}$`, $options: "i" };
    }
    if (sku) filter["chi_tiet.sku"] = parseInt(sku);
    if (slot) filter["chi_tiet.slot"] = { $regex: String(slot), $options: "i" };

    // Filter theo ngày import (chỉ khi không có print date filter)
    if ((startDate || endDate) && !printStartDate && !printEndDate) {
      filter.ngay_import = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.ngay_import.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.ngay_import.$lte = end;
      }
    }

    // Filter theo ngày in phiếu (độc lập)
    if (printStartDate || printEndDate) {
      const printDateFilter = { $ne: null };
      if (printStartDate) {
        const start = new Date(printStartDate);
        start.setHours(0, 0, 0, 0);
        printDateFilter.$gte = start;
      }
      if (printEndDate) {
        const end = new Date(printEndDate);
        end.setHours(23, 59, 59, 999);
        printDateFilter.$lte = end;
      }
      filter.ngay_in_phieu = printDateFilter;
    }

    // Search tổng hợp
    if (search) {
      const searchNum = parseInt(search);
      const conditions = [
        { "chi_tiet.name": { $regex: search, $options: "i" } },
        { "chi_tiet.slot": { $regex: search, $options: "i" } },
        { mach: { $regex: search, $options: "i" } },
        { tench: { $regex: search, $options: "i" } },
        { quan: { $regex: search, $options: "i" } },
        { chuyen: { $regex: search, $options: "i" } },
      ];

      if (!isNaN(searchNum)) {
        conditions.push({ so_document: searchNum });
        conditions.push({ "chi_tiet.sku": searchNum });
        conditions.push({ "chi_tiet.vendor": searchNum });
        conditions.push({ sd_tf: searchNum });
      }

      if (mach || chuyen) {
        const existingFilters = { ...filter };
        delete existingFilters.mach;
        delete existingFilters.chuyen;

        filter.$and = [{ $or: conditions }];
        if (mach)
          filter.$and.push({ mach: { $regex: `^${mach}$`, $options: "i" } });
        if (chuyen)
          filter.$and.push({ chuyen: { $regex: chuyen, $options: "i" } });

        Object.assign(filter, existingFilters);
      } else {
        filter.$or = conditions;
      }
    }

    console.log("📋 Final Filter:", JSON.stringify(filter, null, 2));

    const [total, phieuLes] = await Promise.all([
      PhieuLe.countDocuments(filter),
      PhieuLe.find(filter).sort({ ngay_import: -1 }).skip(skip).limit(limit),
    ]);

    await Promise.all(
      phieuLes.map((phieu) => populateKhoiLuongForPhieuLe(phieu)),
    );

    res.status(200).json({
      data: phieuLes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi getAllPhieuLe:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách phiếu lẻ",
      error: error.message,
    });
  }
};

// ===== GET BY ID =====
exports.getPhieuLeById = async (req, res) => {
  try {
    const phieuLe = await PhieuLe.findById(req.params.id);
    if (!phieuLe) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }
    await populateKhoiLuongForPhieuLe(phieuLe);
    res.status(200).json(phieuLe);
  } catch (error) {
    console.error("❌ Lỗi getPhieuLeById:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi lấy phiếu lẻ", error: error.message });
  }
};

// ===== GET BY SO_DOCUMENT =====
exports.getPhieuLeBySoDocument = async (req, res) => {
  try {
    const so_document = parseInt(req.params.so_document);
    const phieuLe = await PhieuLe.findOne({ so_document });

    if (!phieuLe) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phiếu lẻ với số document này" });
    }

    res.status(200).json(phieuLe);
  } catch (error) {
    console.error("❌ Lỗi getPhieuLeBySoDocument:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi lấy phiếu lẻ", error: error.message });
  }
};

// ===== HELPER - Map DataCH info =====
async function mapDataCHInfo(so_document) {
  try {
    const dataCH = await DataCH.findOne({ so_document });

    if (dataCH) {
      return {
        sd_tf: dataCH.sd_tf,
        mach: dataCH.mach,
        tench: dataCH.tench,
        quan: dataCH.quan,
        chuyen: dataCH.chuyen,
        ghi_chu_ch: dataCH.ghi_chu_ch || "",
      };
    }

    return {
      sd_tf: null,
      mach: "",
      tench: "",
      quan: "",
      chuyen: "",
      ghi_chu_ch: "",
    };
  } catch (error) {
    console.error(`❌ Lỗi khi map DataCH cho Document ${so_document}:`, error);
    return {
      sd_tf: null,
      mach: "",
      tench: "",
      quan: "",
      chuyen: "",
      ghi_chu_ch: "",
    };
  }
}

// ===== CREATE - Thêm một phiếu lẻ =====
exports.createPhieuLe = async (req, res) => {
  try {
    const { so_document, chi_tiet, trang_thai } = req.body;

    if (!so_document) {
      return res.status(400).json({ message: "Thiếu số document" });
    }

    if (!Array.isArray(chi_tiet) || chi_tiet.length === 0) {
      return res
        .status(400)
        .json({ message: "Chi tiết phiếu lẻ phải là mảng và không được rỗng" });
    }

    const existing = await PhieuLe.findOne({ so_document });
    if (existing) {
      return res.status(409).json({
        message: `Số document ${so_document} đã tồn tại`,
        so_document,
      });
    }

    const dataCHInfo = await mapDataCHInfo(so_document);

    // ✅ Điền packs_to_pick_1 và tính tong_kien ngay khi tạo mới
    const chiTietCopy = chi_tiet.map((item) => ({ ...item }));
    const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

    const newPhieuLe = new PhieuLe({
      so_document,
      chi_tiet: chiTietCopy,
      trang_thai: trang_thai || "Chờ xử lý",
      tong_kien,
      ...dataCHInfo,
    });

    await newPhieuLe.save();

    res.status(201).json({
      message: "Thêm phiếu lẻ thành công",
      data: newPhieuLe,
    });
  } catch (error) {
    console.error("❌ Lỗi createPhieuLe:", error);
    res
      .status(400)
      .json({ message: "Lỗi khi thêm phiếu lẻ", error: error.message });
  }
};

// ===== IMPORT MANY - Import nhiều phiếu lẻ (THROW ERROR KHI TRÙNG) =====
exports.importManyPhieuLe = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu không hợp lệ hoặc rỗng" });
    }

    const invalidDocs = data.filter(
      (doc) =>
        !doc.so_document ||
        !Array.isArray(doc.chi_tiet) ||
        doc.chi_tiet.length === 0,
    );

    if (invalidDocs.length > 0) {
      return res.status(400).json({
        message: `Có ${invalidDocs.length} document không hợp lệ`,
        invalidDocs: invalidDocs.slice(0, 5),
      });
    }

    const soDocuments = data.map((d) => d.so_document);

    const existingDocs = await PhieuLe.find(
      { so_document: { $in: soDocuments } },
      { so_document: 1 },
    ).lean();

    if (existingDocs.length > 0) {
      const duplicateDocs = existingDocs.map((d) => d.so_document);
      return res.status(409).json({
        message: `Có ${duplicateDocs.length} document đã tồn tại: ${duplicateDocs.join(", ")}`,
        duplicate_documents: duplicateDocs,
      });
    }

    const dataCHs = await DataCH.find({ so_document: { $in: soDocuments } });
    const dataCHMap = new Map();
    dataCHs.forEach((ch) => {
      dataCHMap.set(ch.so_document, {
        sd_tf: ch.sd_tf,
        mach: ch.mach,
        tench: ch.tench,
        quan: ch.quan,
        chuyen: ch.chuyen,
        ghi_chu_ch: ch.ghi_chu_ch || "",
      });
    });

    // ✅ Điền packs_to_pick_1 và tính tong_kien cho từng document
    const newDocs = await Promise.all(
      data.map(async (doc) => {
        const dataCHInfo = dataCHMap.get(doc.so_document) || {
          sd_tf: null,
          mach: "",
          tench: "",
          quan: "",
          chuyen: "",
          ghi_chu_ch: "",
        };

        const chiTietCopy = doc.chi_tiet.map((item) => ({ ...item }));
        const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

        return {
          so_document: doc.so_document,
          chi_tiet: chiTietCopy,
          trang_thai: doc.trang_thai || "Chờ xử lý",
          ngay_import: doc.ngay_import || new Date(),
          tong_kien,
          ...dataCHInfo,
        };
      }),
    );

    const result = await PhieuLe.insertMany(newDocs, { ordered: false });

    res.status(201).json({
      message: `✅ Import thành công ${result.length} phiếu lẻ`,
      inserted: result.length,
    });
  } catch (error) {
    console.error("❌ Lỗi importManyPhieuLe:", error);

    if (error.code === 11000) {
      const duplicateDoc = error.keyValue?.so_document;
      return res.status(409).json({
        message: `Số document ${duplicateDoc} đã tồn tại trong database`,
        so_document: duplicateDoc,
      });
    }

    res
      .status(500)
      .json({ message: "Lỗi khi import phiếu lẻ", error: error.message });
  }
};

// ===== IMPORT TXT - Import 1 file txt =====
exports.importTxtPhieuLe = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const filePath = req.file.path;

    const fileBuffer = await fs.readFile(filePath);

    let fileContent;
    if (
      fileBuffer[0] === 0xef &&
      fileBuffer[1] === 0xbb &&
      fileBuffer[2] === 0xbf
    ) {
      fileContent = fileBuffer.slice(3).toString("utf-8");
    } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
      fileContent = fileBuffer.slice(2).toString("utf16le");
    } else if (fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
      fileContent = fileBuffer.slice(2).toString("utf16le");
    } else {
      fileContent = fileBuffer.toString("utf-8");
    }

    fileContent = fileContent.replace(/^[\x00-\x1F\uFEFF\uFFFE]+/, "");

    const parsedData = parseTxtContent(fileContent);

    if (!parsedData || !parsedData.so_document) {
      await fs.unlink(filePath).catch(console.error);
      return res.status(400).json({
        message: "Format file txt không hợp lệ hoặc không có số document",
      });
    }

    const hasChiTiet =
      Array.isArray(parsedData.chi_tiet) && parsedData.chi_tiet.length > 0;
    const hasSdTf = parsedData.sd_tf !== null && parsedData.sd_tf !== undefined;

    // Trường hợp 1: File chỉ có sd_tf → update trạng thái
    if (!hasChiTiet && hasSdTf) {
      const dataCHInfo = await mapDataCHInfo(parsedData.so_document);

      const bulkOp = {
        updateOne: {
          filter: { so_document: parsedData.so_document },
          update: {
            $set: {
              trang_thai: parsedData.trang_thai || "Chờ xử lý",
              loai_phieu: parsedData.loai_phieu || "TF", // ✅ thêm dòng này

              ngay_cap_nhat: new Date(),
              ...dataCHInfo,
            },
            $setOnInsert: { ngay_import: new Date() },
          },
          upsert: true,
        },
      };

      const result = await PhieuLe.bulkWrite([bulkOp]);
      await fs.unlink(filePath).catch(console.error);

      const isNew = result.upsertedCount > 0;

      return res.status(isNew ? 201 : 200).json({
        message: isNew
          ? "✅ Tạo mới phiếu lẻ thành công (chỉ có sd_tf)"
          : "✅ Cập nhật trạng thái thành công",
        filename: req.file.originalname,
        so_document: parsedData.so_document,
        sd_tf: dataCHInfo.sd_tf,
        stats: {
          inserted: result.upsertedCount || 0,
          updated: result.modifiedCount || 0,
        },
      });
    }

    // Trường hợp 2: File không có gì hết
    if (!hasChiTiet) {
      await fs.unlink(filePath).catch(console.error);
      return res
        .status(400)
        .json({ message: "File không hợp lệ: không có chi tiết hoặc sd_tf" });
    }

    // Trường hợp 3: Có chi_tiet đầy đủ → kiểm tra trùng rồi tạo mới
    const existing = await PhieuLe.findOne({
      so_document: parsedData.so_document,
    });

    if (existing) {
      await fs.unlink(filePath).catch(console.error);
      return res.status(409).json({
        message: `Số document ${parsedData.so_document} đã tồn tại`,
        so_document: parsedData.so_document,
        existing_id: existing._id,
      });
    }

    const dataCHInfo = await mapDataCHInfo(parsedData.so_document);

    // ✅ Điền packs_to_pick_1 và tính tong_kien ngay khi import
    const chiTietCopy = parsedData.chi_tiet.map((item) => ({ ...item }));
    const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

    const newPhieuLe = new PhieuLe({
      so_document: parsedData.so_document,
      loai_phieu: parsedData.loai_phieu || "TF",
      chi_tiet: chiTietCopy,
      trang_thai: parsedData.trang_thai || "Chờ xử lý",
      ngay_import: new Date(),
      tong_kien,
      ...dataCHInfo,
    });

    await newPhieuLe.save();
    await fs.unlink(filePath).catch(console.error);

    res.status(201).json({
      message: "✅ Import file txt thành công",
      filename: req.file.originalname,
      so_document: parsedData.so_document,
      total_items: chiTietCopy.length,
      tong_kien,
      dataCH: dataCHInfo,
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error("❌ Lỗi importTxtPhieuLe:", error);

    if (error.code === 11000) {
      const duplicateDoc = error.keyValue?.so_document;
      return res.status(409).json({
        message: `Số document ${duplicateDoc} đã tồn tại trong database`,
        so_document: duplicateDoc,
      });
    }

    res
      .status(500)
      .json({ message: "Lỗi khi import file txt", error: error.message });
  }
};

// ===== IMPORT TXT MULTIPLE - Import nhiều file txt =====
exports.importTxtPhieuLeMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const results = {
      success: 0,
      failed: 0,
      inserted: 0,
      updated: 0,
      total_items: 0,
      errors: [],
      duplicates: [],
    };

    // Parse tất cả files
    const parsedDataList = [];
    for (const file of req.files) {
      try {
        const fileBuffer = await fs.readFile(file.path);

        let fileContent;
        if (
          fileBuffer[0] === 0xef &&
          fileBuffer[1] === 0xbb &&
          fileBuffer[2] === 0xbf
        ) {
          fileContent = fileBuffer.slice(3).toString("utf-8");
        } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
          fileContent = fileBuffer.slice(2).toString("utf16le");
        } else if (fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
          fileContent = fileBuffer.slice(2).toString("utf16le");
        } else {
          fileContent = fileBuffer.toString("utf-8");
        }

        fileContent = fileContent.replace(/^[\x00-\x1F\uFEFF\uFFFE]+/, "");
        const parsedData = parseTxtContent(fileContent);

        if (parsedData && parsedData.so_document) {
          parsedDataList.push({ file, parsedData });
        } else {
          results.failed++;
          results.errors.push(`${file.originalname}: Format không hợp lệ`);
          await fs.unlink(file.path).catch(console.error);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${file.originalname}: ${err.message}`);
        await fs.unlink(file.path).catch(console.error);
      }
    }

    // Lấy DataCH
    const soDocuments = parsedDataList.map(
      (item) => item.parsedData.so_document,
    );
    const dataCHs = await DataCH.find({ so_document: { $in: soDocuments } });

    const dataCHMap = new Map();
    dataCHs.forEach((ch) => {
      dataCHMap.set(ch.so_document, {
        sd_tf: ch.sd_tf,
        mach: ch.mach,
        tench: ch.tench,
        quan: ch.quan,
        chuyen: ch.chuyen,
        ghi_chu_ch: ch.ghi_chu_ch || "",
      });
    });

    // Kiểm tra trùng CHỈ với files có chi_tiet
    const filesWithChiTiet = parsedDataList.filter(
      (item) =>
        Array.isArray(item.parsedData.chi_tiet) &&
        item.parsedData.chi_tiet.length > 0,
    );

    const docsWithChiTiet = filesWithChiTiet.map(
      (item) => item.parsedData.so_document,
    );
    const existingDocs = await PhieuLe.find(
      { so_document: { $in: docsWithChiTiet } },
      { so_document: 1 },
    ).lean();

    const existingSet = new Set(existingDocs.map((d) => d.so_document));

    // Xử lý từng file
    for (const { file, parsedData } of parsedDataList) {
      try {
        const dataCHInfo = dataCHMap.get(parsedData.so_document) || {
          sd_tf: null,
          mach: "",
          tench: "",
          quan: "",
          chuyen: "",
          ghi_chu_ch: "",
        };

        const hasChiTiet =
          Array.isArray(parsedData.chi_tiet) && parsedData.chi_tiet.length > 0;

        // Trường hợp 1: Chỉ có sd_tf → Update
        if (!hasChiTiet) {
          const bulkOp = {
            updateOne: {
              filter: { so_document: parsedData.so_document },
              update: {
                $set: {
                  trang_thai: parsedData.trang_thai || "Chờ xử lý",
                  loai_phieu: parsedData.loai_phieu || "TF", // ✅ thêm dòng này

                  ngay_cap_nhat: new Date(),
                  ...dataCHInfo,
                },
                $setOnInsert: { ngay_import: new Date() },
              },
              upsert: true,
            },
          };

          const result = await PhieuLe.bulkWrite([bulkOp]);

          results.success++;
          if (result.upsertedCount > 0) {
            results.inserted++;
          } else {
            results.updated++;
          }

          await fs.unlink(file.path).catch(console.error);
          continue;
        }

        // Trường hợp 2: Có chi_tiet → kiểm tra trùng
        if (existingSet.has(parsedData.so_document)) {
          results.failed++;
          results.duplicates.push({
            fileName: file.originalname,
            soDocument: parsedData.so_document,
            message: `Số document ${parsedData.so_document} đã tồn tại`,
          });
          await fs.unlink(file.path).catch(console.error);
          continue;
        }

        // ✅ Điền packs_to_pick_1 và tính tong_kien ngay khi import
        const chiTietCopy = parsedData.chi_tiet.map((item) => ({ ...item }));
        const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

        const newPhieuLe = new PhieuLe({
          so_document: parsedData.so_document,
          loai_phieu: parsedData.loai_phieu || "TF", // ✅ thêm dòng này
          chi_tiet: chiTietCopy,
          trang_thai: parsedData.trang_thai || "Chờ xử lý",
          ngay_import: new Date(),
          tong_kien,
          ...dataCHInfo,
        });

        await newPhieuLe.save();

        results.success++;
        results.inserted++;
        results.total_items += chiTietCopy.length;

        await fs.unlink(file.path).catch(console.error);
      } catch (err) {
        results.failed++;

        if (err.code === 11000) {
          results.duplicates.push({
            fileName: file.originalname,
            soDocument: parsedData.so_document,
            message: `Số document ${parsedData.so_document} đã tồn tại`,
          });
        } else {
          results.errors.push(`${file.originalname}: ${err.message}`);
        }

        console.error(`❌ Failed: ${file.originalname}`, err);
        await fs.unlink(file.path).catch(console.error);
      }
    }

    const statusCode = results.failed === 0 ? 201 : 207;

    res.status(statusCode).json({
      message: `✅ Import hoàn tất. Thành công: ${results.success}/${req.files.length}`,
      stats: {
        total_files: req.files.length,
        success: results.success,
        failed: results.failed,
        inserted: results.inserted,
        updated: results.updated,
        total_items: results.total_items,
      },
      duplicates: results.duplicates,
      errors: results.errors,
    });
  } catch (error) {
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(console.error);
      }
    }
    console.error("❌ Lỗi importTxtPhieuLeMultiple:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi import nhiều file txt", error: error.message });
  }
};

// ===== UPDATE - Cập nhật phiếu lẻ =====
exports.updatePhieuLe = async (req, res) => {
  try {
    const {
      chi_tiet,
      trang_thai,
      sd_tf,
      mach,
      tench,
      quan,
      chuyen,
      ghi_chu_ch,
      ghi_chu_phieu,
      so_lan_in_phieu,
      ngay_in_phieu,
      tong_khoi_luong,
    } = req.body;

    const updateData = { ngay_cap_nhat: new Date() };

    if (chi_tiet !== undefined) updateData.chi_tiet = chi_tiet;
    if (trang_thai !== undefined) updateData.trang_thai = trang_thai;
    if (sd_tf !== undefined) updateData.sd_tf = sd_tf;
    if (mach !== undefined) updateData.mach = mach;
    if (tench !== undefined) updateData.tench = tench;
    if (quan !== undefined) updateData.quan = quan;
    if (chuyen !== undefined) updateData.chuyen = chuyen;
    if (ghi_chu_ch !== undefined) updateData.ghi_chu_ch = ghi_chu_ch;
    if (ghi_chu_phieu !== undefined) updateData.ghi_chu_phieu = ghi_chu_phieu;
    if (so_lan_in_phieu !== undefined)
      updateData.so_lan_in_phieu = so_lan_in_phieu;
    if (ngay_in_phieu !== undefined) updateData.ngay_in_phieu = ngay_in_phieu;
    if (tong_khoi_luong !== undefined)
      updateData.tong_khoi_luong = tong_khoi_luong;

    const updated = await PhieuLe.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }

    res
      .status(200)
      .json({ message: "Cập nhật phiếu lẻ thành công", data: updated });
  } catch (error) {
    console.error("❌ Lỗi updatePhieuLe:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi cập nhật phiếu lẻ", error: error.message });
  }
};

// ===== UPDATE STATUS =====
exports.updatePhieuLeStatus = async (req, res) => {
  try {
    const { trang_thai } = req.body;

    if (!["Chờ xử lý", "Đã xử lý", "Đã Xuất"].includes(trang_thai)) {
      return res.status(400).json({
        message:
          "Trạng thái không hợp lệ. Chỉ chấp nhận: Chờ xử lý, Đã xử lý, Đã Xuất",
      });
    }

    const updated = await PhieuLe.findByIdAndUpdate(
      req.params.id,
      { trang_thai, ngay_cap_nhat: new Date() },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }

    res
      .status(200)
      .json({ message: "Cập nhật trạng thái thành công", data: updated });
  } catch (error) {
    console.error("❌ Lỗi updatePhieuLeStatus:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi cập nhật trạng thái", error: error.message });
  }
};

// ===== DELETE =====
exports.deletePhieuLe = async (req, res) => {
  try {
    const deleted = await PhieuLe.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }

    res.status(200).json({ message: "Xóa phiếu lẻ thành công" });
  } catch (error) {
    console.error("❌ Lỗi deletePhieuLe:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xóa phiếu lẻ", error: error.message });
  }
};

// ===== CLEAR ALL =====
exports.clearAllPhieuLe = async (req, res) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== "DELETE_ALL") {
      return res.status(400).json({
        message: '❌ Vui lòng nhập đúng "DELETE_ALL" để xác nhận',
        required: 'confirmation: "DELETE_ALL"',
      });
    }

    const result = await PhieuLe.deleteMany({});
    res
      .status(200)
      .json({ message: `🔥 Đã xóa ${result.deletedCount} phiếu lẻ` });
  } catch (error) {
    console.error("❌ Lỗi clearAllPhieuLe:", error);
    res
      .status(500)
      .json({ message: "❌ Xóa toàn bộ thất bại", error: error.message });
  }
};

// ===== STATISTICS =====
exports.getPhieuLeStatistics = async (req, res) => {
  try {
    const stats = await PhieuLe.aggregate([
      {
        $group: {
          _id: "$trang_thai",
          count: { $sum: 1 },
          total_items: { $sum: { $size: "$chi_tiet" } },
        },
      },
    ]);

    const total = await PhieuLe.countDocuments();

    const statsByChuyen = await PhieuLe.aggregate([
      {
        $group: {
          _id: "$chuyen",
          count: { $sum: 1 },
          total_items: { $sum: { $size: "$chi_tiet" } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({ total, by_status: stats, by_chuyen: statsByChuyen });
  } catch (error) {
    console.error("❌ Lỗi getPhieuLeStatistics:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi lấy thống kê", error: error.message });
  }
};

// ===== PARSE TXT CONTENT =====
function parseTxtContent(content) {
  try {
    const lines = content.split("\n");

    let so_document = null;
    let sd_tf = null;
    const chi_tiet = [];
    let loai_phieu = "TF"; // ✅ mặc định TF

    for (const line of lines) {
      const docMatch = line.match(/Document\s+No\.?:?\s*(\d+)/i);
      if (docMatch) {
        so_document = parseInt(docMatch[1]);
        break;
      }
    }

    // ✅ Tìm SODA ORDER trong toàn bộ file
    for (const line of lines) {
      const sodaMatch = line.match(/SODA\s+ORDER\s*:\s*(\d+)/i);
      if (sodaMatch) {
        sd_tf = parseInt(sodaMatch[1]);
        loai_phieu = "SD";
        break;
      }
    }
    if (!so_document) {
      console.error("❌ Không tìm thấy Document No. trong file");
      return null;
    }

    let startParsing = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("_____")) {
        startParsing = true;
        continue;
      }

      if (line.includes("END OF REPORT")) break;

      if (
        !startParsing ||
        line.includes("Picking Document") ||
        line.includes("Warehouse") ||
        line.includes("From") ||
        line.includes("Seq") ||
        line.includes("Clerk:") ||
        line.includes("WHS013") ||
        line.includes("JDA Software") ||
        line.trim() === ""
      ) {
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed || !/^\d+\s/.test(trimmed)) continue;

      try {
        const parts = trimmed.split(/\s+/);
        if (parts.length < 10) continue;

        const seq = parseInt(parts[0]);
        const slot = parts[1];
        const sku = parseInt(parts[2]);
        const vendor = parseInt(parts[3]);

        let partNumberIndex = 4;
        let hasPartNumber = false;

        if (parts[4] && /^\d{10,}$/.test(parts[4])) {
          hasPartNumber = true;
          partNumberIndex = 5;
        }

        let quantityIndex = -1;
        for (let j = partNumberIndex; j < parts.length - 7; j++) {
          if (/^\d+\.\d{2}$/.test(parts[j])) {
            const val = parseFloat(parts[j]);
            if (!isNaN(val) && val > 0) {
              quantityIndex = j;
              break;
            }
          }
        }

        if (quantityIndex === -1) continue;

        const descStartIndex = hasPartNumber ? 5 : 4;
        const descParts = parts.slice(descStartIndex, quantityIndex);
        const description = descParts.join(" ").trim();

        const quantity = parseFloat(parts[quantityIndex]);
        const packUnit = parseInt(parts[quantityIndex + 1]);
        const pckUM = parts[quantityIndex + 2];
        const packsToPick = parseFloat(parts[quantityIndex + 3]);
        const store = parseInt(parts[quantityIndex + 7]);

        if (
          isNaN(seq) ||
          isNaN(sku) ||
          isNaN(vendor) ||
          isNaN(quantity) ||
          isNaN(packUnit) ||
          isNaN(packsToPick) ||
          isNaN(store)
        ) {
          continue;
        }

        if (!description || description.length === 0) continue;

        chi_tiet.push({
          seq,
          slot,
          sku,
          vendor,
          part_number: hasPartNumber ? parts[4] : null,
          name: description,
          quantity,
          khoi_luong: null,
          pack_unit: packUnit,
          pck_um: pckUM,
          packs_to_pick: packsToPick,
          store,
          // ✅ packs_to_pick_1 và pack_unit_1 sẽ được Backend điền sau khi parse
        });
      } catch (err) {
        console.error(`⚠️ Lỗi parse dòng ${i}:`, err.message);
        continue;
      }
    }

    return {
      so_document,
      sd_tf,
      loai_phieu,
      chi_tiet,
      trang_thai: "Chờ xử lý",
    };
  } catch (error) {
    console.error("❌ Parse txt error:", error);
    return null;
  }
}

// ===== UPDATE MANY =====
exports.updateManyPhieuLe = async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách IDs phải là mảng và không được rỗng" });
    }

    if (!updateData || typeof updateData !== "object") {
      return res.status(400).json({ message: "Dữ liệu cập nhật không hợp lệ" });
    }

    const allowedFields = [
      "trang_thai",
      "sd_tf",
      "mach",
      "tench",
      "quan",
      "chuyen",
      "so_lan_in_phieu",
      "ngay_in_phieu",
      "tong_khoi_luong",
      "ghi_chu_ch",
      "ghi_chu_phieu",
    ];

    const updateFields = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined)
        updateFields[field] = updateData[field];
    });

    if (updateFields.trang_thai) {
      if (
        !["Chờ xử lý", "Đã xử lý", "Đã Xuất"].includes(updateFields.trang_thai)
      ) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ" });
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có trường nào được cập nhật" });
    }

    updateFields.ngay_cap_nhat = new Date();

    const result = await PhieuLe.updateMany(
      { _id: { $in: ids } },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Không tìm thấy phiếu lẻ nào với các ID đã cung cấp",
      });
    }

    res.status(200).json({
      message: `✅ Cập nhật thành công ${result.modifiedCount}/${ids.length} phiếu lẻ`,
      stats: {
        total_requested: ids.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        not_found: ids.length - result.matchedCount,
      },
      updated_fields: Object.keys(updateFields).filter(
        (f) => f !== "ngay_cap_nhat",
      ),
    });
  } catch (error) {
    console.error("❌ Lỗi updateManyPhieuLe:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật nhiều phiếu lẻ",
      error: error.message,
    });
  }
};

// ===== UPDATE MANY BY FILTER =====
exports.updateManyPhieuLeByFilter = async (req, res) => {
  try {
    const { filter, updateData } = req.body;

    if (!filter || typeof filter !== "object") {
      return res.status(400).json({ message: "Filter không hợp lệ" });
    }

    if (!updateData || typeof updateData !== "object") {
      return res.status(400).json({ message: "Dữ liệu cập nhật không hợp lệ" });
    }

    const allowedFields = [
      "trang_thai",
      "sd_tf",
      "mach",
      "tench",
      "quan",
      "chuyen",
      "so_lan_in_phieu",
      "ngay_in_phieu",
      "tong_khoi_luong",
      "ghi_chu_ch",
      "ghi_chu_phieu",
    ];

    const updateFields = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined)
        updateFields[field] = updateData[field];
    });

    if (updateFields.trang_thai) {
      if (
        !["Chờ xử lý", "Đã xử lý", "Đã Xuất"].includes(updateFields.trang_thai)
      ) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ" });
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có trường nào được cập nhật" });
    }

    updateFields.ngay_cap_nhat = new Date();

    const countBeforeUpdate = await PhieuLe.countDocuments(filter);

    if (countBeforeUpdate === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phiếu lẻ nào phù hợp với điều kiện" });
    }

    const result = await PhieuLe.updateMany(filter, { $set: updateFields });

    res.status(200).json({
      message: `✅ Cập nhật thành công ${result.modifiedCount} phiếu lẻ`,
      stats: { matched: result.matchedCount, modified: result.modifiedCount },
      filter_applied: filter,
      updated_fields: Object.keys(updateFields).filter(
        (f) => f !== "ngay_cap_nhat",
      ),
    });
  } catch (error) {
    console.error("❌ Lỗi updateManyPhieuLeByFilter:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật nhiều phiếu lẻ theo filter",
      error: error.message,
    });
  }
};

// ===== UPDATE CHI TIET =====
exports.updateChiTietPhieuLe = async (req, res) => {
  try {
    const { sku, field, value } = req.body;
    const { id } = req.params;

    if (!sku || !field) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin sku hoặc field" });
    }

    const allowedFields = [
      "seq",
      "slot",
      "sku",
      "vendor",
      "part_number",
      "name",
      "quantity",
      "pack_unit",
      "pck_um",
      "khoi_luong",
      "packs_to_pick",
      "store",
    ];

    if (!allowedFields.includes(field)) {
      return res
        .status(400)
        .json({ message: `Không thể cập nhật field '${field}'` });
    }

    const result = await PhieuLe.updateOne(
      { _id: id, "chi_tiet.sku": sku },
      {
        $set: {
          [`chi_tiet.$.${field}`]: value,
          ngay_cap_nhat: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phiếu lẻ hoặc sku cần cập nhật" });
    }

    res.status(200).json({ message: "Cập nhật chi tiết phiếu lẻ thành công" });
  } catch (error) {
    console.error("❌ Lỗi updateChiTietPhieuLe:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật chi tiết phiếu lẻ",
      error: error.message,
    });
  }
};

// ===== UPDATE TRANG THAI BY SD/TF =====
exports.updateTrangThaiBySDTF = async (req, res) => {
  try {
    const { sd_tf_list, trang_thai } = req.body;

    if (!sd_tf_list || !Array.isArray(sd_tf_list) || sd_tf_list.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách SD/TF không hợp lệ hoặc rỗng!",
      });
    }

    if (!trang_thai) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp trạng thái cần cập nhật!",
      });
    }

    const validStatuses = ["Chờ xử lý", "Đã xử lý", "Đã Xuất"];
    if (!validStatuses.includes(trang_thai)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ! Phải là một trong: ${validStatuses.join(", ")}`,
      });
    }

    const result = await PhieuLe.updateMany(
      { sd_tf: { $in: sd_tf_list } },
      { $set: { trang_thai, ngay_cap_nhat: new Date() } },
    );

    const updatedPhieus = await PhieuLe.find(
      { sd_tf: { $in: sd_tf_list } },
      { so_document: 1, sd_tf: 1, trang_thai: 1 },
    );

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái thành công cho ${result.modifiedCount} phiếu!`,
      matched: result.matchedCount,
      updated: result.modifiedCount,
      data: {
        total_sd_tf: sd_tf_list.length,
        matched_count: result.matchedCount,
        modified_count: result.modifiedCount,
        trang_thai_moi: trang_thai,
        updated_phieus: updatedPhieus,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật trạng thái theo SD/TF:", error);
    res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi cập nhật trạng thái!",
      error: error.message,
    });
  }
};

// ===== UPDATE PACK UNIT 1 FOR PHIEU (endpoint thủ công nếu cần recalc) =====
exports.updatePackUnit1ForPhieu = async (req, res) => {
  try {
    const { id } = req.params;

    const phieuLe = await PhieuLe.findById(id);
    if (!phieuLe) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }

    const itemsNeedUpdate = phieuLe.chi_tiet.filter(
      (item) => item.pack_unit === 1,
    );

    if (itemsNeedUpdate.length === 0) {
      return res.status(200).json({
        message: "Không có item nào cần cập nhật (không có pack_unit = 1)",
        updated: 0,
      });
    }

    const skuList = itemsNeedUpdate.map((item) => item.sku);

    const dinhViList = await DinhVi.find(
      { sku: { $in: skuList } },
      { sku: 1, pack: 1 },
    ).lean();

    const packMap = {};
    dinhViList.forEach((dv) => {
      packMap[dv.sku] = dv.pack;
    });

    let updatedCount = 0;
    const bulkOps = [];

    phieuLe.chi_tiet.forEach((item) => {
      if (item.pack_unit === 1) {
        const pack = packMap[item.sku];
        if (pack && pack > 0) {
          const pack_unit_1 = pack;
          const packs_to_pick_1 = parseFloat(
            (item.quantity / pack_unit_1).toFixed(2),
          );

          bulkOps.push({
            updateOne: {
              filter: { _id: phieuLe._id, "chi_tiet.sku": item.sku },
              update: {
                $set: {
                  "chi_tiet.$.pack_unit_1": pack_unit_1,
                  "chi_tiet.$.packs_to_pick_1": packs_to_pick_1,
                  ngay_cap_nhat: new Date(),
                },
              },
            },
          });

          updatedCount++;
        }
      }
    });

    if (bulkOps.length > 0) {
      await PhieuLe.bulkWrite(bulkOps);
    }

    // Recalculate tong_kien
    const updatedPhieu = await PhieuLe.findById(id);
    const tong_kien = await calculateTongKien(updatedPhieu.chi_tiet);
    await PhieuLe.findByIdAndUpdate(id, {
      tong_kien,
      ngay_cap_nhat: new Date(),
    });

    const finalPhieu = await PhieuLe.findById(id);

    res.status(200).json({
      message: `✅ Đã cập nhật pack_unit_1 cho ${updatedCount} items`,
      updated: updatedCount,
      total_items: itemsNeedUpdate.length,
      tong_kien,
      data: finalPhieu,
    });
  } catch (error) {
    console.error("❌ Lỗi updatePackUnit1ForPhieu:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi cập nhật pack_unit_1", error: error.message });
  }
};

// ===== GET PACK_UNIT_1 INFO (không lưu vào DB) =====
exports.getPackUnit1Info = async (req, res) => {
  try {
    const { id } = req.params;

    const phieuLe = await PhieuLe.findById(id).lean();
    if (!phieuLe) {
      return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
    }

    const itemsNeedPack = phieuLe.chi_tiet.filter(
      (item) => item.pack_unit === 1,
    );

    if (itemsNeedPack.length === 0) {
      return res
        .status(200)
        .json({ message: "Không có item nào có pack_unit = 1", data: {} });
    }

    const skuList = itemsNeedPack.map((item) => item.sku);

    const dinhViList = await DinhVi.find(
      { sku: { $in: skuList } },
      { sku: 1, pack: 1 },
    ).lean();

    const packInfo = {};
    dinhViList.forEach((dv) => {
      const item = phieuLe.chi_tiet.find((i) => i.sku === dv.sku);
      if (item && dv.pack) {
        packInfo[dv.sku] = {
          pack_unit_1: dv.pack,
          packs_to_pick_1: Math.ceil(item.quantity / dv.pack),
          quantity: item.quantity,
        };
      }
    });

    res.status(200).json({
      message: "✅ Lấy thông tin pack_unit_1 thành công",
      data: packInfo,
    });
  } catch (error) {
    console.error("❌ Lỗi getPackUnit1Info:", error);
    res.status(500).json({
      message: "Lỗi khi lấy thông tin pack_unit_1",
      error: error.message,
    });
  }
};

// ===== UPDATE MULTIPLE CHI TIET =====
exports.updateMultipleChiTiet = async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Updates array is required and must not be empty",
      });
    }

    for (const update of updates) {
      if (!update.sku || update.packs_to_pick_1 === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each update must have: sku, packs_to_pick_1",
        });
      }

      if (
        typeof update.packs_to_pick_1 !== "number" ||
        update.packs_to_pick_1 < 0
      ) {
        return res.status(400).json({
          success: false,
          message: `packs_to_pick_1 for SKU ${update.sku} must be a positive number`,
        });
      }
    }

    const result = await updateMultipleChiTietHelper(id, updates);
    res.json(result);
  } catch (error) {
    console.error("❌ Error in updateMultipleChiTiet controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.migrateLoaiPhieu = async (req, res) => {
  try {
    const result = await PhieuLe.updateMany(
      { loai_phieu: { $exists: false } },
      { $set: { loai_phieu: "TF" } },
    );

    res.status(200).json({
      message: `✅ Đã migrate ${result.modifiedCount} phiếu`,
      modified: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi migrate", error: error.message });
  }
};

// ===== PARSE WPK TXT CONTENT (Soda format) =====
function parseWpkTxtContent(content) {
  try {
    const lines = content.split("\n");

    let so_document = null;
    let sd_tf = null;
    let mach_from_file = null;
    const chi_tiet = [];

    // Tìm Document No
    for (const line of lines) {
      const docMatch = line.match(/Document\s+No\.?:?\s*(\d+)/i);
      if (docMatch) {
        so_document = parseInt(docMatch[1]);
        break;
      }
    }

    // Tìm SODA ORDER + STORE (lấy dòng đầu tiên)
    for (const line of lines) {
      const sodaMatch = line.match(/SODA\s+ORDER\s*:\s*(\d+)/i);
      if (sodaMatch) {
        sd_tf = parseInt(sodaMatch[1]);
        const storeMatch = line.match(/STORE:\s*(\S+)/i);
        if (storeMatch) {
          mach_from_file = storeMatch[1]; // "CH00296"
        }
        break;
      }
    }

    if (!so_document) {
      console.error("❌ Không tìm thấy Document No. trong file WPK");
      return null;
    }

    let startParsing = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // WPK dùng ===== để bắt đầu data
      if (line.includes("=====")) {
        startParsing = true;
        continue;
      }

      if (line.includes("END OF REPORT")) break;

      // Skip các dòng header và SODA ORDER
      if (
        !startParsing ||
        line.includes("WPK137") ||
        line.includes("Customer Order Picking") ||
        line.includes("Warehouse") ||
        line.includes("Packing Slot") ||
        line.includes("Move") ||
        line.includes("SODA ORDER") ||
        line.includes("Seq") ||
        line.includes("Clerk:") ||
        line.includes("JDA Software") ||
        line.trim() === ""
      ) {
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed || !/^\d+\s/.test(trimmed)) continue;

      try {
        const parts = trimmed.split(/\s+/);
        if (parts.length < 12) continue;

        // WPK format: move_seq internal_order order_seq slot sku vendor desc... qty pack_unit pck_um packs_to_pick each_unit each_um eaches_to_pick store
        // parts[0] = move_seq (1,2,3...)
        // parts[1] = internal_order (588907)
        // parts[2] = order_seq (110, 20, 90...)
        // parts[3] = slot (A01203)
        // parts[4] = sku (3565459)
        // parts[5] = vendor (21898)
        // parts[6..N] = description
        // parts[N+1] = quantity (5.00)
        // parts[N+2] = pack_unit (1)
        // parts[N+3] = pck_um (EA)
        // parts[N+4] = packs_to_pick (5.00)
        // parts[N+5] = each_unit (1)
        // parts[N+6] = each_um (EA)
        // parts[N+7] = eaches_to_pick (.00)
        // parts[N+8] = store (810)

        const move_seq = parseInt(parts[0]);
        const internal_order = parseInt(parts[1]);
        const order_seq = parseInt(parts[2]);
        const slot = parts[3];
        const sku = parseInt(parts[4]);
        const vendor = parseInt(parts[5]);

        if (isNaN(move_seq) || isNaN(sku) || isNaN(vendor)) continue;

        // Tìm quantity index (số có dạng X.XX)
        let quantityIndex = -1;
        for (let j = 6; j < parts.length - 7; j++) {
          if (/^\d+\.\d{2}$/.test(parts[j])) {
            const val = parseFloat(parts[j]);
            if (!isNaN(val) && val >= 0) {
              quantityIndex = j;
              break;
            }
          }
        }

        if (quantityIndex === -1) continue;

        const descParts = parts.slice(6, quantityIndex);
        const description = descParts.join(" ").trim();
        if (!description) continue;

        const quantity = parseFloat(parts[quantityIndex]);
        const pack_unit = parseInt(parts[quantityIndex + 1]);
        const pck_um = parts[quantityIndex + 2];
        const packs_to_pick = parseFloat(parts[quantityIndex + 3]);
        const store = parseInt(parts[quantityIndex + 7]);

        if (
          isNaN(quantity) ||
          isNaN(pack_unit) ||
          isNaN(packs_to_pick) ||
          isNaN(store)
        ) {
          continue;
        }

        chi_tiet.push({
          seq: move_seq,
          slot,
          sku,
          vendor,
          part_number: null,
          name: description,
          quantity,
          khoi_luong: null,
          pack_unit,
          pck_um,
          packs_to_pick,
          store,
          internal_order,
          order_seq,
        });
      } catch (err) {
        console.error(`⚠️ Lỗi parse dòng WPK ${i}:`, err.message);
        continue;
      }
    }

    return {
      so_document,
      sd_tf,
      loai_phieu: "SD",
      mach_from_file,
      chi_tiet,
      trang_thai: "Chờ xử lý",
    };
  } catch (error) {
    console.error("❌ Parse WPK txt error:", error);
    return null;
  }
}

// ===== IMPORT SODA TXT - Import 1 file WPK137 =====
exports.importSodaTxtPhieuLe = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const filePath = req.file.path;
    const fileBuffer = await fs.readFile(filePath);

    let fileContent;
    if (
      fileBuffer[0] === 0xef &&
      fileBuffer[1] === 0xbb &&
      fileBuffer[2] === 0xbf
    ) {
      fileContent = fileBuffer.slice(3).toString("utf-8");
    } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
      fileContent = fileBuffer.slice(2).toString("utf16le");
    } else if (fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
      fileContent = fileBuffer.slice(2).toString("utf16le");
    } else {
      fileContent = fileBuffer.toString("utf-8");
    }

    fileContent = fileContent.replace(/^[\x00-\x1F\uFEFF\uFFFE]+/, "");

    const parsedData = parseWpkTxtContent(fileContent);

    if (!parsedData || !parsedData.so_document) {
      await fs.unlink(filePath).catch(console.error);
      return res.status(400).json({
        message: "Format file WPK không hợp lệ hoặc không có số document",
      });
    }

    if (!parsedData.mach_from_file) {
      await fs.unlink(filePath).catch(console.error);
      return res.status(400).json({
        message: "Không tìm thấy mã cửa hàng (STORE) trong file WPK",
      });
    }

    // Kiểm tra trùng
    const existing = await PhieuLe.findOne({
      so_document: parsedData.so_document,
    });
    if (existing) {
      await fs.unlink(filePath).catch(console.error);
      return res.status(409).json({
        message: `Số document ${parsedData.so_document} đã tồn tại`,
        so_document: parsedData.so_document,
        existing_id: existing._id,
      });
    }

    // ✅ Map DataCH theo mach thay vì so_document
    const dataCHInfo = await mapDataCHInfoByMach(
      parsedData.mach_from_file,
      parsedData.sd_tf,
    );

    const chiTietCopy = parsedData.chi_tiet.map((item) => ({ ...item }));
    const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

    const newPhieuLe = new PhieuLe({
      so_document: parsedData.so_document,
      loai_phieu: "SD",
      chi_tiet: chiTietCopy,
      trang_thai: "Chờ xử lý",
      ngay_import: new Date(),
      tong_kien,
      ...dataCHInfo,
    });

    await newPhieuLe.save();
    await fs.unlink(filePath).catch(console.error);

    res.status(201).json({
      message: "✅ Import file Soda (WPK137) thành công",
      filename: req.file.originalname,
      so_document: parsedData.so_document,
      sd_tf: parsedData.sd_tf,
      mach: dataCHInfo.mach,
      tench: dataCHInfo.tench,
      total_items: chiTietCopy.length,
      tong_kien,
    });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(console.error);
    console.error("❌ Lỗi importSodaTxtPhieuLe:", error);

    if (error.code === 11000) {
      const duplicateDoc = error.keyValue?.so_document;
      return res.status(409).json({
        message: `Số document ${duplicateDoc} đã tồn tại`,
        so_document: duplicateDoc,
      });
    }

    res
      .status(500)
      .json({ message: "Lỗi khi import file Soda", error: error.message });
  }
};

// ===== IMPORT SODA TXT MULTIPLE =====
exports.importSodaTxtPhieuLeMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const results = {
      success: 0,
      failed: 0,
      inserted: 0,
      total_items: 0,
      errors: [],
      duplicates: [],
    };

    const parsedDataList = [];

    for (const file of req.files) {
      try {
        const fileBuffer = await fs.readFile(file.path);
        let fileContent;
        if (
          fileBuffer[0] === 0xef &&
          fileBuffer[1] === 0xbb &&
          fileBuffer[2] === 0xbf
        ) {
          fileContent = fileBuffer.slice(3).toString("utf-8");
        } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
          fileContent = fileBuffer.slice(2).toString("utf16le");
        } else {
          fileContent = fileBuffer.toString("utf-8");
        }
        fileContent = fileContent.replace(/^[\x00-\x1F\uFEFF\uFFFE]+/, "");

        const parsedData = parseWpkTxtContent(fileContent);
        if (parsedData && parsedData.so_document && parsedData.mach_from_file) {
          parsedDataList.push({ file, parsedData });
        } else {
          results.failed++;
          results.errors.push(
            `${file.originalname}: Format WPK không hợp lệ hoặc thiếu STORE`,
          );
          await fs.unlink(file.path).catch(console.error);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${file.originalname}: ${err.message}`);
        await fs.unlink(file.path).catch(console.error);
      }
    }

    // Kiểm tra trùng
    const soDocuments = parsedDataList.map(
      (item) => item.parsedData.so_document,
    );
    const existingDocs = await PhieuLe.find(
      { so_document: { $in: soDocuments } },
      { so_document: 1 },
    ).lean();
    const existingSet = new Set(existingDocs.map((d) => d.so_document));

    for (const { file, parsedData } of parsedDataList) {
      try {
        if (existingSet.has(parsedData.so_document)) {
          results.failed++;
          results.duplicates.push({
            fileName: file.originalname,
            soDocument: parsedData.so_document,
            message: `Số document ${parsedData.so_document} đã tồn tại`,
          });
          await fs.unlink(file.path).catch(console.error);
          continue;
        }

        // ✅ Map DataCH theo mach
        const dataCHInfo = await mapDataCHInfoByMach(
          parsedData.mach_from_file,
          parsedData.sd_tf,
        );

        const chiTietCopy = parsedData.chi_tiet.map((item) => ({ ...item }));
        const tong_kien = await populatePacksToPick1AndTongKien(chiTietCopy);

        const newPhieuLe = new PhieuLe({
          so_document: parsedData.so_document,
          loai_phieu: "SD",
          chi_tiet: chiTietCopy,
          trang_thai: "Chờ xử lý",
          ngay_import: new Date(),
          tong_kien,
          ...dataCHInfo,
        });

        await newPhieuLe.save();
        results.success++;
        results.inserted++;
        results.total_items += chiTietCopy.length;
        await fs.unlink(file.path).catch(console.error);
      } catch (err) {
        results.failed++;
        if (err.code === 11000) {
          results.duplicates.push({
            fileName: file.originalname,
            soDocument: parsedData.so_document,
            message: `Số document ${parsedData.so_document} đã tồn tại`,
          });
        } else {
          results.errors.push(`${file.originalname}: ${err.message}`);
        }
        await fs.unlink(file.path).catch(console.error);
      }
    }

    res.status(results.failed === 0 ? 201 : 207).json({
      message: `✅ Import Soda hoàn tất. Thành công: ${results.success}/${req.files.length}`,
      stats: {
        total_files: req.files.length,
        success: results.success,
        failed: results.failed,
        inserted: results.inserted,
        total_items: results.total_items,
      },
      duplicates: results.duplicates,
      errors: results.errors,
    });
  } catch (error) {
    if (req.files) {
      for (const file of req.files)
        await fs.unlink(file.path).catch(console.error);
    }
    console.error("❌ Lỗi importSodaTxtPhieuLeMultiple:", error);
    res.status(500).json({
      message: "Lỗi khi import nhiều file Soda",
      error: error.message,
    });
  }
};

exports.import8101PhieuLe = async (req, res) => {
  try {
    const {
      chi_tiet,
      sd_tf,
      mach,
      trang_thai,
      ghi_chu_ch, // vẫn giữ để override nếu cần
    } = req.body;

    if (!Array.isArray(chi_tiet) || chi_tiet.length === 0) {
      return res.status(400).json({ message: "chi_tiet không được rỗng" });
    }

    // Chỉ check trùng sd_tf
    if (sd_tf) {
      const existingSdTf = await PhieuLe.findOne({ sd_tf, loai_phieu: "8101" });
      if (existingSdTf) {
        return res.status(409).json({
          message: `SD/TF ${sd_tf} đã tồn tại trong phiếu 8101`,
          sd_tf,
          existing_id: existingSdTf._id,
        });
      }
    }

    // ✅ Map DataCH theo mach để lấy tench, quan, chuyen
    const dataCHInfo = mach
      ? await mapDataCHInfoByMach(mach, sd_tf)
      : { sd_tf, mach: "", tench: "", quan: "", chuyen: "", ghi_chu_ch: "" };

    const newPhieuLe = new PhieuLe({
      loai_phieu: "8101",
      chi_tiet,
      trang_thai: trang_thai || "Chờ xử lý",
      ngay_import: new Date(),
      ...dataCHInfo,
      // Override ghi_chu_ch nếu body truyền vào
      ...(ghi_chu_ch !== undefined && { ghi_chu_ch }),
    });

    await newPhieuLe.save();

    res.status(201).json({
      message: "✅ Import 8101 thành công",
      sd_tf: dataCHInfo.sd_tf,
      mach: dataCHInfo.mach,
      tench: dataCHInfo.tench,
      quan: dataCHInfo.quan,
      chuyen: dataCHInfo.chuyen,
      total_items: chi_tiet.length,
    });
  } catch (error) {
    console.error("❌ Lỗi import8101PhieuLe:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi import 8101", error: error.message });
  }
};  
