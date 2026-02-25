  const PhieuLe = require("../../models/phieusoan/phieule");
  const DataCH = require("../../models/phieusoan/dataCH");
  const DinhVi = require("../../models/phieusoan/dinhvi");

  const fs = require("fs").promises;
  const path = require("path");

  // ===== ✅ THÊM 3 HELPER FUNCTIONS MỚI =====

  /**
   * Lấy pack từ DinhVi theo nhiều SKU
   */
  // ✅ HELPER: Populate khối lượng từ DinhVi vào chi_tiet
  async function populateKhoiLuongForPhieuLe(phieuLe) {
    if (!phieuLe.chi_tiet || phieuLe.chi_tiet.length === 0) return;

    // Lấy danh sách SKU cần tra cứu (chỉ lấy những item chưa có khối lượng)
    const skusNeedKhoiLuong = phieuLe.chi_tiet
      .filter((item) => !item.khoi_luong || item.khoi_luong === 0)
      .map((item) => item.sku);

    if (skusNeedKhoiLuong.length === 0) return; // Đã có đủ khối lượng

    try {
      // Lấy khối lượng từ DinhVi
      const dinhViList = await DinhVi.find(
        { sku: { $in: skusNeedKhoiLuong } },
        { sku: 1, khoiluong: 1 },
      ).lean();

      // Tạo map { sku: khoiluong }
      const khoiLuongMap = {};
      dinhViList.forEach((dv) => {
        if (dv.khoiluong && dv.khoiluong > 0) {
          khoiLuongMap[dv.sku] = dv.khoiluong;
        }
      });

      // Gán khối lượng vào chi_tiet
      phieuLe.chi_tiet.forEach((item) => {
        if (!item.khoi_luong || item.khoi_luong === 0) {
          item.khoi_luong = khoiLuongMap[item.sku] || 0;
        }
      });
    } catch (error) {
      console.error("❌ Lỗi khi populate khối lượng:", error);
    }
  }

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

  // ===== CALCULATE TONG KIEN - TÍNH TỔNG TRƯỚC, LÀM TRÒN SAU =====
  async function calculateTongKien(chiTiet) {
    let tongKien = 0; // ✅ Giữ số thập phân, chưa làm tròn

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

      // ✅ ƯU TIÊN: packs_to_pick_1 nếu có giá trị > 0
      if (item.packs_to_pick_1 && item.packs_to_pick_1 > 0) {
        tongKien += item.packs_to_pick_1; // ✅ CỘNG TRỰC TIẾP, KHÔNG LÀM TRÒN
        console.log(`  ✅ Dùng packs_to_pick_1: ${item.packs_to_pick_1}`);
        console.log(`  📊 Tổng: ${before.toFixed(2)} → ${tongKien.toFixed(2)}`);
        continue; // ✅ SKIP hết logic phía dưới
      }

      // ✅ FALLBACK: Không có packs_to_pick_1 hoặc = 0
      if (item.pack_unit === 1) {
        // Thử tính từ pack (DinhVi)
        const packUnit1 = packUnit1Map[item.sku];

        if (packUnit1 && packUnit1 > 0) {
          const rawValue = item.quantity / packUnit1;
          tongKien += rawValue; // ✅ CỘNG TRỰC TIẾP, KHÔNG LÀM TRÒN
          console.log(
            `  ✅ Tính từ pack: ${item.quantity}/${packUnit1} = ${rawValue.toFixed(2)}`,
          );
        } else if (item.packs_to_pick && item.packs_to_pick > 0) {
          tongKien += item.packs_to_pick; // ✅ CỘNG TRỰC TIẾP
          console.log(`  ✅ Dùng packs_to_pick: ${item.packs_to_pick}`);
        } else {
          console.log(`  ⚠️ KHÔNG CÓ GIÁ TRỊ ĐỂ TÍNH!`);
        }
      } else {
        // pack_unit khác 1
        if (item.packs_to_pick && item.packs_to_pick > 0) {
          tongKien += item.packs_to_pick; // ✅ CỘNG TRỰC TIẾP
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

    // ✅ LÀM TRÒN LÊN Ở CUỐI CÙNG
    const finalTongKien = Math.ceil(tongKien);

    console.log(`\n✅ === KẾT QUẢ ===`);
    console.log(`📊 Tổng thập phân: ${tongKien.toFixed(2)}`);
    console.log(`📊 Tổng làm tròn: ${finalTongKien} KIỆN\n`);

    return finalTongKien;
  }

  /**
   * Cập nhật packs_to_pick_1 cho nhiều chi tiết items
   */
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
          // ✅ CHỈ cập nhật packs_to_pick_1
          phieu.chi_tiet[itemIndex].packs_to_pick_1 = parseFloat(
            parseFloat(update.packs_to_pick_1).toFixed(2),
          );
          updatedCount++;
        } else {
          notFoundSkus.push(update.sku);
        }
      }

      // Tính lại tổng kiện
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

  // ===== EXPORTS.GETALLPHIEULE - Có LOG VÀ FILTER NGAY_IN_PHIEU =====
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
        chuyen,
        quan,
        search,
        startDate,
        endDate,
        printStartDate,
        printEndDate,
      } = req.query;

      const filter = {};

      // ✅ FILTER RIÊNG LẺ
      if (so_document) {
        filter.so_document = parseInt(so_document);
      }

      if (trang_thai) {
        filter.trang_thai = trang_thai;
      }

      if (mach) {
        filter.mach = { $regex: `^${mach}$`, $options: "i" };
      }

      if (chuyen) {
        filter.chuyen = { $regex: chuyen, $options: "i" };
      }

      if (quan) {
        const cleanQuan = quan.trim().replace(/\s+/g, "\\s+");
        filter.quan = { $regex: `^${cleanQuan}$`, $options: "i" };
      }

      if (sku) {
        filter["chi_tiet.sku"] = parseInt(sku);
      }

      if (slot) {
        filter["chi_tiet.slot"] = { $regex: String(slot), $options: "i" };
      }

      // ✅ Filter theo ngày import
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

        console.log("🔍 Import Date Filter:", {
          startDate,
          endDate,
          filter: filter.ngay_import,
        });
      }

      // ✅ Filter theo ngày in phiếu - HOÀN TOÀN ĐỘC LẬP
      if (printStartDate || printEndDate) {
        filter.ngay_in_phieu = {};

        // ✅ Chỉ lấy phiếu đã được in (có ngay_in_phieu)
        filter.ngay_in_phieu.$ne = null;

        if (printStartDate) {
          const start = new Date(printStartDate);
          start.setHours(0, 0, 0, 0);
          filter.ngay_in_phieu.$gte = start;
        }

        if (printEndDate) {
          const end = new Date(printEndDate);
          end.setHours(23, 59, 59, 999);
          filter.ngay_in_phieu.$lte = end;
        }

        console.log("🔍 Print Date Filter (độc lập):", {
          printStartDate,
          printEndDate,
          filter: filter.ngay_in_phieu,
        });
      }


      // ✅ 🔧 FIX: Filter theo ngày in phiếu
      if (printStartDate || printEndDate) {
        const printDateFilter = {};

        // ✅ QUAN TRỌNG: Chỉ lấy phiếu có ngay_in_phieu (đã được in)
        printDateFilter.$ne = null;

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

        console.log("🔍 Print Date Filter:", {
          printStartDate,
          printEndDate,
          filter: filter.ngay_in_phieu,
        });
      }

      // ✅ SEARCH TỔNG HỢP
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

          if (mach) {
            filter.$and.push({ mach: { $regex: `^${mach}$`, $options: "i" } });
          }
          if (chuyen) {
            filter.$and.push({ chuyen: { $regex: chuyen, $options: "i" } });
          }

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

      console.log(`✅ Found ${total} phieus`);
      if (printStartDate || printEndDate) {
        console.log(`📊 Filtered by print date: ${phieuLes.length} results`);
      }

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

  // ===== GET BY ID - Lấy phiếu lẻ theo ID =====
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

  // ===== GET BY SO_DOCUMENT - Lấy phiếu lẻ theo số document =====
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

      // Validate
      if (!so_document) {
        return res.status(400).json({ message: "Thiếu số document" });
      }

      if (!Array.isArray(chi_tiet) || chi_tiet.length === 0) {
        return res
          .status(400)
          .json({ message: "Chi tiết phiếu lẻ phải là mảng và không được rỗng" });
      }

      // Kiểm tra trùng số document
      const existing = await PhieuLe.findOne({ so_document });
      if (existing) {
        return res.status(409).json({
          message: `Số document ${so_document} đã tồn tại`,
          so_document: so_document,
        });
      }

      // ✅ MAP VỚI DataCH
      const dataCHInfo = await mapDataCHInfo(so_document);

      const newPhieuLe = new PhieuLe({
        so_document,
        chi_tiet,
        trang_thai: trang_thai || "Chờ xử lý",
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

      // Validate từng document
      const invalidDocs = data.filter(
        (doc) =>
          !doc.so_document ||
          !Array.isArray(doc.chi_tiet) ||
          doc.chi_tiet.length === 0,
      );

      if (invalidDocs.length > 0) {
        return res.status(400).json({
          message: `Có ${invalidDocs.length} document không hợp lệ (thiếu so_document hoặc chi_tiet rỗng)`,
          invalidDocs: invalidDocs.slice(0, 5),
        });
      }

      // ✅ KIỂM TRA TRÙNG SO_DOCUMENT
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

      // ✅ LẤY TẤT CẢ DataCH CẦN THIẾT MỘT LẦN
      const dataCHs = await DataCH.find({ so_document: { $in: soDocuments } });

      // Tạo map để tra cứu nhanh
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

      // ✅ TẠO DOCUMENTS MỚI
      const newDocs = data.map((doc) => {
        const dataCHInfo = dataCHMap.get(doc.so_document) || {
          sd_tf: null,
          mach: "",
          tench: "",
          quan: "",
          chuyen: "",
          ghi_chu_ch: "",
        };

        return {
          so_document: doc.so_document,
          chi_tiet: doc.chi_tiet,
          trang_thai: doc.trang_thai || "Chờ xử lý",
          ngay_import: doc.ngay_import || new Date(),
          ...dataCHInfo,
        };
      });

      // ✅ INSERT (KHÔNG DÙNG UPSERT)
      const result = await PhieuLe.insertMany(newDocs, { ordered: false });

      res.status(201).json({
        message: `✅ Import thành công ${result.length} phiếu lẻ`,
        inserted: result.length,
      });
    } catch (error) {
      console.error("❌ Lỗi importManyPhieuLe:", error);

      // ✅ XỬ LÝ LỖI DUPLICATE KEY (MongoDB E11000)
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

  // ===== IMPORT TXT - Import 1 file txt (THROW ERROR KHI TRÙNG) =====
  exports.importTxtPhieuLe = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có file được upload" });
      }

      const filePath = req.file.path;

      // ✅ ĐỌC FILE VÀ XỬ LÝ BOM ENCODING
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

      // Parse nội dung file txt thành data
      const parsedData = parseTxtContent(fileContent);

      if (!parsedData || !parsedData.so_document) {
        await fs.unlink(filePath).catch(console.error);
        return res.status(400).json({
          message: "Format file txt không hợp lệ hoặc không có số document",
        });
      }

      // ✅ KIỂM TRA: File có chi_tiet hay chỉ có sd_tf?
      const hasChiTiet =
        Array.isArray(parsedData.chi_tiet) && parsedData.chi_tiet.length > 0;
      const hasSdTf = parsedData.sd_tf !== null && parsedData.sd_tf !== undefined;

      // ✅ TRƯỜNG HỢP 1: File chỉ có sd_tf (import để update trạng thái)
      if (!hasChiTiet && hasSdTf) {
        console.log(
          `📝 File chỉ có sd_tf, cho phép update trạng thái cho document ${parsedData.so_document}`,
        );

        const dataCHInfo = await mapDataCHInfo(parsedData.so_document);

        const bulkOp = {
          updateOne: {
            filter: { so_document: parsedData.so_document },
            update: {
              $set: {
                trang_thai: parsedData.trang_thai || "Chờ xử lý",
                ngay_cap_nhat: new Date(),
                ...dataCHInfo,
              },
              $setOnInsert: {
                ngay_import: new Date(),
              },
            },
            upsert: true, // ✅ CHO PHÉP UPSERT khi chỉ có sd_tf
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

      // ✅ TRƯỜNG HỢP 2: File có đầy đủ chi_tiet → THROW ERROR nếu trùng
      if (!hasChiTiet) {
        await fs.unlink(filePath).catch(console.error);
        return res.status(400).json({
          message: "File không hợp lệ: không có chi tiết hoặc sd_tf",
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

      // Tạo mới
      const dataCHInfo = await mapDataCHInfo(parsedData.so_document);

      const newPhieuLe = new PhieuLe({
        so_document: parsedData.so_document,
        chi_tiet: parsedData.chi_tiet,
        trang_thai: parsedData.trang_thai || "Chờ xử lý",
        ngay_import: new Date(),
        ...dataCHInfo,
      });

      await newPhieuLe.save();
      await fs.unlink(filePath).catch(console.error);

      res.status(201).json({
        message: "✅ Import file txt thành công",
        filename: req.file.originalname,
        so_document: parsedData.so_document,
        total_items: parsedData.chi_tiet.length,
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

      res.status(500).json({
        message: "Lỗi khi import file txt",
        error: error.message,
      });
    }
  };

  // ===== IMPORT TXT MULTIPLE - Import nhiều file txt (THROW ERROR KHI TRÙNG) =====
  exports.importTxtPhieuLeMultiple = async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Không có file được upload" });
      }

      const results = {
        success: 0,
        failed: 0,
        inserted: 0,
        updated: 0, // ✅ THÊM: Đếm số file được update
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

      // ✅ KIỂM TRA TRÙNG CHỈ VỚI FILES CÓ CHI_TIET
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

          // ✅ TRƯỜNG HỢP 1: Chỉ có sd_tf → Update
          if (!hasChiTiet) {
            const bulkOp = {
              updateOne: {
                filter: { so_document: parsedData.so_document },
                update: {
                  $set: {
                    trang_thai: parsedData.trang_thai || "Chờ xử lý",
                    ngay_cap_nhat: new Date(),
                    ...dataCHInfo,
                  },
                  $setOnInsert: {
                    ngay_import: new Date(),
                  },
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

          // ✅ TRƯỜNG HỢP 2: Có chi_tiet → Kiểm tra trùng
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

          // Tạo mới
          const newPhieuLe = new PhieuLe({
            so_document: parsedData.so_document,
            chi_tiet: parsedData.chi_tiet,
            trang_thai: parsedData.trang_thai || "Chờ xử lý",
            ngay_import: new Date(),
            ...dataCHInfo,
          });

          await newPhieuLe.save();

          results.success++;
          results.inserted++;
          results.total_items += parsedData.chi_tiet.length;

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
          updated: results.updated, // ✅ Số file được update
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
        ngay_in_phieu, // ✅ THÊM
        tong_khoi_luong,
      } = req.body;

      const updateData = {
        ngay_cap_nhat: new Date(),
      };

      if (chi_tiet !== undefined) updateData.chi_tiet = chi_tiet;
      if (trang_thai !== undefined) updateData.trang_thai = trang_thai;

      // ✅ Cho phép cập nhật các field từ DataCH
      if (sd_tf !== undefined) updateData.sd_tf = sd_tf;
      if (mach !== undefined) updateData.mach = mach;
      if (tench !== undefined) updateData.tench = tench;
      if (quan !== undefined) updateData.quan = quan;
      if (chuyen !== undefined) updateData.chuyen = chuyen;
      if (ghi_chu_ch !== undefined) updateData.ghi_chu_ch = ghi_chu_ch;

      if (ghi_chu_phieu !== undefined) updateData.ghi_chu_phieu = ghi_chu_phieu;
      if (so_lan_in_phieu !== undefined)
        updateData.so_lan_in_phieu = so_lan_in_phieu;
      if (ngay_in_phieu !== undefined) updateData.ngay_in_phieu = ngay_in_phieu; // ✅ THÊM
      if (tong_khoi_luong !== undefined)
        updateData.tong_khoi_luong = tong_khoi_luong;

      const updated = await PhieuLe.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy phiếu lẻ" });
      }

      res.status(200).json({
        message: "Cập nhật phiếu lẻ thành công",
        data: updated,
      });
    } catch (error) {
      console.error("❌ Lỗi updatePhieuLe:", error);
      res
        .status(500)
        .json({ message: "Lỗi khi cập nhật phiếu lẻ", error: error.message });
    }
  };

  // ===== UPDATE STATUS - Cập nhật trạng thái phiếu lẻ =====
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

      res.status(200).json({
        message: "Cập nhật trạng thái thành công",
        data: updated,
      });
    } catch (error) {
      console.error("❌ Lỗi updatePhieuLeStatus:", error);
      res
        .status(500)
        .json({ message: "Lỗi khi cập nhật trạng thái", error: error.message });
    }
  };

  // ===== DELETE - Xóa phiếu lẻ =====
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

  // ===== CLEAR ALL - Xóa toàn bộ phiếu lẻ =====
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

      res.status(200).json({
        message: `🔥 Đã xóa ${result.deletedCount} phiếu lẻ`,
      });
    } catch (error) {
      console.error("❌ Lỗi clearAllPhieuLe:", error);
      res
        .status(500)
        .json({ message: "❌ Xóa toàn bộ thất bại", error: error.message });
    }
  };

  // ===== STATISTICS - Thống kê phiếu lẻ =====
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

      // ✅ Thống kê theo chuyền
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

      res.status(200).json({
        total,
        by_status: stats,
        by_chuyen: statsByChuyen,
      });
    } catch (error) {
      console.error("❌ Lỗi getPhieuLeStatistics:", error);
      res
        .status(500)
        .json({ message: "Lỗi khi lấy thống kê", error: error.message });
    }
  };

  function parseTxtContent(content) {
    try {
      const lines = content.split("\n");

      let so_document = null;
      let sd_tf = null;
      const chi_tiet = [];

      // ✅ TÌM DOCUMENT NO.
      for (const line of lines) {
        const docMatch = line.match(/Document\s+No\.?:?\s*(\d+)/i);
        if (docMatch) {
          so_document = parseInt(docMatch[1]);

          // ✅ THÊM: Tìm sd_tf (nếu có)
          const sdTfMatch = line.match(/SD[\/]?TF:?\s*(\d+)/i);
          if (sdTfMatch) {
            sd_tf = parseInt(sdTfMatch[1]);
          }
          break;
        }
      }

      if (!so_document) {
        console.error("❌ Không tìm thấy Document No. trong file");
        return null;
      }

      // ✅ PARSE DATA ROWS (có thể không có nếu chỉ import sd_tf)
      let startParsing = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes("_____")) {
          startParsing = true;
          continue;
        }

        if (line.includes("END OF REPORT")) {
          break;
        }

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

          if (parts.length < 10) {
            continue;
          }

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

          if (quantityIndex === -1) {
            continue;
          }

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

          if (!description || description.length === 0) {
            continue;
          }

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
          });
        } catch (err) {
          console.error(`⚠️ Lỗi parse dòng ${i}:`, err.message);
          continue;
        }
      }

      // ✅ RETURN: Cho phép trả về ngay cả khi không có chi_tiet (file chỉ có sd_tf)
      return {
        so_document,
        sd_tf, // ✅ THÊM sd_tf vào kết quả
        chi_tiet,
        trang_thai: "Chờ xử lý",
      };
    } catch (error) {
      console.error("❌ Parse txt error:", error);
      console.error("Stack:", error.stack);
      return null;
    }
  }

  // ===== UPDATE MANY - Cập nhật nhiều phiếu lẻ cùng lúc =====
  exports.updateManyPhieuLe = async (req, res) => {
    try {
      const { ids, updateData } = req.body;

      // Validate input
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          message: "Danh sách IDs phải là mảng và không được rỗng",
        });
      }

      if (!updateData || typeof updateData !== "object") {
        return res.status(400).json({
          message: "Dữ liệu cập nhật không hợp lệ",
        });
      }

      // Chuẩn bị dữ liệu cập nhật
      const allowedFields = [
        "trang_thai",
        "sd_tf",
        "mach",
        "tench",
        "quan",
        "chuyen",
        "so_lan_in_phieu",
        "ngay_in_phieu", // ✅ THÊM
        "tong_khoi_luong",
        "ghi_chu_ch",
        "ghi_chu_phieu",
      ];

      const updateFields = {};

      // Chỉ cho phép cập nhật các trường được phép
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      });

      // Validate trạng thái nếu có
      if (updateFields.trang_thai) {
        if (
          !["Chờ xử lý", "Đã xử lý", "Đã Xuất"].includes(updateFields.trang_thai)
        ) {
          return res.status(400).json({
            message:
              "Trạng thái không hợp lệ. Chỉ chấp nhận: Chờ xử lý, Đã xử lý, Đã Xuất",
          });
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          message: "Không có trường nào được cập nhật",
        });
      }

      // Thêm ngày cập nhật
      updateFields.ngay_cap_nhat = new Date();

      // Thực hiện cập nhật
      const result = await PhieuLe.updateMany(
        { _id: { $in: ids } },
        { $set: updateFields },
      );

      // Kiểm tra kết quả
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

  // ===== UPDATE MANY BY FILTER - Cập nhật nhiều phiếu lẻ theo điều kiện =====
  exports.updateManyPhieuLeByFilter = async (req, res) => {
    try {
      const { filter, updateData } = req.body;

      // Validate input
      if (!filter || typeof filter !== "object") {
        return res.status(400).json({
          message: "Filter không hợp lệ",
        });
      }

      if (!updateData || typeof updateData !== "object") {
        return res.status(400).json({
          message: "Dữ liệu cập nhật không hợp lệ",
        });
      }

      // Chuẩn bị dữ liệu cập nhật
      const allowedFields = [
        "trang_thai",
        "sd_tf",
        "mach",
        "tench",
        "quan",
        "chuyen",
        "so_lan_in_phieu",
        "ngay_in_phieu", // ✅ THÊM
        "tong_khoi_luong",
        "ghi_chu_ch",
        "ghi_chu_phieu",
      ];

      const updateFields = {};

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      });

      // Validate trạng thái nếu có
      if (updateFields.trang_thai) {
        if (
          !["Chờ xử lý", "Đã xử lý", "Đã Xuất"].includes(updateFields.trang_thai)
        ) {
          return res.status(400).json({
            message: "Trạng thái không hợp lệ",
          });
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          message: "Không có trường nào được cập nhật",
        });
      }

      updateFields.ngay_cap_nhat = new Date();

      // Đếm số lượng sẽ được cập nhật
      const countBeforeUpdate = await PhieuLe.countDocuments(filter);

      if (countBeforeUpdate === 0) {
        return res.status(404).json({
          message: "Không tìm thấy phiếu lẻ nào phù hợp với điều kiện",
        });
      }

      // Thực hiện cập nhật
      const result = await PhieuLe.updateMany(filter, { $set: updateFields });

      res.status(200).json({
        message: `✅ Cập nhật thành công ${result.modifiedCount} phiếu lẻ`,
        stats: {
          matched: result.matchedCount,
          modified: result.modifiedCount,
        },
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

  // ===== UPDATE CHI TIET - Cập nhật 1 field trong chi tiết phiếu lẻ =====
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

      // ✅ Cập nhật trực tiếp phần tử trong mảng chi_tiet
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

  // ===== UPDATE TRANG THAI BY SD/TF - Cập nhật trạng thái theo danh sách SD/TF =====
  exports.updateTrangThaiBySDTF = async (req, res) => {
    try {
      const { sd_tf_list, trang_thai } = req.body;

      // Validate input
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

      // Validate trạng thái
      const validStatuses = ["Chờ xử lý", "Đã xử lý", "Đã Xuất"];
      if (!validStatuses.includes(trang_thai)) {
        return res.status(400).json({
          success: false,
          message: `Trạng thái không hợp lệ! Phải là một trong: ${validStatuses.join(", ")}`,
        });
      }

      console.log(`📋 Cập nhật trạng thái cho ${sd_tf_list.length} SD/TF...`);
      console.log(`📝 Trạng thái mới: ${trang_thai}`);

      // Tìm các phiếu có sd_tf trong danh sách
      const result = await PhieuLe.updateMany(
        { sd_tf: { $in: sd_tf_list } },
        {
          $set: {
            trang_thai: trang_thai,
            ngay_cap_nhat: new Date(),
          },
        },
      );

      console.log(`✅ Kết quả cập nhật:`, result);

      // Lấy danh sách các phiếu đã cập nhật để kiểm tra
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

  exports.updatePackUnit1ForPhieu = async (req, res) => {
    try {
      const { id } = req.params; // ID của phiếu lẻ

      // Lấy phiếu lẻ
      const phieuLe = await PhieuLe.findById(id);
      if (!phieuLe) {
        return res.status(404).json({
          message: "Không tìm thấy phiếu lẻ",
        });
      }

      // Lọc các items có pack_unit = 1
      const itemsNeedUpdate = phieuLe.chi_tiet.filter(
        (item) => item.pack_unit === 1,
      );

      if (itemsNeedUpdate.length === 0) {
        return res.status(200).json({
          message: "Không có item nào cần cập nhật (không có pack_unit = 1)",
          updated: 0,
        });
      }

      // Lấy danh sách SKU cần tra cứu
      const skuList = itemsNeedUpdate.map((item) => item.sku);

      // Lấy pack từ DinhVi theo SKU
      const dinhViList = await DinhVi.find(
        { sku: { $in: skuList } },
        { sku: 1, pack: 1 },
      ).lean();

      // Tạo map { sku: pack }
      const packMap = {};
      dinhViList.forEach((dv) => {
        packMap[dv.sku] = dv.pack;
      });

      // Cập nhật từng item
      let updatedCount = 0;
      const bulkOps = [];

      phieuLe.chi_tiet.forEach((item, index) => {
        if (item.pack_unit === 1) {
          const pack = packMap[item.sku];

          if (pack && pack > 0) {
            // Tính pack_unit_1 và packs_to_pick_1
            const pack_unit_1 = pack;
            const packs_to_pick_1 = parseFloat(
              (item.quantity / pack_unit_1).toFixed(2),
            );
            // Tạo bulk operation để cập nhật
            bulkOps.push({
              updateOne: {
                filter: {
                  _id: phieuLe._id,
                  "chi_tiet.sku": item.sku,
                },
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

      // Thực hiện bulk update
      if (bulkOps.length > 0) {
        await PhieuLe.bulkWrite(bulkOps);
      }

      // Lấy phiếu đã cập nhật để trả về
      const updatedPhieu = await PhieuLe.findById(id);

      res.status(200).json({
        message: `✅ Đã cập nhật pack_unit_1 cho ${updatedCount} items`,
        updated: updatedCount,
        total_items: itemsNeedUpdate.length,
        data: updatedPhieu,
      });
    } catch (error) {
      console.error("❌ Lỗi updatePackUnit1ForPhieu:", error);
      res.status(500).json({
        message: "Lỗi khi cập nhật pack_unit_1",
        error: error.message,
      });
    }
  };

  // ✅ GET PACK_UNIT_1 INFO - Lấy thông tin pack_unit_1 cho 1 phiếu (không lưu vào DB)
  exports.getPackUnit1Info = async (req, res) => {
    try {
      const { id } = req.params;

      const phieuLe = await PhieuLe.findById(id).lean();
      if (!phieuLe) {
        return res.status(404).json({
          message: "Không tìm thấy phiếu lẻ",
        });
      }

      // Lọc items có pack_unit = 1
      const itemsNeedPack = phieuLe.chi_tiet.filter(
        (item) => item.pack_unit === 1,
      );

      if (itemsNeedPack.length === 0) {
        return res.status(200).json({
          message: "Không có item nào có pack_unit = 1",
          data: {},
        });
      }

      // Lấy SKU list
      const skuList = itemsNeedPack.map((item) => item.sku);

      // Tra cứu pack từ DinhVi
      const dinhViList = await DinhVi.find(
        { sku: { $in: skuList } },
        { sku: 1, pack: 1 },
      ).lean();

      // Tạo map kết quả
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

  exports.updateMultipleChiTiet = async (req, res) => {
    try {
      const { id } = req.params;
      const { updates } = req.body;

      // Validate input
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Updates array is required and must not be empty",
        });
      }

      // Validate từng update
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

      // Gọi helper function để xử lý
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
