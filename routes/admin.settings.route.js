// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const upload = multer(); // to accept FormData
// const pool = require("../db");

// // helpers
// const norm = (v) => (v == null ? "" : String(v).trim());
// const toNullIfEmpty = (v) => (norm(v) === "" ? null : norm(v));

// /**
//  * POST /admin-api/settings/add-club
//  * FormData: districtId (req), clubName (req), clubId (opt), zoneName (opt)
//  * Table: public.district_master (district_id, club_name, zone_name, club_id, created_at, updated_at)
//  */
// router.post("/settings/add-club", upload.none(), async (req, res) => {
//   try {
//     const districtId = norm(req.body?.districtId);
//     const clubName   = norm(req.body?.clubName);
//     const clubId     = toNullIfEmpty(req.body?.clubId);
//     const zoneName   = toNullIfEmpty(req.body?.zoneName);

//     if (!districtId || !clubName) {
//       return res.status(400).json({ success: false, message: "districtId and clubName are required" });
//     }

//     // duplicate check (by (district_id, club_name) or club_id if provided)
//     const dupParams = [districtId.toLowerCase(), clubName.toLowerCase()];
//     let dupSql = `
//       SELECT 1
//         FROM public.district_master
//        WHERE LOWER(district_id) = $1 AND LOWER(club_name) = $2
//        LIMIT 1
//     `;
//     if (clubId) {
//       dupSql = `
//         SELECT 1
//           FROM public.district_master
//          WHERE (LOWER(district_id) = $1 AND LOWER(club_name) = $2)
//             OR club_id = $3
//          LIMIT 1
//       `;
//       dupParams.push(clubId);
//     }
//     const dup = await pool.query(dupSql, dupParams);
//     if (dup.rowCount > 0) {
//       return res.status(409).json({ success: false, message: "Club already exists" });
//     }

//     const insertSql = `
//       INSERT INTO public.district_master
//         (district_id, club_name, zone_name, club_id, created_at, updated_at)
//       VALUES
//         ($1, $2, $3, $4, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
//       RETURNING district_id, club_name, zone_name, club_id, created_at, updated_at
//     `;
//     const { rows } = await pool.query(insertSql, [districtId, clubName, zoneName, clubId]);

//     return res.status(201).json({ success: true, data: rows[0] });
//   } catch (e) {
//     console.error("settings/add-club error:", e && (e.stack || e));
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// /**
//  * POST /admin-api/settings/add-industry
//  * FormData: industry (req), classification (req)
//  * Table: public.category_classification (industry, classification, created_at, updated_at)
//  */
// router.post("/settings/add-industry", upload.none(), async (req, res) => {
//   try {
//     const industry      = norm(req.body?.industry);
//     const classification = norm(req.body?.classification);

//     if (!industry || !classification) {
//       return res.status(400).json({ success: false, message: "industry and classification are required" });
//     }

//     // duplicate check (case-insensitive)
//     const dup = await pool.query(
//       `SELECT 1
//          FROM public.category_classification
//         WHERE LOWER(industry) = LOWER($1)
//           AND LOWER(classification) = LOWER($2)
//         LIMIT 1`,
//       [industry, classification]
//     );
//     if (dup.rowCount > 0) {
//       return res.status(409).json({ success: false, message: "Industry/classification already exists" });
//     }

//     const insertSql = `
//       INSERT INTO public.category_classification
//         (industry, classification, created_at, updated_at)
//       VALUES
//         ($1, $2, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
//       RETURNING industry, classification, created_at, updated_at
//     `;
//     const { rows } = await pool.query(insertSql, [industry, classification]);

//     return res.status(201).json({ success: true, data: rows[0] });
//   } catch (e) {
//     console.error("settings/add-industry error:", e && (e.stack || e));
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// module.exports = router;


// routes/admin.settings.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { parse } = require("csv-parse/sync");
const pool = require("../db");

const norm = (v) => (v == null ? "" : String(v).trim());
const toNullIfEmpty = (v) => (norm(v) === "" ? null : norm(v));
const pick = (record, candidates) => {
  if (!record) return "";
  const keys = Object.keys(record);
  for (const c of candidates) {
    const hit = keys.find(
      (k) =>
        k.replace(/[^a-z0-9]/gi, "").toLowerCase() === c.replace(/[^a-z0-9]/gi, "").toLowerCase()
    );
    if (hit) {
      const val = norm(record[hit]);
      if (val !== "") return val;
    }
  }
  return "";
};

/**
 * POST /admin-api/settings/add-club
 * FormData (manual): districtId, clubName, clubId?, zoneName?, file = null
 * FormData (file): file=<csv>, districtId/clubName/clubId/zoneName may be ""
 * CSV headers accepted (case/space/underscore insensitive):
 *   district_id, club_name, club_id, zone_name
 */
router.post("/settings/add-club", upload.single("file"), async (req, res) => {
  try {
    const hasFile = !!(req.file && req.file.buffer && req.file.size > 0);

    if (hasFile) {
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

      let inserted = 0;
      let skipped = 0;
      const invalid = [];
      const failed = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;

        const districtId = norm(pick(r, ["district_id", "districtid", "district", "districtId"]));
        const clubName = norm(pick(r, ["club_name", "clubname", "club", "clubName"]));
        const clubId = toNullIfEmpty(pick(r, ["club_id", "clubId"]));
        const zoneName = toNullIfEmpty(pick(r, ["zone_name", "zone", "zoneName"]));

        if (!districtId || !clubName) {
          invalid.push({ row: rowNum, reason: "Missing required districtId/clubName" });
          continue;
        }

        try {
          const dupParams = [districtId.toLowerCase(), clubName.toLowerCase()];
          let dupSql = `
            SELECT 1 FROM public.district_master
            WHERE LOWER(district_id) = $1 AND LOWER(club_name) = $2
            LIMIT 1
          `;
          if (clubId) {
            dupSql = `
              SELECT 1 FROM public.district_master
              WHERE (LOWER(district_id) = $1 AND LOWER(club_name) = $2) OR club_id = $3
              LIMIT 1
            `;
            dupParams.push(clubId);
          }
          const dup = await pool.query(dupSql, dupParams);
          if (dup.rowCount > 0) {
            skipped += 1;
            continue;
          }

          const ins = await pool.query(
            `
            INSERT INTO public.district_master
              (district_id, club_name, zone_name, club_id, created_at, updated_at)
            VALUES
              ($1, $2, $3, $4, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
            RETURNING district_id, club_name
            `,
            [districtId, clubName, zoneName, clubId]
          );
          if (ins.rowCount === 1) inserted += 1;
        } catch (e) {
          failed.push({ row: rowNum, reason: e.message || "DB error" });
        }
      }

      return res.status(200).json({
        success: true,
        mode: "file",
        totalRowsInCSV: rows.length,
        inserted,
        skippedDuplicates: skipped,
        invalidCount: invalid.length,
        invalidRows: invalid.slice(0, 50),
        failedCount: failed.length,
        failedRows: failed.slice(0, 50),
      });
    } else {
      const districtId = norm(req.body?.districtId);
      const clubName = norm(req.body?.clubName);
      const clubId = toNullIfEmpty(req.body?.clubId);
      const zoneName = toNullIfEmpty(req.body?.zoneName);

      if (!districtId || !clubName) {
        return res.status(400).json({ success: false, message: "districtId and clubName are required" });
      }

      const dupParams = [districtId.toLowerCase(), clubName.toLowerCase()];
      let dupSql = `
        SELECT 1 FROM public.district_master
        WHERE LOWER(district_id) = $1 AND LOWER(club_name) = $2
        LIMIT 1
      `;
      if (clubId) {
        dupSql = `
          SELECT 1 FROM public.district_master
          WHERE (LOWER(district_id) = $1 AND LOWER(club_name) = $2) OR club_id = $3
          LIMIT 1
        `;
        dupParams.push(clubId);
      }
      const dup = await pool.query(dupSql, dupParams);
      if (dup.rowCount > 0) {
        return res.status(409).json({ success: false, message: "Club already exists" });
      }

      const { rows } = await pool.query(
        `
        INSERT INTO public.district_master
          (district_id, club_name, zone_name, club_id, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
        RETURNING district_id, club_name, zone_name, club_id, created_at, updated_at
        `,
        [districtId, clubName, zoneName, clubId]
      );

      return res.status(201).json({ success: true, mode: "manual", data: rows[0] });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /admin-api/settings/add-industry
 * FormData (manual): industry, classification, file = null
 * FormData (file): file=<csv>, industry/classification may be ""
 * CSV headers accepted (case/space/underscore insensitive):
 *   industry, classification
 */
router.post("/settings/add-industry", upload.single("file"), async (req, res) => {
  try {
    const hasFile = !!(req.file && req.file.buffer && req.file.size > 0);

    if (hasFile) {
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

      let inserted = 0;
      let skipped = 0;
      const invalid = [];
      const failed = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;

        const industry = norm(pick(r, ["industry"]));
        const classification = norm(pick(r, ["classification", "class", "category", "type"]));

        if (!industry || !classification) {
          invalid.push({ row: rowNum, reason: "Missing required industry/classification" });
          continue;
        }

        try {
          const dup = await pool.query(
            `SELECT 1
               FROM public.category_classification
              WHERE LOWER(industry) = LOWER($1)
                AND LOWER(classification) = LOWER($2)
              LIMIT 1`,
            [industry, classification]
          );
          if (dup.rowCount > 0) {
            skipped += 1;
            continue;
          }

          const ins = await pool.query(
            `
            INSERT INTO public.category_classification
              (industry, classification, created_at, updated_at)
            VALUES
              ($1, $2, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
            RETURNING industry
            `,
            [industry, classification]
          );
          if (ins.rowCount === 1) inserted += 1;
        } catch (e) {
          failed.push({ row: rowNum, reason: e.message || "DB error" });
        }
      }

      return res.status(200).json({
        success: true,
        mode: "file",
        totalRowsInCSV: rows.length,
        inserted,
        skippedDuplicates: skipped,
        invalidCount: invalid.length,
        invalidRows: invalid.slice(0, 50),
        failedCount: failed.length,
        failedRows: failed.slice(0, 50),
      });
    } else {
      const industry = norm(req.body?.industry);
      const classification = norm(req.body?.classification);

      if (!industry || !classification) {
        return res.status(400).json({ success: false, message: "industry and classification are required" });
      }

      const dup = await pool.query(
        `SELECT 1
           FROM public.category_classification
          WHERE LOWER(industry) = LOWER($1)
            AND LOWER(classification) = LOWER($2)
          LIMIT 1`,
        [industry, classification]
      );
      if (dup.rowCount > 0) {
        return res.status(409).json({ success: false, message: "Industry/classification already exists" });
      }

      const { rows } = await pool.query(
        `
        INSERT INTO public.category_classification
          (industry, classification, created_at, updated_at)
        VALUES
          ($1, $2, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
        RETURNING industry, classification, created_at, updated_at
        `,
        [industry, classification]
      );

      return res.status(201).json({ success: true, mode: "manual", data: rows[0] });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
