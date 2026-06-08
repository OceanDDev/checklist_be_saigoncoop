  const User = require('../../models/users/user');

  exports.getAllUsers = async (req, res) => {
    const users = await User.find();
    res.json(users);
  };

  exports.createUser = async (req, res) => {
    try {
      const user = new User(req.body);
      await user.save();
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
