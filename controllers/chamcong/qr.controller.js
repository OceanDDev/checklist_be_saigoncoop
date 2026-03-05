const TOKEN_TTL_MS = 15_000;
const SESSION_TTL_MS = 60_000;

let currentToken = null;
let currentTokenSessionExpiry = 0;

let previousToken = null;
let previousTokenSessionExpiry = 0;

let previousPreviousToken = null;           // ← thêm
let previousPreviousTokenSessionExpiry = 0; // ← thêm

let tokenExpiry = 0;
let rotateTimer = null;
let _io = null;

function generateToken() {
  return require("crypto").randomBytes(16).toString("hex");
}

function rotateToken() {
  // Đẩy lùi 1 thế hệ
  previousPreviousToken = previousToken;
  previousPreviousTokenSessionExpiry = previousTokenSessionExpiry;

  previousToken = currentToken;
  previousTokenSessionExpiry = currentTokenSessionExpiry;

  currentToken = generateToken();
  tokenExpiry = Date.now() + TOKEN_TTL_MS;
  currentTokenSessionExpiry = Date.now() + SESSION_TTL_MS;

  if (_io) _io.emit("qr:updated", { token: currentToken, expiry: tokenExpiry });

  if (rotateTimer) clearTimeout(rotateTimer);
  rotateTimer = setTimeout(rotateToken, TOKEN_TTL_MS);
}

function startQrRotation(io) {
  _io = io;
  rotateToken();
}

function isTokenValid(token) {
  if (!token) return false;
  const now = Date.now();

  if (token === currentToken && now <= currentTokenSessionExpiry) return true;
  if (token === previousToken && now <= previousTokenSessionExpiry) return true;
  if (token === previousPreviousToken && now <= previousPreviousTokenSessionExpiry) return true; // ← thêm

  return false;
}

const getCurrentQr = (req, res) => {
  if (!currentToken || Date.now() > tokenExpiry) {
    return res.status(503).json({ message: "QR chưa sẵn sàng" });
  }
  return res.status(200).json({
    token: currentToken,
    expiry: tokenExpiry,
    ttl: Math.max(0, tokenExpiry - Date.now()),
    sessionExpiry: currentTokenSessionExpiry,
  });
};

const kiemTraQrToken = (req, res, next) => {
  const { qr_token } = req.body;
  if (!qr_token) {
    return res.status(400).json({ message: "Thiếu mã QR" });
  }
  if (!isTokenValid(qr_token)) {
    return res.status(403).json({
      message: "Mã QR đã hết hạn. Vui lòng quét lại mã mới.",
    });
  }
  next();
};

module.exports = {
  startQrRotation,
  getCurrentQr,
  isTokenValid,
  kiemTraQrToken,
};