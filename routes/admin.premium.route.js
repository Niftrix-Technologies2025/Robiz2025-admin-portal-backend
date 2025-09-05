// routes/admin.premium.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const pool = require("../db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : def;
}

function serviceTypeFromFlags(row) {
  const prem = row.is_premium_banner === true;
  const trend = row.is_trending_banner === true;
  const feat = row.is_featured_profile === true;
  const pref = row.is_search_preference === true;
  if (prem || trend) return "banner";
  if (feat) return "profile";
  if (pref) return "preference";
  return null;
}

function whereForCriteria(criteria) {
  switch (String(criteria || "all").toLowerCase()) {
    case "payment-success":
      return "COALESCE(p.is_successful,false) = true";
    case "payment-failed":
      return "COALESCE(p.is_successful,false) = false";
    case "premium-banner":
      return "COALESCE(p.is_premium_banner,false) = true";
    case "trending-banner":
      return "COALESCE(p.is_trending_banner,false) = true";
    case "search-preference":
      return "COALESCE(p.is_search_preference,false) = true";
    case "featured-profile":
      return "COALESCE(p.is_featured_profile,false) = true";
    case "all":
    default:
      return "1=1";
  }
}

/**
 * POST /admin-api/premium/fetch-payments
 * FormData: criteria (all|payment-success|payment-failed|premium-banner|trending-banner|search-preference|featured-profile)
 *           page (default 1), limit (default 10, max 100)
 * Returns: { success, page, limit, total, totalPages, results: [ { userId, username, serviceType, currency, amount, dates, isSuccessful, createdAt } ] }
 */
router.post("/premium/fetch-payments", upload.none(), async (req, res) => {
  try {
    const criteria = (req.body?.criteria ?? "all").toString();
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    const offset = (page - 1) * limit;

    const where = whereForCriteria(criteria);

    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM public.premium p
       WHERE ${where}
    `;
    const countRs = await pool.query(countSql);
    const total = countRs.rows[0]?.total ?? 0;

    const dataSql = `
      SELECT
        p.premium_id,
        p.user_id,
        p.dates,
        p.amount,
        p.currency,
        p.is_successful,
        p.is_premium_banner,
        p.is_trending_banner,
        p.is_search_preference,
        p.is_featured_profile,
        p.created_at,
        u.firstname,
        u.lastname,
        u.email
      FROM public.premium p
      LEFT JOIN public.users u ON u.user_id = p.user_id
      WHERE ${where}
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;
    const dataRs = await pool.query(dataSql, [limit, offset]);

    const results = dataRs.rows.map((r) => {
      const name =
        [r.firstname, r.lastname].filter(Boolean).join(" ").trim() ||
        r.email ||
        `User ${r.user_id}`;
      return {
        userId: r.user_id,
        username: name,
        serviceType: serviceTypeFromFlags(r), // "banner" | "profile" | "preference" | null
        currency: r.currency || null,
        amount: r.amount != null ? Number(r.amount) : null,
        dates: r.dates ?? null, // JSONB as-is
        isSuccessful: !!r.is_successful,
        createdAt: r.created_at || null,
      };
    });

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages,
      results,
    });
  } catch (e) {
    console.error("premium/fetch-payments error:", e && (e.stack || e));
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

