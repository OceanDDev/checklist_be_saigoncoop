const DinhVi = require("../../models/phieusoan/dinhvi");

// ---- Helpers ----
function parseSort(sortStr = "-ngay_import,-_id") {
  const out = {};
  String(sortStr)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((token) => {
      const dir = token.startsWith("-") ? -1 : 1;
      const key = token.replace(/^-/, "");
      out[key] = dir;
    });
  if (!("_id" in out)) out._id = -1;
  return out;
}

function normalizeKey(k = "") {
  return String(k)
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

const HEADER_MAP = {
  SLOT: "slot",
  SKU: "sku",
  NAME: "name",
  PACK: "pack",
  KHOILUONG: "khoiluong",
  LOAIHINH: "loaiHinh",
  NGAY_IMPORT: "ngay_import",
  NGAY_NHAP: "ngay_import",
  "NGAY NHAP": "ngay_import",
  NGAY_TAO: "ngay_import",
  LOAIHÌNH: "loaiHinh",
  MANCC: "maNCC",
  MA_NCC: "maNCC",
  MANH: "maNH",
  MA_NH: "maNH",
  DEPT: "Dept",
  SUBDEPT: "SubDept",
  SUB_DEPT: "SubDept",
};

function toDateOrNull(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]),
      mm = Number(m[2]) - 1,
      yyyy = Number(m[3]);
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const {
      slot,
      sku,
      name,
      pack,
      loaiHinh,
      maNCC,
      maNH,
      Dept,
      SubDept,
      search,
      startDate,
      endDate,
      sort,
    } = req.query;

    const filter = {};

    if (slot) filter.slot = { $regex: String(slot), $options: "i" };
    if (name) filter.name = { $regex: String(name), $options: "i" };
    if (loaiHinh) filter.loaiHinh = { $regex: String(loaiHinh), $options: "i" };
    if (maNCC) filter.maNCC = { $regex: String(maNCC), $options: "i" };
    if (maNH) filter.maNH = { $regex: String(maNH), $options: "i" };
    if (Dept) filter.Dept = { $regex: String(Dept), $options: "i" };
    if (SubDept) filter.SubDept = { $regex: String(SubDept), $options: "i" };

    // ✅ SKU là Number - so sánh chính xác hoặc prefix
    if (sku) {
      const skuNum = parseInt(sku);
      if (!isNaN(skuNum)) {
        const skuStr = String(skuNum);
        const nextPrefix = String(skuNum + 1);
        filter.sku = {
          $gte: skuNum,
          $lt: parseInt(nextPrefix.padStart(skuStr.length + 1, "0")),
        };
      }
    }

    // ✅ Pack là Number
    if (pack) {
      const packNum = parseInt(pack);
      if (!isNaN(packNum)) filter.pack = packNum;
    }

    // ✅ Khoảng ngày
    if (startDate || endDate) {
      filter.ngay_import = {};
      if (startDate)
        filter.ngay_import.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate)
        filter.ngay_import.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    // ✅ Search thông minh
    if (search) {
      const kw = String(search).trim();
      const kwNum = parseInt(kw);
      const conditions = [
        { slot: { $regex: kw, $options: "i" } },
        { name: { $regex: kw, $options: "i" } },
        { loaiHinh: { $regex: kw, $options: "i" } },
        { maNCC: { $regex: kw, $options: "i" } },
        { maNH: { $regex: kw, $options: "i" } },
        { Dept: { $regex: kw, $options: "i" } },
        { SubDept: { $regex: kw, $options: "i" } },
      ];
      if (!isNaN(kwNum)) {
        conditions.push({ sku: kwNum });
        conditions.push({ pack: kwNum });
        conditions.push({ khoiluong: kwNum });
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
    if (!dinhVi)
      return res.status(404).json({ message: "Không tìm thấy định vị" });
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

    if (body.sku) body.sku = parseInt(body.sku);
    if (body.pack) body.pack = parseInt(body.pack);
    if (body.khoiluong) body.khoiluong = parseFloat(body.khoiluong);

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
    if (payload.sku) payload.sku = parseInt(payload.sku);
    if (payload.pack) payload.pack = parseInt(payload.pack);
    if (payload.khoiluong) payload.khoiluong = parseFloat(payload.khoiluong);

    const updated = await DinhVi.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy định vị" });
    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Cập nhật thất bại", error: error.message });
  }
};

// ✅ DELETE BY ID
exports.deleteDinhVi = async (req, res) => {
  try {
    const deleted = await DinhVi.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy định vị" });
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
    res
      .status(200)
      .json({ message: `🔥 Đã xóa ${result.deletedCount} bản ghi` });
  } catch (error) {
    res
      .status(500)
      .json({ message: "❌ Xóa toàn bộ thất bại", error: error.message });
  }
};

// ✅ IMPORT - Upsert theo SKU (nếu chưa có thì thêm, có rồi thì cập nhật TẤT CẢ field)
exports.importManyDinhVi = async (req, res) => {
  try {
    let data = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ message: "Dữ liệu phải là mảng" });
    }

    // ✅ Chuẩn hóa dữ liệu
    data = data.map((raw) => {
      const item = normalizeRowKeys(raw);
      const sku = parseInt(item.sku);
      const pack = parseInt(item.pack);
      const khoiluong = parseFloat(item.khoiluong);

      const out = {
        slot: item.slot || "",
        sku: isNaN(sku) ? null : sku,
        name: item.name || "",
        pack: isNaN(pack) ? null : pack,
        khoiluong: isNaN(khoiluong) ? null : khoiluong,
        loaiHinh:
          item.loaiHinh || (pack === 1 ? "Hàng Đặc Thù" : "Hàng bình thường"),
        ngay_import: item.ngay_import || new Date(),
        maNCC: item.maNCC || item.mancc || "",
        maNH: item.maNH || item.manh || "",
        Dept: item.Dept || item.dept || "",
        SubDept: item.SubDept || item.subdept || "",
      };
      return out;
    });

    // ✅ Validate dữ liệu thiếu hoặc sai
    const invalidRows = data.filter(
      (it) =>
        !it.slot ||
        it.sku === null ||
        isNaN(it.sku) ||
        !it.name ||
        it.pack === null ||
        isNaN(it.pack),
    );

    if (invalidRows.length > 0) {
      return res.status(400).json({
        message: `Có ${invalidRows.length} dòng thiếu hoặc sai định dạng (slot/sku/name/pack phải hợp lệ)`,
        invalidRows: invalidRows.slice(0, 5),
      });
    }

    // ✅ Upsert dựa trên SKU - cập nhật TẤT CẢ các field
    const ops = data.map((doc) => ({
      updateOne: {
        filter: { sku: doc.sku }, // ✅ Chỉ dựa vào SKU
        update: {
          $set: {
            slot: doc.slot, // ✅ Cập nhật cả slot
            name: doc.name,
            pack: doc.pack,
            khoiluong: doc.khoiluong,
            loaiHinh: doc.loaiHinh,
            maNCC: doc.maNCC,
            maNH: doc.maNH,
            Dept: doc.Dept,
            SubDept: doc.SubDept,
            ngay_import: doc.ngay_import, // ✅ Cập nhật ngày import
          },
        },
        upsert: true, // ✅ Thêm mới nếu chưa tồn tại
      },
    }));

    const result = await DinhVi.bulkWrite(ops, { ordered: false });

    const inserted = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    const matched = result.matchedCount || 0;

    res.status(201).json({
      message: `✅ Import hoàn tất. Thêm mới: ${inserted}, Cập nhật: ${modified}, Không thay đổi: ${matched - modified}`,
      stats: { inserted, modified, matched },
    });
  } catch (error) {
    console.error("❌ Lỗi importManyDinhVi:", error);
    res.status(400).json({ message: "Import thất bại", error: error.message });
  }
};

// ✅ UPDATE PACK - Chỉ cập nhật pack theo SKU
exports.updatePackBySKU = async (req, res) => {
  try {
    const { sku, pack } = req.body;
    
    if (!sku || pack === undefined) {
      return res.status(400).json({ 
        message: "Thiếu SKU hoặc pack" 
      });
    }

    const packNum = parseInt(pack);
    if (isNaN(packNum)) {
      return res.status(400).json({ 
        message: "Pack phải là số" 
      });
    }

    const updated = await DinhVi.findOneAndUpdate(
      { sku: parseInt(sku) },
      { $set: { pack: packNum } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ 
        message: "Không tìm thấy SKU" 
      });
    }

    res.status(200).json({ 
      message: "Cập nhật pack thành công", 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ 
      message: "Cập nhật thất bại", 
      error: error.message 
    });
  }
};

// ✅ GET KHỐI LƯỢNG BY MULTIPLE SKU (Bulk)
exports.getKhoiLuongByMultipleSKU = async (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({ 
        message: "skus phải là mảng và không được rỗng" 
      });
    }

    // Chuyển đổi sang số
    const skuNumbers = skus.map(sku => parseInt(sku)).filter(sku => !isNaN(sku));

    if (skuNumbers.length === 0) {
      return res.status(400).json({ 
        message: "Không có SKU hợp lệ" 
      });
    }

    // Lấy dữ liệu từ DB
    const dinhViList = await DinhVi.find(
      { sku: { $in: skuNumbers } },
      { sku: 1, khoiluong: 1 } // Chỉ lấy 2 field cần thiết
    ).lean();

    // Tạo map { sku: khoiluong }
    const khoiLuongMap = {};
    dinhViList.forEach(dv => {
      khoiLuongMap[dv.sku] = dv.khoiluong || null;
    });

    // Đảm bảo tất cả SKU đều có trong response (null nếu không tìm thấy)
    skuNumbers.forEach(sku => {
      if (!(sku in khoiLuongMap)) {
        khoiLuongMap[sku] = null;
      }
    });

    res.status(200).json(khoiLuongMap);
  } catch (error) {
    console.error("❌ Lỗi getKhoiLuongByMultipleSKU:", error);
    res.status(500).json({ 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};

// ✅ GET KHỐI LƯỢNG BY SINGLE SKU (Optional - nếu cần)
exports.getKhoiLuongBySKU = async (req, res) => {
  try {
    const { sku } = req.params;
    const skuNum = parseInt(sku);

    if (isNaN(skuNum)) {
      return res.status(400).json({ 
        message: "SKU phải là số" 
      });
    }

    const dinhVi = await DinhVi.findOne(
      { sku: skuNum },
      { khoiluong: 1 }
    ).lean();

    if (!dinhVi) {
      return res.status(404).json({ 
        message: "Không tìm thấy SKU",
        khoiluong: null
      });
    }

    res.status(200).json({ 
      sku: skuNum,
      khoiluong: dinhVi.khoiluong || null 
    });
  } catch (error) {
    console.error("❌ Lỗi getKhoiLuongBySKU:", error);
    res.status(500).json({ 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};

exports.getPackByMultipleSKU = async (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({ 
        message: "skus phải là mảng và không được rỗng" 
      });
    }

    // Chuyển đổi sang số
    const skuNumbers = skus.map(sku => parseInt(sku)).filter(sku => !isNaN(sku));

    if (skuNumbers.length === 0) {
      return res.status(400).json({ 
        message: "Không có SKU hợp lệ" 
      });
    }

    // Lấy dữ liệu từ DB
    const dinhViList = await DinhVi.find(
      { sku: { $in: skuNumbers } },
      { sku: 1, pack: 1 } // Chỉ lấy 2 field cần thiết
    ).lean();

    // Tạo map { sku: pack }
    const packMap = {};
    dinhViList.forEach(dv => {
      packMap[dv.sku] = dv.pack || null;
    });

    // Đảm bảo tất cả SKU đều có trong response (null nếu không tìm thấy)
    skuNumbers.forEach(sku => {
      if (!(sku in packMap)) {
        packMap[sku] = null;
      }
    });

    res.status(200).json(packMap);
  } catch (error) {
    console.error("❌ Lỗi getPackByMultipleSKU:", error);
    res.status(500).json({ 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};

// ✅ GET PACK BY SINGLE SKU (Optional - nếu cần)
exports.getPackBySKU = async (req, res) => {
  try {
    const { sku } = req.params;
    const skuNum = parseInt(sku);

    if (isNaN(skuNum)) {
      return res.status(400).json({ 
        message: "SKU phải là số" 
      });
    }

    const dinhVi = await DinhVi.findOne(
      { sku: skuNum },
      { pack: 1 }
    ).lean();

    if (!dinhVi) {
      return res.status(404).json({ 
        message: "Không tìm thấy SKU",
        pack: null
      });
    }

    res.status(200).json({ 
      sku: skuNum,
      pack: dinhVi.pack || null 
    });
  } catch (error) {
    console.error("❌ Lỗi getPackBySKU:", error);
    res.status(500).json({ 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};