// routes/admin.content.route.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : def;
}

router.post("/content/fetch-all-banners", async (req, res) => {
  try {
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    const offset = (page - 1) * limit;

    const where = `COALESCE(p.is_premium_banner, false) OR COALESCE(p.is_trending_banner, false)`;

    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM public.premium p
       WHERE ${where}
    `;
    const totalRs = await pool.query(countSql);
    const total = totalRs.rows[0]?.total ?? 0;

    const dataSql = `
      SELECT
        p.premium_id,
        p.user_id,
        p.dates,
        p.amount,
        p.currency,
        p.is_successful,
        p.created_at,
        p.updated_at,
        p.banner_url,
        p.is_premium_banner,
        p.is_trending_banner,
        p.trending_banner_slot_no,
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
        (r.user_id != null ? `User ${r.user_id}` : "Unknown");

      const bannerType = r.is_trending_banner
        ? "trending-banner"
        : r.is_premium_banner
        ? "premium-banner"
        : null;

      return {
        userId: r.user_id ?? null,
        username: name,
        bannerType,                                // "premium-banner" | "trending-banner"
        currency: r.currency ?? null,
        amount: r.amount != null ? Number(r.amount) : null,
        createdAt: r.created_at ?? null,
        updatedAt: r.updated_at ?? null,
        selectedDates: r.dates ?? null,            // JSONB
        bannerImageUrl: r.banner_url ?? null,
        trendingBannerSlotNo:
          r.trending_banner_slot_no != null ? Number(r.trending_banner_slot_no) : null,
        isSuccessful: !!r.is_successful,
      };
    });

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return res.status(200).json({ success: true, page, limit, total, totalPages, results });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

