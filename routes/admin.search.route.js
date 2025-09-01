// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const upload = multer(); // parses multipart/form-data
// const pool = require("../db");

// // Try a query; if the column doesn't exist or errors, return null instead of throwing.
// async function tryProbe(sql, params) {
//     try {
//         await pool.query(sql, params);
//         return true;
//     } catch {
//         return false;
//     }
// }

// // Find which actual column name exists for the chosen attribute by probing.
// async function resolveSearchColumn(attr) {
//     const candidatesByAttr = {
//         email: ["email", "mail", "email_id"],
//         firstname: ["firstname", "first_name", "fname", "first"],
//         lastname: ["lastname", "last_name", "lname", "last"],
//         mobile_number: [
//             "mobile_number",
//             "mobilenumber",
//             "mobile",
//             "phone",
//             "phone_number",
//         ],
//         district_id: ["district_id", "districtid", "districtId", "dist_id"],
//         club_name: ["club_name", "clubname", "club", "clubName"],
//     };
//     const candidates = candidatesByAttr[attr] || [];
//     for (const col of candidates) {
//         const ok = await tryProbe(
//             `SELECT 1 FROM public.users WHERE LOWER(((${col})::text)) LIKE $1 LIMIT 1`,
//             ["%probe%"]
//         );
//         if (ok) return col;
//     }
//     return null;
// }

// // Safely pick the first present value from a row given a list of possible field names
// function pick(row, names, fallback = null) {
//     for (const n of names) {
//         if (Object.prototype.hasOwnProperty.call(row, n) && row[n] != null)
//             return row[n];
//     }
//     return fallback;
// }

// router.post("/users/search-profiles", upload.none(), async (req, res) => {
//     try {
//         const searchQuery = (req.body?.searchQuery ?? "").toString().trim();
//         const searchAttribute = (req.body?.searchAttribute ?? "")
//             .toString()
//             .trim();

//         if (!searchQuery || !searchAttribute) {
//             return res
//                 .status(400)
//                 .json({
//                     success: false,
//                     message: "searchQuery and searchAttribute are required",
//                 });
//         }

//         const allowed = new Set([
//             "email",
//             "firstname",
//             "lastname",
//             "mobile_number",
//             "district_id",
//             "club_name",
//         ]);
//         if (!allowed.has(searchAttribute)) {
//             return res
//                 .status(400)
//                 .json({ success: false, message: "Invalid searchAttribute" });
//         }

//         // Figure out which column to search on by probing common variants
//         const searchCol = await resolveSearchColumn(searchAttribute);
//         if (!searchCol) {
//             return res
//                 .status(400)
//                 .json({
//                     success: false,
//                     message: `No matching column found for ${searchAttribute}`,
//                 });
//         }

//         const q = `%${searchQuery.toLowerCase()}%`;

//         // Pull all columns so we can map whatever exists without crashing
//         const sql = `
//       SELECT *
//         FROM public.users u
//        WHERE LOWER((u.${searchCol})::text) LIKE $1
//        LIMIT 200
//     `;
//         const rs = await pool.query(sql, [q]);

//         const results = rs.rows.map((r) => {
//             const userId = pick(r, ["user_id", "userid", "userId"]);
//             const first = pick(r, [
//                 "firstname",
//                 "first_name",
//                 "fname",
//                 "first",
//             ]);
//             const last = pick(r, ["lastname", "last_name", "lname", "last"]);
//             const email = pick(r, ["email", "mail", "email_id"]);
//             const mobile = pick(r, [
//                 "mobile_number",
//                 "mobilenumber",
//                 "mobile",
//                 "phone",
//                 "phone_number",
//             ]);
//             const district = pick(r, [
//                 "district_id",
//                 "districtid",
//                 "districtId",
//                 "dist_id",
//                 "district",
//             ]);
//             const clubName = pick(r, [
//                 "club_name",
//                 "clubname",
//                 "club",
//                 "clubName",
//             ]);
//             const status = pick(r, ["status"]);

//             return {
//                 userId: userId ?? null,
//                 name: [first, last].filter(Boolean).join(" ").trim(),
//                 district: district != null ? String(district) : "",
//                 clubName: clubName || "",
//                 emailId: email || "",
//                 mobileNumber: mobile || "",
//                 status: status || "",
//             };
//         });

//         return res.status(200).json({ success: true, results });
//     } catch (e) {
//         console.error("search-profiles error:", e && (e.stack || e));
//         return res
//             .status(500)
//             .json({ success: false, message: "Server error" });
//     }
// });

// module.exports = router;


// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const upload = multer(); // parse multipart/form-data
// const pool = require("../db");

// const ALLOWED_ATTR = new Set([
//   "email",
//   "firstname",
//   "lastname",
//   "mobile_number",
//   "district_id",
//   "club_name",
// ]);

// // Map dropdown => actual DB column in public.users
// const COL_MAP = {
//   email: "email",
//   firstname: "firstname",
//   lastname: "lastname",
//   mobile_number: "mobile_number",
//   district_id: "district_id",
//   club_name: "club_name",
// };

// function toInt(v, def) {
//   const n = parseInt(v, 10);
//   return Number.isInteger(n) && n > 0 ? n : def;
// }

// router.post("/users/search-profiles", upload.none(), async (req, res) => {
//   try {
//     const searchQuery = (req.body?.searchQuery ?? "").toString().trim();
//     const searchAttribute = (req.body?.searchAttribute ?? "").toString().trim();
//     const page = toInt(req.body?.page, 1);
//     const limitRaw = toInt(req.body?.limit, 10);
//     const limit = Math.min(Math.max(limitRaw, 1), 100); // 1..100
//     const offset = (page - 1) * limit;

//     if (!searchQuery || !searchAttribute) {
//       return res.status(400).json({ success: false, message: "searchQuery and searchAttribute are required" });
//     }
//     if (!ALLOWED_ATTR.has(searchAttribute)) {
//       return res.status(400).json({ success: false, message: "Invalid searchAttribute" });
//     }

//     const col = COL_MAP[searchAttribute];
//     const q = `%${searchQuery.toLowerCase()}%`;

//     // WHERE: cast to text for consistent partial/ci search
//     const whereSql = `LOWER((u.${col})::text) LIKE $1`;
//     const whereParams = [q];

//     // 1) total count
//     const countSql = `
//       SELECT COUNT(*)::int AS total
//         FROM public.users u
//        WHERE ${whereSql}
//     `;
//     const countRes = await pool.query(countSql, whereParams);
//     const total = countRes.rows[0]?.total ?? 0;

//     // 2) page results
//     const dataSql = `
//       SELECT
//         u.user_id,
//         u.firstname,
//         u.lastname,
//         u.email,
//         u.mobile_number,
//         u.district_id,
//         u.club_name,
//         u.status
//       FROM public.users u
//       WHERE ${whereSql}
//       ORDER BY u.user_id ASC
//       LIMIT $2 OFFSET $3
//     `;
//     const dataRes = await pool.query(dataSql, [whereParams[0], limit, offset]);

//     const results = dataRes.rows.map(r => ({
//       userId: r.user_id,
//       name: [r.firstname, r.lastname].filter(Boolean).join(" ").trim(),
//       district: r.district_id != null ? String(r.district_id) : "",
//       clubName: r.club_name || "",
//       emailId: r.email || "",
//       mobileNumber: r.mobile_number || "",
//       status: r.status || "",
//     }));

//     const totalPages = Math.max(Math.ceil(total / limit), 1);

//     return res.status(200).json({
//       success: true,
//       page,
//       limit,
//       total,
//       totalPages,
//       results,
//     });
//   } catch (e) {
//     console.error("search-profiles (paginated) error:", e && (e.stack || e));
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// module.exports = router;

// routes/admin.search.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // parse multipart/form-data
const pool = require("../db");

const ALLOWED_ATTR = new Set([
  "email",
  "firstname",
  "lastname",
  "mobile_number",
  "district_id",
  "club_name",
]);

// Map dropdown => actual DB column in public.users
const COL_MAP = {
  email: "email",
  firstname: "firstname",
  lastname: "lastname",
  mobile_number: "mobile_number",
  district_id: "district_id",
  club_name: "club_name",
};

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : def;
}

router.post("/users/search-profiles", upload.none(), async (req, res) => {
  try {
    const searchQuery = (req.body?.searchQuery ?? "").toString().trim();
    const searchAttribute = (req.body?.searchAttribute ?? "").toString().trim();

    // Pagination to match your fetch-unverified-users pattern
    const pageNum = toInt(req.body?.page, 1);
    const pageSizeRaw = toInt(req.body?.limit, 100);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100); // 1..100
    const offset = (pageNum - 1) * pageSize;

    if (!searchQuery || !searchAttribute || !ALLOWED_ATTR.has(searchAttribute)) {
      return res.status(400).json({
        error: "searchQuery and a valid searchAttribute are required",
      });
    }

    const col = COL_MAP[searchAttribute];

    // WHERE: exact numeric match for district_id when numeric, otherwise case-insensitive contains
    let whereSql, whereParam;
    const isNumericDistrict =
      searchAttribute === "district_id" && /^\d+$/.test(searchQuery);
    if (isNumericDistrict) {
      whereSql = `CAST(u.${col} AS TEXT) = $1`;
      whereParam = String(parseInt(searchQuery, 10));
    } else {
      whereSql = `LOWER((u.${col})::text) LIKE $1`;
      whereParam = `%${searchQuery.toLowerCase()}%`;
    }

    // 1) total count
    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM public.users u
       WHERE ${whereSql}
    `;
    const countRes = await pool.query(countSql, [whereParam]);
    const total = countRes.rows[0]?.total ?? 0;

    // 2) page rows (raw fields to match your fetch-unverified-users response style)
    const dataSql = `
      SELECT
        u.user_id,
        u.firstname,
        u.lastname,
        u.email,
        u.mobile_number,
        u.district_id,
        u.club_name,
        u.status
      FROM public.users u
      WHERE ${whereSql}
      ORDER BY u.user_id
      LIMIT $2 OFFSET $3
    `;
    const dataRes = await pool.query(dataSql, [whereParam, pageSize, offset]);

    // 3) Return in the same envelope shape you used for fetch-unverified-users
    return res.json({
      users: dataRes.rows,
      total,
      page: pageNum,
      limit: pageSize,
    });
  } catch (e) {
    console.error("POST /admin-api/users/search-profiles failed:", e);
    return res.status(500).json({
      error: "Unexpected server error. Please try again later.",
    });
  }
});

module.exports = router;
