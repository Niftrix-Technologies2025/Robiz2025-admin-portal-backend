const express = require("express");
const router = express.Router();
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const pool = require("../db");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function norm(v) { return String(v ?? "").trim(); }
function lower(v) { return norm(v).toLowerCase(); }
function pick(record, candidates) {
  const keys = Object.keys(record);
  for (const c of candidates) {
    const hit = keys.find(
      k => k.replace(/[^a-z0-9]/gi,"").toLowerCase() === c.replace(/[^a-z0-9]/gi,"").toLowerCase()
    );
    if (hit && norm(record[hit]) !== "") return norm(record[hit]);
  }
  return "";
}

async function getExistingUserColumns() {
  const rs = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users'`
  );
  return new Set(rs.rows.map(r => r.column_name));
}

router.post("/users/add-users-from-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "CSV file is required (field name: file)" });
    }

    let rows;
    try {
      rows = parse(req.file.buffer.toString("utf8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      return res.status(400).json({ success: false, message: "Invalid CSV format" });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "CSV has no data rows" });
    }

    const prepared = [];
    const invalid = [];
    const seenEmail = new Set();
    const seenMobile = new Set();

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;
      const firstname   = pick(r, ["firstname","first_name","fname","first"]);
      const lastname    = pick(r, ["lastname","last_name","lname","last"]);
      const email       = pick(r, ["email","mail","email_id"]);
      const mobile      = pick(r, ["mobile_number","mobilenumber","mobile","phone","phone_number"]);
      const districtStr = pick(r, ["district_id","districtid","district"]);
      const clubName    = pick(r, ["club_name","clubname","club"]);
      const rotaryId    = pick(r, ["rotary_id","rotaryid","rotary"]);

      const district_id = districtStr !== "" && !isNaN(parseInt(districtStr, 10))
        ? parseInt(districtStr, 10)
        : null;

      if (email === "" && mobile === "") {
        invalid.push({ row: rowNum, reason: "Missing both email and mobile_number" });
        return;
      }

      const eKey = lower(email);
      const mKey = lower(mobile);
      if (eKey && seenEmail.has(eKey)) {
        invalid.push({ row: rowNum, reason: "Duplicate email within CSV" });
        return;
      }
      if (mKey && seenMobile.has(mKey)) {
        invalid.push({ row: rowNum, reason: "Duplicate mobile_number within CSV" });
        return;
      }
      if (eKey) seenEmail.add(eKey);
      if (mKey) seenMobile.add(mKey);

      prepared.push({
        firstname: firstname || null,
        lastname: lastname || null,
        email: email || null,
        mobile_number: mobile || null,
        district_id,
        club_name: clubName || null,
        rotary_id: rotaryId || null,
        status: "NEW",
      });
    });

    if (prepared.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid rows to insert",
        invalidCount: invalid.length,
        invalidRows: invalid,
      });
    }

    const existingCols = await getExistingUserColumns();
    const allowedCols = [
      "firstname",
      "lastname",
      "email",
      "mobile_number",
      "district_id",
      "club_name",
      "rotary_id",
      "status",
    ].filter(c => existingCols.has(c));

    const hasCreatedAt = existingCols.has("created_at");
    const hasUpdatedAt = existingCols.has("updated_at");

    let inserted = 0;
    let skippedConflict = 0;
    const failed = [];

    for (let i = 0; i < prepared.length; i++) {
      const row = prepared[i];
      const rowNum = i + 2;

      const cols = [];
      const placeholders = [];
      const params = [];

      // parameterized fields
      for (const c of allowedCols) {
        cols.push(c);
        params.push(row[c] ?? null);
        placeholders.push(`$${params.length}`);
      }

      // raw NOW() for timestamps if those columns exist
      if (hasCreatedAt) {
        cols.push("created_at");
        placeholders.push("NOW()");
      }
      if (hasUpdatedAt) {
        cols.push("updated_at");
        placeholders.push("NOW()");
      }

      if (cols.length === 0) {
        failed.push({ row: rowNum, reason: "No insertable columns exist in users table" });
        continue;
      }

      const sql = `
        INSERT INTO public.users (${cols.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT DO NOTHING
        RETURNING user_id
      `;

      try {
        const rs = await pool.query(sql, params);
        if (rs.rowCount === 1) {
          inserted += 1;
        } else {
          skippedConflict += 1; // duplicate by DB constraint
        }
      } catch (e) {
        console.error(`CSV insert error (row ${rowNum}):`, e.message);
        failed.push({ row: rowNum, reason: e.message || "DB error" });
      }
    }

    return res.status(200).json({
      success: true,
      totalRowsInCSV: rows.length,
      attempted: prepared.length,
      inserted,
      skippedExistingOrConflict: skippedConflict,
      invalidCount: invalid.length,
      invalidRows: invalid.slice(0, 50),
      failedCount: failed.length,
      failedRows: failed.slice(0, 50),
    });
  } catch (e) {
    console.error("add-users-from-csv error:", e.message || e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
