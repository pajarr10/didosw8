const express = require("express");
const router = express.Router();
const { getOverview, verifyAdmin } = require("../controllers/statsController");

function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== (process.env.ADMIN_KEY || "pajar")) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }
  next();
}

// POST /api/admin/login
router.post("/admin/login", verifyAdmin);

// GET /api/admin/stats  (butuh header x-admin-key)
router.get("/admin/stats", requireAdminKey, getOverview);

module.exports = router;
