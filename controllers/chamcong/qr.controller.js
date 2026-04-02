    const TOKEN_TTL_MS = 5_000;
    const SESSION_TTL_MS = 60_000;

    // Map<token, sessionExpiry> — giữ tất cả token còn trong session (tối đa 60s)
    const activeTokens = new Map();

    let currentToken = null;
    let tokenExpiry = 0;
    let rotateTimer = null;
    let _io = null;

    function generateToken() {
      return require("crypto").randomBytes(16).toString("hex");
    }

    /** Xóa các token đã hết session để tránh Map phình to */
    function pruneExpiredTokens() {
      const now = Date.now();
      for (const [token, sessionExpiry] of activeTokens) {
        if (now > sessionExpiry) activeTokens.delete(token);
      }
    }

    function rotateToken() {
      pruneExpiredTokens();

      currentToken = generateToken();
      tokenExpiry = Date.now() + TOKEN_TTL_MS;
      const sessionExpiry = Date.now() + SESSION_TTL_MS;

      // Lưu vào Map — token này hợp lệ trong 60s kể từ lúc phát sinh
      activeTokens.set(currentToken, sessionExpiry);

      if (_io) _io.emit("qr:updated", { token: currentToken, expiry: tokenExpiry });

      if (rotateTimer) clearTimeout(rotateTimer);
      rotateTimer = setTimeout(rotateToken, TOKEN_TTL_MS);
    }

    function startQrRotation(io) {
      _io = io;
      rotateToken();
    }

    /** Token hợp lệ nếu còn trong Map VÀ chưa hết session */
    function isTokenValid(token) {
      if (!token) return false;
      const sessionExpiry = activeTokens.get(token);
      if (!sessionExpiry) return false;
      if (Date.now() > sessionExpiry) {
        activeTokens.delete(token);
        return false;
      }
      return true;
    }

    function getSessionExpiry(token) {
      return activeTokens.get(token) ?? 0;
    }

    // ─── Controllers ─────────────────────────────────────────────────────────────

    const getCurrentQr = (req, res) => {
      if (!currentToken || Date.now() > tokenExpiry) {
        return res.status(503).json({ message: "QR chưa sẵn sàng" });
      }
      return res.status(200).json({
        token: currentToken,
        expiry: tokenExpiry,
        ttl: Math.max(0, tokenExpiry - Date.now()),
        sessionExpiry: getSessionExpiry(currentToken),
      });
    };

    const validateQrToken = (req, res) => {
      const { qr_token } = req.query;
      if (!qr_token) return res.status(400).json({ valid: false });

      const valid = isTokenValid(qr_token);
      const sessionExpiry = valid ? getSessionExpiry(qr_token) : 0;

      return res.status(200).json({ valid, sessionExpiry });
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
      validateQrToken,    
    };
