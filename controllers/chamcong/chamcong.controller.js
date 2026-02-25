const ChamCong = require("../../models/chamcong/chamcong");
const MacAddress = require("../../models/chamcong/macaddress");

// Chấm công vào/ra
const chamCong = async (req, res) => {
  try {
    const { mac_address } = req.body;

    // 1. Kiểm tra mac_address có trong db không
    const macInfo = await MacAddress.findOne({ mac_address, trang_thai: true });
    if (!macInfo) {
      return res.status(403).json({ message: "MAC address không được phép hoặc không tồn tại" });
    }

    // 2. Lấy ngày hiện tại (chỉ lấy phần ngày, không lấy giờ)
    const now = new Date();
    const ngayHomNay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 3. Tìm bản ghi chấm công hôm nay
    let chamCongHomNay = await ChamCong.findOne({
      ma_nhan_vien: macInfo.ma_nhan_vien,
      ngay: ngayHomNay,
    });

    // 4. Nếu chưa có bản ghi → chấm công vào
    if (!chamCongHomNay) {
      chamCongHomNay = await ChamCong.create({
        ho_ten: macInfo.ho_ten,
        ten_nhan_vien: macInfo.ho_ten,
        ma_nhan_vien: macInfo.ma_nhan_vien,
        bo_phan: macInfo.bo_phan,
        mac_address: mac_address,
        ngay: ngayHomNay,
        gio_vao: now,
      });

      return res.status(201).json({
        message: "Chấm công vào thành công",
        data: chamCongHomNay,
      });
    }

    // 5. Nếu đã có bản ghi nhưng chưa có giờ ra → chấm công ra
    if (!chamCongHomNay.gio_ra) {
      const tongGio = (now - chamCongHomNay.gio_vao) / (1000 * 60 * 60); // đổi ms -> giờ

      chamCongHomNay.gio_ra = now;
      chamCongHomNay.tong_gio = parseFloat(tongGio.toFixed(2));
      await chamCongHomNay.save();

      return res.status(200).json({
        message: "Chấm công ra thành công",
        data: chamCongHomNay,
      });
    }

    // 6. Đã chấm công cả vào lẫn ra
    return res.status(400).json({ message: "Đã chấm công đủ vào/ra hôm nay" });

  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy danh sách chấm công (có thể filter theo ngày, bộ phận)
const getDanhSach = async (req, res) => {
  try {
    const { ngay, bo_phan, ma_nhan_vien } = req.query;
    const filter = {};

    if (ngay) filter.ngay = new Date(ngay);
    if (bo_phan) filter.bo_phan = bo_phan;
    if (ma_nhan_vien) filter.ma_nhan_vien = ma_nhan_vien;

    const danhSach = await ChamCong.find(filter).sort({ ngay: -1, gio_vao: -1 });

    res.status(200).json({ total: danhSach.length, data: danhSach });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy chi tiết 1 bản ghi
const getChiTiet = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await ChamCong.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    res.status(200).json({ data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật ghi chú
const updateGhiChu = async (req, res) => {
  try {
    const { id } = req.params;
    const { ghi_chu } = req.body;

    const record = await ChamCong.findByIdAndUpdate(
      id,
      { ghi_chu },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    res.status(200).json({ message: "Cập nhật thành công", data: record });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Xóa bản ghi
const xoaChamCong = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await ChamCong.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi" });
    }

    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = { chamCong, getDanhSach, getChiTiet, updateGhiChu, xoaChamCong };