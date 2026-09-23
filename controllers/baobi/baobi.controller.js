const BaoBi = require("../../models/baobi/baobi");

// ==========================
// Lấy toàn bộ bao bì (có filter + phân trang + lọc theo loại nhập/xuất)
// ==========================
exports.getAllBaoBi = async (req, res) => {
  try {
    const {
      loai, // "nhap" | "xuat" -- QUAN TRỌNG: lọc đúng loại bản ghi
      sku,
      name,
      ma_ch,
      ten_ch,
      ten_ncc,
      so_hd,
      so_phieu, // MỚI
      tu_ngay_hd,
      den_ngay_hd,
      tu_ngay_nhap,
      den_ngay_nhap,
      tu_ngay_xuat,
      den_ngay_xuat,
      page = 1,
      limit = 20,
      sort_by = "createdAt",
      sort_order = "desc",
    } = req.query;

    const filter = {};

    // Phân biệt record nhập / xuất -- bắt buộc truyền loai khi gọi cho từng bảng riêng
    if (loai === "nhap") filter.luong_nhap = { $ne: null };
    if (loai === "xuat") filter.luong_xuat = { $ne: null };

    if (sku) filter.sku = { $regex: sku, $options: "i" };
    if (name) filter.name = { $regex: name, $options: "i" };
    if (ma_ch) filter.ma_ch = ma_ch;
    if (ten_ch) filter.ten_ch = { $regex: ten_ch, $options: "i" };
    if (ten_ncc) filter.ten_ncc = { $regex: ten_ncc, $options: "i" };
    if (so_hd) filter.so_hd = Number(so_hd);
    if (so_phieu) filter.so_phieu = { $regex: so_phieu, $options: "i" }; // MỚI

    if (tu_ngay_hd || den_ngay_hd) {
      filter.ngay_hd = {};
      if (tu_ngay_hd) filter.ngay_hd.$gte = new Date(tu_ngay_hd);
      if (den_ngay_hd) {
        const end = new Date(den_ngay_hd);
        end.setHours(23, 59, 59, 999);
        filter.ngay_hd.$lte = end;
      }
    }

    if (tu_ngay_nhap || den_ngay_nhap) {
      filter.tg_nhap = {};
      if (tu_ngay_nhap) filter.tg_nhap.$gte = new Date(tu_ngay_nhap);
      if (den_ngay_nhap) {
        const end = new Date(den_ngay_nhap);
        end.setHours(23, 59, 59, 999);
        filter.tg_nhap.$lte = end;
      }
    }

    if (tu_ngay_xuat || den_ngay_xuat) {
      filter.tg_xuat = {};
      if (tu_ngay_xuat) filter.tg_xuat.$gte = new Date(tu_ngay_xuat);
      if (den_ngay_xuat) {
        const end = new Date(den_ngay_xuat);
        end.setHours(23, 59, 59, 999);
        filter.tg_xuat.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const sortOption = { [sort_by]: sort_order === "asc" ? 1 : -1 };

    const [data, total] = await Promise.all([
      BaoBi.find(filter).sort(sortOption).skip(skip).limit(limitNum),
      BaoBi.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách bao bì", details: err.message });
  }
};

// ==========================
// Lấy tồn hiện tại của 1 SKU bên NHẬP (dùng cho form Nhập)
// ==========================
exports.getTonHienTaiBySku = async (req, res) => {
  try {
    const { sku } = req.query;
    if (!sku) return res.status(400).json({ error: "Thiếu SKU" });

    const lastRecord = await BaoBi.findOne({
      sku,
      luong_nhap: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    res.json({
      sku,
      name: lastRecord?.name || null,
      ton_hien_tai: lastRecord ? lastRecord.ton_nhap_dau_ki || 0 : 0,
      is_first_time: !lastRecord,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy tồn hiện tại", details: err.message });
  }
};

// ==========================
// Kiểm tra khả năng xuất của 1 SKU (dùng cho form Xuất)
// - Bắt buộc SKU đã từng nhập kho (exists_in_kho = false -> chặn xuất)
// - Trả về tồn khả dụng = tồn nhập lũy kế - đã xuất lũy kế
// ==========================
exports.getKhaDungXuatBySku = async (req, res) => {
  try {
    const { sku } = req.query;
    if (!sku) return res.status(400).json({ error: "Thiếu SKU" });

    const lastNhap = await BaoBi.findOne({
      sku,
      luong_nhap: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    if (!lastNhap) {
      return res.json({
        sku,
        name: null,
        exists_in_kho: false,
        ton_nhap: 0,
        da_xuat: 0,
        ton_kha_dung: 0,
      });
    }

    const lastXuat = await BaoBi.findOne({
      sku,
      luong_xuat: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    const tonNhap = lastNhap.ton_nhap_dau_ki || 0;
    const daXuat = lastXuat ? lastXuat.ton_xuat_trong_ki || 0 : 0;

    res.json({
      sku,
      name: lastNhap.name,
      exists_in_kho: true,
      ton_nhap: tonNhap,
      da_xuat: daXuat,
      ton_kha_dung: tonNhap - daXuat,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi kiểm tra khả dụng xuất", details: err.message });
  }
};

// ==========================
// Lấy tồn kho tổng quan TẤT CẢ SKU: tồn nhập, đã xuất, tồn khả dụng
// Dùng cho card "Tồn Kho Hiện Tại" ở cả 2 màn Nhập / Xuất
// ==========================
exports.getTonKhoTatCa = async (req, res) => {
  try {
    const { name, sku } = req.query;

    const match = {};
    if (sku) match.sku = { $regex: sku, $options: "i" };
    if (name) match.name = { $regex: name, $options: "i" };

    const nhapData = await BaoBi.aggregate([
      { $match: { ...match, luong_nhap: { $ne: null } } },
      { $sort: { sku: 1, createdAt: -1 } },
      {
        $group: {
          _id: "$sku",
          sku: { $first: "$sku" },
          name: { $first: "$name" },
          ton_nhap: { $first: "$ton_nhap_dau_ki" },
        },
      },
    ]);

    const xuatData = await BaoBi.aggregate([
      { $match: { ...match, luong_xuat: { $ne: null } } },
      { $sort: { sku: 1, createdAt: -1 } },
      {
        $group: {
          _id: "$sku",
          sku: { $first: "$sku" },
          da_xuat: { $first: "$ton_xuat_trong_ki" },
        },
      },
    ]);

    const xuatMap = new Map(xuatData.map((x) => [x.sku, x.da_xuat || 0]));

    const data = nhapData.map((item) => {
      const daXuat = xuatMap.get(item.sku) || 0;
      const tonNhap = item.ton_nhap || 0;
      return {
        sku: item.sku,
        name: item.name,
        ton_nhap: tonNhap,
        da_xuat: daXuat,
        ton_kha_dung: tonNhap - daXuat,
      };
    });

    res.json({ data });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy tồn kho tổng quan", details: err.message });
  }
};

// ==========================
// Tạo 1 bản ghi NHẬP — tự cộng dồn ton_nhap_dau_ki theo SKU
// ==========================
exports.createBaoBi = async (req, res) => {
  try {
    const {
      ton_nhap_dau_ki,
      sku,
      name,
      luong_nhap,
      ten_ncc,
      so_hd,
      ngay_hd,
      tg_nhap,
      so_phieu, // MỚI
      ghi_chu, // MỚI
        ten_nguoi_xac_nhan, // MỚI

    } = req.body;

    if (!sku) return res.status(400).json({ error: "Thiếu SKU bao bì" });

    const soLuongNhap = Number(luong_nhap) || 0;

    const lastRecord = await BaoBi.findOne({
      sku,
      luong_nhap: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    let tonMoi;
    if (lastRecord) {
      tonMoi = (lastRecord.ton_nhap_dau_ki || 0) + soLuongNhap;
    } else {
      tonMoi = (Number(ton_nhap_dau_ki) || 0) + soLuongNhap;
    }

    const newBaoBi = new BaoBi({
      ton_nhap_dau_ki: tonMoi,
      sku,
      name,
      luong_nhap: soLuongNhap,
      ten_ncc,
      so_hd,
      ngay_hd,
      tg_nhap,
      so_phieu, // MỚI
      ghi_chu, // MỚI
        ten_nguoi_xac_nhan, // MỚI

    });

    const saved = await newBaoBi.save();
    res.status(201).json(saved);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Tạo bao bì thất bại", details: err.message });
  }
};

// ==========================
// Tạo 1 bản ghi XUẤT — bắt buộc SKU đã từng nhập, trừ vào tồn nhập,
// tự cộng dồn ton_xuat_trong_ki theo SKU
// ==========================
exports.createXuatBaoBi = async (req, res) => {
  try {
    const {
      sku,
      ma_ch,
      ten_ch,
      luong_xuat,
      tg_xuat,
      so_phieu, // MỚI
      ghi_chu, // MỚI
        ten_nguoi_xac_nhan, // MỚI

    } = req.body;

    if (!sku) return res.status(400).json({ error: "Thiếu SKU bao bì" });
    if (!ma_ch) return res.status(400).json({ error: "Thiếu mã cửa hàng" });

    const soLuongXuat = Number(luong_xuat);
    if (!soLuongXuat || soLuongXuat <= 0) {
      return res.status(400).json({ error: "Lượng xuất phải lớn hơn 0" });
    }

    // SKU phải có trong kho (đã từng nhập) mới được xuất
    const lastNhap = await BaoBi.findOne({
      sku,
      luong_nhap: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    if (!lastNhap) {
      return res
        .status(400)
        .json({ error: "SKU này chưa từng được nhập kho, không thể xuất" });
    }

    const lastXuat = await BaoBi.findOne({
      sku,
      luong_xuat: { $ne: null },
    }).sort({
      createdAt: -1,
    });

    const tonNhap = lastNhap.ton_nhap_dau_ki || 0;
    const daXuatTruoc = lastXuat ? lastXuat.ton_xuat_trong_ki || 0 : 0;
    const tonKhaDung = tonNhap - daXuatTruoc;

    if (soLuongXuat > tonKhaDung) {
      return res.status(400).json({
        error: `Không đủ tồn để xuất. Tồn khả dụng: ${tonKhaDung}, yêu cầu xuất: ${soLuongXuat}`,
      });
    }

    const tonXuatMoi = daXuatTruoc + soLuongXuat;

    const newXuat = new BaoBi({
      sku,
      name: lastNhap.name,
      ma_ch,
      ten_ch,
      luong_xuat: soLuongXuat,
      ton_xuat_trong_ki: tonXuatMoi,
      tg_xuat: tg_xuat || new Date(),
      so_phieu, // MỚI
      ghi_chu, // MỚI
            ten_nguoi_xac_nhan, // ← đã lấy từ req.body

    });

    const saved = await newXuat.save();
    res.status(201).json(saved);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Tạo bao bì xuất thất bại", details: err.message });
  }
};

// ==========================
// Lấy 1 bản ghi theo _id
// ==========================
exports.getBaoBiById = async (req, res) => {
  try {
    const record = await BaoBi.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi" });
    }
    res.json(record);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy bản ghi theo id", details: err.message });
  }
};

// ==========================
// Lấy danh sách bản ghi theo mã cửa hàng (chủ yếu dùng cho bên Xuất)
// ==========================
exports.getBaoBiByMaCH = async (req, res) => {
  try {
    const { ma_ch } = req.query;
    if (!ma_ch) return res.status(400).json({ error: "Thiếu mã cửa hàng" });

    const data = await BaoBi.find({ ma_ch }).sort({ createdAt: -1 });
    res.json({ data });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi tìm theo mã cửa hàng", details: err.message });
  }
};

// ==========================
// Sửa 1 bản ghi — SỬA THÔ, không tự tính lại lũy kế các bản ghi sau
// ⚠️ Nếu sửa luong_nhap/luong_xuat của 1 bản ghi cũ, các bản ghi tạo SAU nó
// theo cùng SKU sẽ KHÔNG được tự động cập nhật lại tồn lũy kế.
// (req.body đã tự chứa so_phieu/ghi_chu nếu client gửi lên, không cần sửa gì thêm)
// ==========================
exports.updateBaoBi = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await BaoBi.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi để sửa" });
    }
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Sửa bản ghi thất bại", details: err.message });
  }
};

// ==========================
// Xoá 1 bản ghi theo _id
// ⚠️ Không tự tính lại lũy kế các bản ghi sau, tương tự updateBaoBi
// ==========================
exports.deleteBaoBiById = async (req, res) => {
  try {
    const deleted = await BaoBi.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi để xoá" });
    }
    res.json({ message: "Đã xoá bản ghi", deleted });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Xoá bản ghi thất bại", details: err.message });
  }
};

// ==========================
// Import hàng loạt (Excel) — mỗi item tự xác định nhập/xuất dựa vào
// có luong_nhap hay luong_xuat. Tính lũy kế TUẦN TỰ theo đúng thứ tự
// item trong mảng, vì các item cùng SKU trong cùng batch ảnh hưởng lẫn nhau.
// Payload mong đợi: { items: [ {...nhap...} | {...xuat...}, ... ] }
// ==========================
exports.createManyBaoBi = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Danh sách import rỗng hoặc không hợp lệ" });
    }

    // cache lũy kế trong batch, key = sku
    const cacheNhap = new Map(); // sku -> ton_nhap_dau_ki hiện tại
    const cacheXuat = new Map(); // sku -> ton_xuat_trong_ki hiện tại

    const docsToInsert = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { sku } = item;

      if (!sku) {
        errors.push({ index: i, error: "Thiếu SKU" });
        continue;
      }

      const isNhap = item.luong_nhap !== undefined && item.luong_nhap !== null;
      const isXuat = item.luong_xuat !== undefined && item.luong_xuat !== null;

      if (isNhap) {
        const soLuongNhap = Number(item.luong_nhap) || 0;

        let tonHienTai = cacheNhap.get(sku);
        if (tonHienTai === undefined) {
          const lastRecord = await BaoBi.findOne({
            sku,
            luong_nhap: { $ne: null },
          }).sort({ createdAt: -1 });
          tonHienTai = lastRecord
            ? lastRecord.ton_nhap_dau_ki || 0
            : Number(item.ton_nhap_dau_ki) || 0;
        }

        const tonMoi = tonHienTai + soLuongNhap;
        cacheNhap.set(sku, tonMoi);

        docsToInsert.push({
          ton_nhap_dau_ki: tonMoi,
          sku,
          name: item.name,
          luong_nhap: soLuongNhap,
          ten_ncc: item.ten_ncc,
          so_hd: item.so_hd,
          ngay_hd: item.ngay_hd,
          tg_nhap: item.tg_nhap,
          so_phieu: item.so_phieu, // MỚI
          ghi_chu: item.ghi_chu, // MỚI
            ten_nguoi_xac_nhan: item.ten_nguoi_xac_nhan, // MỚI

        });
      } else if (isXuat) {
        const soLuongXuat = Number(item.luong_xuat) || 0;
        if (soLuongXuat <= 0) {
          errors.push({ index: i, sku, error: "Lượng xuất phải lớn hơn 0" });
          continue;
        }
        if (!item.ma_ch) {
          errors.push({ index: i, sku, error: "Thiếu mã cửa hàng" });
          continue;
        }

        let tonNhap = cacheNhap.get(sku);
        if (tonNhap === undefined) {
          const lastNhap = await BaoBi.findOne({
            sku,
            luong_nhap: { $ne: null },
          }).sort({ createdAt: -1 });
          if (!lastNhap) {
            errors.push({
              index: i,
              sku,
              error: "SKU chưa từng được nhập kho, không thể xuất",
            });
            continue;
          }
          tonNhap = lastNhap.ton_nhap_dau_ki || 0;
        }

        let daXuatTruoc = cacheXuat.get(sku);
        if (daXuatTruoc === undefined) {
          const lastXuat = await BaoBi.findOne({
            sku,
            luong_xuat: { $ne: null },
          }).sort({ createdAt: -1 });
          daXuatTruoc = lastXuat ? lastXuat.ton_xuat_trong_ki || 0 : 0;
        }

        const tonKhaDung = tonNhap - daXuatTruoc;
        if (soLuongXuat > tonKhaDung) {
          errors.push({
            index: i,
            sku,
            error: `Không đủ tồn để xuất. Tồn khả dụng: ${tonKhaDung}, yêu cầu: ${soLuongXuat}`,
          });
          continue;
        }

        const tonXuatMoi = daXuatTruoc + soLuongXuat;
        cacheXuat.set(sku, tonXuatMoi);

        docsToInsert.push({
          sku,
          name: item.name,
          ma_ch: item.ma_ch,
          ten_ch: item.ten_ch,
          luong_xuat: soLuongXuat,
          ton_xuat_trong_ki: tonXuatMoi,
          tg_xuat: item.tg_xuat || new Date(),
          so_phieu: item.so_phieu, // MỚI
          ghi_chu: item.ghi_chu, // MỚI
            ten_nguoi_xac_nhan: item.ten_nguoi_xac_nhan, // MỚI

        });
      } else {
        errors.push({
          index: i,
          sku,
          error: "Item không có luong_nhap hoặc luong_xuat, không xác định được loại",
        });
      }
    }

    const inserted = docsToInsert.length
      ? await BaoBi.insertMany(docsToInsert)
      : [];

    res.status(201).json({
      inserted_count: inserted.length,
      error_count: errors.length,
      errors,
      inserted,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Import hàng loạt thất bại", details: err.message });
  }
};