// controllers/authController.js
const User = require("../../models/users/user");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password }); // KHÔNG mã hóa

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tên đăng nhập hoặc mật khẩu sai",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      user: {
        _id: user._id,
        name: user.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};


exports.register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "username đã được sử dụng" });
    }

    // Tạo người dùng mới
    const newUser = new User({ name, username, password });
    await newUser.save();

    res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        _id: newUser._id,
        name: newUser.name,
        username: newUser.username,
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};
