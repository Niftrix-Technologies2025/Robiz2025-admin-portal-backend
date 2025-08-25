const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // parses multipart/form-data
const pool = require("../db");

// Try a query; if the column doesn't exist or errors, return null instead of throwing.
async function tryProbe(sql, params) {
  try {
    await pool.query(sql, params);
    return true;
  } catch {
    return false;
  }
}

// Find which actual column name exists for the chosen attribute by probing.
async function resolveSearchColumn(attr) {
  const candidatesByAttr = {
    email:         ["email", "mail", "email_id"],
    firstname:     ["firstname", "first_name", "fname", "first"],
    lastname:      ["lastname", "last_name", "lname", "last"],
    mobile_number: ["mobile_number", "mobilenumber", "mobile", "phone", "phone_number"],
    district_id:   ["district_id", "districtid", "districtId", "dist_id"],
    club_name:     ["club_name", "clubname", "club", "clubName"],
  };
  const candidates = candidatesByAttr[attr] || [];
  for (const col of candidates) {
    const ok = await tryProbe(
      `SELECT 1 FROM public.users WHERE LOWER(((${col})::text)) LIKE $1 LIMIT 1`,
      ["%probe%"]
    );
    if (ok) return col;
  }
  return null;
}

// Safely pick the first present value from a row given a list of possible field names
function pick(row, names, fallback = null) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n) && row[n] != null) return row[n];
  }
  return fallback;
}

router.post("/users/search-profiles", upload.none(), async (req, res) => {
  try {
    const searchQuery = (req.body?.searchQuery ?? "").toString().trim();
    const searchAttribute = (req.body?.searchAttribute ?? "").toString().trim();

    if (!searchQuery || !searchAttribute) {
      return res.status(400).json({ success: false, message: "searchQuery and searchAttribute are required" });
    }

    const allowed = new Set(["email", "firstname", "lastname", "mobile_number", "district_id", "club_name"]);
    if (!allowed.has(searchAttribute)) {
      return res.status(400).json({ success: false, message: "Invalid searchAttribute" });
    }

    // Figure out which column to search on by probing common variants
    const searchCol = await resolveSearchColumn(searchAttribute);
    if (!searchCol) {
      return res.status(400).json({ success: false, message: `No matching column found for ${searchAttribute}` });
    }

    const q = `%${searchQuery.toLowerCase()}%`;

    // Pull all columns so we can map whatever exists without crashing
    const sql = `
      SELECT *
        FROM public.users u
       WHERE LOWER((u.${searchCol})::text) LIKE $1
       LIMIT 200
    `;
    const rs = await pool.query(sql, [q]);

    const results = rs.rows.map((r) => {
      const userId = pick(r, ["user_id", "userid", "userId"]);
      const first  = pick(r, ["firstname", "first_name", "fname", "first"]);
      const last   = pick(r, ["lastname", "last_name", "lname", "last"]);
      const email  = pick(r, ["email", "mail", "email_id"]);
      const mobile = pick(r, ["mobile_number", "mobilenumber", "mobile", "phone", "phone_number"]);
      const district = pick(r, ["district_id", "districtid", "districtId", "dist_id", "district"]);
      const clubName = pick(r, ["club_name", "clubname", "club", "clubName"]);
      const status = pick(r, ["status"]);

      return {
        userId: userId ?? null,
        name: [first, last].filter(Boolean).join(" ").trim(),
        district: district != null ? String(district) : "",
        clubName: clubName || "",
        emailId: email || "",
        mobileNumber: mobile || "",
        status: status || "",
      };
    });

    return res.status(200).json({ success: true, results });
  } catch (e) {
    console.error("search-profiles error:", e && (e.stack || e));
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
