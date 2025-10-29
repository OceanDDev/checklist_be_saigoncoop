const DinhVi = require("../../models/phieusoan/dinhvi");

// ---- Helpers ----
function parseSort(sortStr = "-ngay_import,-_id") {
  const out = {};
  String(sortStr)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(token => {
      const dir = token.startsWith("-") ? -1 : 1;
      const key = token.replace(/^-/, "");
      out[key] = dir;
    });
  if (!("_id" in out)) out._id = -1;
  return out;
}

function normalizeKey(k = "") {
  return String(k).replace(/^\uFEFF/, "").trim().replace(/\s+/g, "_").toUpperCase();
}

const HEADER_MAP = {
  SLOT: "slot",
  SKU: "sku",
  NAME: "name",
  PACK: "pack",
  LOAIHINH: "loaiHinh",
  NGAY_IMPORT: "ngay_import",
  NGAY_NHAP: "ngay_import",
  "NGAY NHAP": "ngay_import",
  NGAY_TAO: "ngay_import",
  LOAIHÌNH: "loaiHinh",
};

function toDateOrNull(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]) - 1, yyyy = Number(m[3]);
    const d = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
    return isNaN(d) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function normalizeRowKeys(row = {}) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeKey(k);
    const mapped = HEADER_MAP[nk] || nk.toLowerCase();
    out[mapped] = typeof v === "string" ? v.trim() : v;
  }
  if (out.ngay_import) {
    const d = toDateOrNull(out.ngay_import);
    if (d) out.ngay_import = d;
    else delete out.ngay_import;
  }
  return out;
}

// ✅ GET ALL + Pagination + Filter + Sort
exports.getAllDinhVi = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const {
      slot,
      sku,
      name,
      pack,
      loaiHinh,
      search,
      startDate,
      endDate,
      sort,
    } = req.query;

    const filter = {};

    if (slot)     filter.slot = { $regex: String(slot), $options: "i" };
    if (name)     filter.name = { $regex: String(name), $options: "i" };
    if (loaiHinh) filter.loaiHinh = { $regex: String(loaiHinh), $options: "i" };

    // ✅ SKU là Number - so sánh chính xác hoặc prefix
    if (sku) {
      const skuNum = parseInt(sku);
      if (!isNaN(skuNum)) {
        // Tìm SKU bắt đầu bằng số này (VD: 318 -> 3189834)
        const skuStr = String(skuNum);
        const nextPrefix = String(skuNum + 1);
        filter.sku = { $gte: skuNum, $lt: parseInt(nextPrefix.padStart(skuStr.length + 1, '0')) };
      }
    }

    // ✅ Pack là Number - so sánh chính xác
    if (pack) {
      const packNum = parseInt(pack);
      if (!isNaN(packNum)) {
        filter.pack = packNum;
      }
    }

    // Khoảng ngày
    if (startDate || endDate) {
      filter.ngay_import = {};
      if (startDate) filter.ngay_import.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate)   filter.ngay_import.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    // ✅ Search thông minh: số -> SKU/Pack, text -> Slot/Name/LoaiHinh
    if (search) {
      const kw = String(search).trim();
      const kwNum = parseInt(kw);
      
      const conditions = [
        { slot: { $regex: kw, $options: "i" } },
        { name: { $regex: kw, $options: "i" } },
        { loaiHinh: { $regex: kw, $options: "i" } },
      ];
      
      // Nếu search là số hợp lệ -> thêm điều kiện tìm SKU và Pack
      if (!isNaN(kwNum)) {
        conditions.push({ sku: kwNum });
        conditions.push({ pack: kwNum });
      }
      
      filter.$or = conditions;
    }

    const sortObj = parseSort(sort);

    const [total, dinhVis] = await Promise.all([
      DinhVi.countDocuments(filter),
      DinhVi.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
    ]);

    res.status(200).json({
      data: dinhVis,
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
    console.error("❌ Lỗi getAllDinhVi:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ✅ GET BY ID
exports.getDinhViById = async (req, res) => {
  try {
    const dinhVi = await DinhVi.findById(req.params.id);
    if (!dinhVi) return res.status(404).json({ message: "Không tìm thấy định vị" });
    res.status(200).json(dinhVi);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ✅ CREATE
exports.createDinhVi = async (req, res) => {
  try {
    const body = normalizeRowKeys({ ...req.body });
    if (!body.ngay_import) body.ngay_import = new Date();

    // ✅ Ép kiểu Number cho SKU và Pack
    if (body.sku) body.sku = parseInt(body.sku);
    if (body.pack) body.pack = parseInt(body.pack);

    const newDinhVi = await DinhVi.create(body);
    res.status(201).json({ message: "Thêm thành công", data: newDinhVi });
  } catch (error) {
    res.status(400).json({ message: "Thêm thất bại", error: error.message });
  }
};

// ✅ UPDATE
exports.updateDinhVi = async (req, res) => {
  try {
    const payload = normalizeRowKeys(req.body);
    
    // ✅ Ép kiểu Number cho SKU và Pack
    if (payload.sku) payload.sku = parseInt(payload.sku);
    if (payload.pack) payload.pack = parseInt(payload.pack);

    const updated = await DinhVi.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy định vị" });
    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Cập nhật thất bại", error: error.message });
  }
};

// ✅ DELETE BY ID
exports.deleteDinhVi = async (req, res) => {
  try {
    const deleted = await DinhVi.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy định vị" });
    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ message: "Xóa thất bại", error: error.message });
  }
};

// ✅ CLEAR ALL
exports.clearAllDinhVi = async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== "DELETE_ALL") {
      return res.status(400).json({
        message: '❌ Vui lòng nhập đúng "DELETE_ALL" để xác nhận',
        required: 'confirmation: "DELETE_ALL"',
      });
    }
    const result = await DinhVi.deleteMany({});
    res.status(200).json({ message: `🔥 Đã xóa ${result.deletedCount} bản ghi` });
  } catch (error) {
    res.status(500).json({ message: "❌ Xóa toàn bộ thất bại", error: error.message });
  }
};

// ✅ IMPORT với 3 chế độ: insert / upsert / replaceAll
exports.importManyDinhVi = async (req, res) => {
  try {
    let data = req.body;
    const mode = (req.query.mode || "upsert").toLowerCase();

    if (!Array.isArray(data)) {
      return res.status(400).json({ message: "Dữ liệu phải là mảng" });
    }

    // ✅ Chuẩn hóa và ép kiểu Number cho SKU và Pack
    data = data.map(raw => {
      const item = normalizeRowKeys(raw);
      
      // Parse SKU và Pack thành Number
      const sku = parseInt(item.sku);
      const pack = parseInt(item.pack);
      
      const out = {
        slot: item.slot || "",
        sku: isNaN(sku) ? null : sku,          // ✅ Number
        name: item.name || "",
        pack: isNaN(pack) ? null : pack,        // ✅ Number
        loaiHinh: item.loaiHinh || (pack === 1 ? "Hàng Đặc Thù" : "Hàng bình thường"),
        ngay_import: item.ngay_import || new Date(),
      };
      return out;
    });

    // Validate required và kiểu dữ liệu
    const invalidRows = data.filter(it => 
      !it.slot || 
      it.sku === null || isNaN(it.sku) || 
      !it.name || 
      it.pack === null || isNaN(it.pack)
    );
    
    if (invalidRows.length > 0) {
      return res.status(400).json({
        message: `Có ${invalidRows.length} dòng thiếu hoặc sai định dạng (slot/sku/name/pack phải hợp lệ)`,
        invalidRows: invalidRows.slice(0, 5), // Show 5 dòng đầu
      });
    }

    if (mode === "replaceall") {
      await DinhVi.deleteMany({});
    }

    // Bulk operations
    let ops = [];
    if (mode === "insert") {
      ops = data.map(doc => ({
        updateOne: {
          filter: { slot: doc.slot, sku: doc.sku },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      }));
    } else {
      ops = data.map(doc => ({
        updateOne: {
          filter: { slot: doc.slot, sku: doc.sku },
          update: {
            $set: {
              name: doc.name,
              pack: doc.pack,
              loaiHinh: doc.loaiHinh,
            },
            $setOnInsert: { ngay_import: doc.ngay_import },
          },
          upsert: true,
        },
      }));
    }

    const result = await DinhVi.bulkWrite(ops, { ordered: false });

    const inserted = result.upsertedCount || 0;
    const matched  = result.matchedCount  || 0;
    const modified = result.modifiedCount || 0;

    res.status(201).json({
      message:
        mode === "insert"
          ? `✅ Import hoàn tất. Thêm mới: ${inserted}, Bỏ qua (trùng): ${matched}`
          : mode === "replaceall"
          ? `✅ Đã thay thế toàn bộ. Thêm mới: ${inserted}, Cập nhật: ${modified}`
          : `✅ Upsert xong. Thêm mới: ${inserted}, Cập nhật: ${modified}`,
      stats: {
        mode,
        inserted,
        matched,
        modified,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi importManyDinhVi:", error);
    res.status(400).json({ message: "Import thất bại", error: error.message });
  }
};