// controllers/product.controller.js
const Product = require("../../../models/dieuvan/xuattra/product");

// ====== CREATE ONE ======
// (Giữ nguyên)
exports.createProduct = async (req, res) => {
    try {
        const { sku, tenHang, upc } = req.body;

        // Chỉ kiểm tra UPC nếu có giá trị
        if (upc) {
            const existing = await Product.findOne({ upc });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "UPC đã tồn tại",
                });
            }
        }

        const newProduct = new Product({ sku, tenHang, upc });
        await newProduct.save();

        res.status(201).json({
            success: true,
            message: "Tạo sản phẩm thành công",
            data: newProduct,
        });
    } catch (error) {
        console.error("❌ Lỗi khi tạo sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo sản phẩm",
            error,
        });
    }
};

// ====== CREATE MANY ======
// (Giữ nguyên)
exports.createManyProducts = async (req, res) => {
    try {
        const { products } = req.body;

        console.log("📦 Nhận được:", products?.length, "sản phẩm");

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ. Cần một mảng products",
            });
        }

        // Xóa index sku_1 nếu tồn tại
        try {
            const indexes = await Product.collection.getIndexes();
            console.log("📋 Các index hiện tại:", Object.keys(indexes));

            if (indexes.sku_1) {
                console.log("🗑️ Đang xóa index sku_1...");
                await Product.collection.dropIndex("sku_1");
                console.log("✅ Đã xóa index sku_1");
            }
        } catch (indexErr) {
            console.log("⚠️ Không thể xóa index:", indexErr.message);
        }

        // Chỉ kiểm tra trùng UPC (bỏ qua các item không có UPC)
        const upcs = products
            .filter((p) => p.upc)
            .map((p) => p.upc);

        console.log("🔍 Kiểm tra", upcs.length, "UPC");

        if (upcs.length > 0) {
            const existingProducts = await Product.find({ upc: { $in: upcs } });

            if (existingProducts.length > 0) {
                const existingUPCs = existingProducts.map((p) => p.upc);
                console.log("❌ Tìm thấy", existingUPCs.length, "UPC trùng");
                return res.status(400).json({
                    success: false,
                    message: `Tìm thấy ${existingUPCs.length} UPC đã tồn tại`,
                    existingUPCs: existingUPCs.slice(0, 50),
                });
            }
        }

        // Insert với ordered: false
        console.log("💾 Đang insert...");
        let insertedCount = 0;
        let insertedDocs = [];
        let duplicateCount = 0;

        try {
            const result = await Product.insertMany(products, { ordered: false });
            insertedCount = result.length;
            insertedDocs = result;
            console.log("✅ Insert thành công:", insertedCount, "sản phẩm");
        } catch (bulkError) {
            if (bulkError.code === 11000) {
                insertedCount = bulkError.result?.nInserted || 0;
                insertedDocs = bulkError.insertedDocs || [];
                duplicateCount = (bulkError.writeErrors || []).length;

                const firstError = bulkError.writeErrors?.[0];
                if (firstError) {
                    console.log("🔍 Lỗi duplicate đầu tiên:");
                    console.log("   Message:", firstError.err?.errmsg);
                }

                console.log("⚠️ Có duplicate:");
                console.log("  ✅ Thành công:", insertedCount);
                console.log("  ❌ Trùng lặp:", duplicateCount);

                return res.status(201).json({
                    success: true,
                    partial: true,
                    message: `Đã thêm ${insertedCount} sản phẩm. Bỏ qua ${duplicateCount} sản phẩm trùng lặp.`,
                    data: insertedDocs,
                    insertedCount,
                    duplicateCount,
                });
            }
            throw bulkError;
        }

        res.status(201).json({
            success: true,
            message: `Tạo thành công ${insertedCount} sản phẩm`,
            data: insertedDocs,
            insertedCount,
        });
    } catch (error) {
        console.error("❌ Lỗi khi tạo nhiều sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo nhiều sản phẩm",
            error: error.message,
        });
    }
};

// ====== READ ALL (CÓ PHÂN TRANG VÀ LỌC BỔ SUNG) ======
exports.getAllProducts = async (req, res) => {
    try {
        const filter = {};
        const { search, upc, sku, page, limit } = req.query;

        // 1. Lọc chính xác theo UPC hoặc SKU (nếu có)
        // Đây là ưu tiên cao nhất, thường dùng cho tra cứu nhanh 1 bản ghi
        if (upc) {
            filter.upc = upc;
        } else if (sku) {
            filter.sku = sku;
        }

        // 2. Tìm kiếm chung (search)
        if (search) {
            // Nếu đã có UPC/SKU ở trên, thì search sẽ được bỏ qua.
            // Nếu không có UPC/SKU, áp dụng tìm kiếm chung
            if (!filter.upc && !filter.sku) {
                filter.$or = [
                    { sku: new RegExp(search, "i") },
                    { tenHang: new RegExp(search, "i") },
                    { upc: new RegExp(search, "i") },
                ];
            }
        }
        
        // Phân trang
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50; // Mặc định 50 items/page
        const skip = (pageNum - 1) * limitNum;

        // Đếm tổng số
        const total = await Product.countDocuments(filter);

        // Lấy dữ liệu
        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            data: products,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách sản phẩm",
            error,
        });
    }
};

// ====== READ ONE ======
// (Giữ nguyên)
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm",
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy chi tiết sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy chi tiết sản phẩm",
            error,
        });
    }
};

// ====== GET BY SKU ======
// (Giữ nguyên - đây là API chuyên biệt)
exports.getProductBySKU = async (req, res) => {
    try {
        const product = await Product.findOne({ sku: req.params.sku });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy SKU",
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error("❌ Lỗi khi tìm sản phẩm theo SKU:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi tìm sản phẩm theo SKU",
            error,
        });
    }
};

// ====== GET BY UPC ======
// (Giữ nguyên - đây là API chuyên biệt)
exports.getProductByUPC = async (req, res) => {
    try {
        const product = await Product.findOne({ upc: req.params.upc });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy UPC",
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error("❌ Lỗi khi tìm sản phẩm theo UPC:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi tìm sản phẩm theo UPC",
            error,
        });
    }
};

// ====== UPDATE ======
// (Giữ nguyên)
exports.updateProduct = async (req, res) => {
    try {
        const { upc } = req.body;

        // Nếu cập nhật UPC, kiểm tra trùng lặp
        if (upc) {
            const existing = await Product.findOne({
                upc,
                _id: { $ne: req.params.id },
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "UPC đã tồn tại",
                });
            }
        }

        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm để cập nhật",
            });
        }

        res.json({
            success: true,
            message: "Cập nhật sản phẩm thành công",
            data: updated,
        });
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật sản phẩm",
            error,
        });
    }
};

// ====== DELETE ONE ======
// (Giữ nguyên)
exports.deleteProduct = async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm để xóa",
            });
        }

        res.json({
            success: true,
            message: "Xóa sản phẩm thành công",
        });
    } catch (error) {
        console.error("❌ Lỗi khi xóa sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa sản phẩm",
            error,
        });
    }
};

// ====== DELETE MANY ======
// (Giữ nguyên)
exports.deleteManyProducts = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ. Cần một mảng ids",
            });
        }

        const result = await Product.deleteMany({ _id: { $in: ids } });

        res.json({
            success: true,
            message: `Xóa thành công ${result.deletedCount} sản phẩm`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("❌ Lỗi khi xóa nhiều sản phẩm:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa nhiều sản phẩm",
            error,
        });
    }
};