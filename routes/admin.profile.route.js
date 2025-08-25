const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // to accept FormData on POST if needed
const pool = require("../db");

// helpers
function toAbs(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.FILE_BASE_URL || "";
  return base ? base.replace(/\/$/, "") + "/" + String(url).replace(/^\//, "") : url;
}

function pick(row, names, fallback = null) {
  if (!row) return fallback;
  for (const n of names) if (row[n] != null) return row[n];
  return fallback;
}

async function buildProfile(userId) {
  // core user
  const uRes = await pool.query(
    `SELECT user_id, firstname, lastname, email, mobile_number,
            district_id, club_name, rotary_id, status
       FROM public.users
      WHERE user_id = $1`,
    [userId]
  );
  if (uRes.rowCount === 0) return null;
  const u = uRes.rows[0];

  // profile_detail (designation, district, club, social, dp fallback)
  const pRes = await pool.query(
    `SELECT profile_image, district_name, club_name, designation,
            facebook_url, linked_in_url, website
       FROM public.profile_detail
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  const p = pRes.rows[0] || {};

  // data_collection (bio + business)
  const dRes = await pool.query(
    `SELECT profile_picture, personal_bio, legal_business_name,
            business_industry, business_category, headquarters,
            business_logo, business_description
       FROM public.data_collection
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  const d = dRes.rows[0] || {};

  // referral KPIs
  const g = await pool.query(
    `SELECT COUNT(*)::int AS c FROM public.referral_page WHERE user_id = $1`,
    [userId]
  );
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM public.referral_page WHERE referred_user_id = $1`,
    [userId]
  );
  const conv = await pool.query(
    `SELECT COUNT(*)::int AS c
       FROM public.referral_page
      WHERE referred_user_id = $1 AND is_approved = true`,
    [userId]
  );
  const rev = await pool.query(
    `SELECT COALESCE(SUM(total_business_value),0)::numeric AS s
       FROM public.referral_page
      WHERE referred_user_id = $1 AND is_approved = true`,
    [userId]
  );

  const name = [u.firstname, u.lastname].filter(Boolean).join(" ").trim();
  const dp =
    toAbs(d.profile_picture) ||
    toAbs(p.profile_image) ||
    null;

  return {
    success: true,
    userId: u.user_id,
    status: u.status,
    profile: {
      dp,
      name,
      emailId: u.email || "",
      phoneNo: u.mobile_number || "",
      district: p.district_name || (u.district_id ? String(u.district_id) : ""),
      clubName: p.club_name || u.club_name || "",
      designation: p.designation || "",
      bio: d.personal_bio || "",
    },
    business: {
      companyLogo: toAbs(d.business_logo) || null,
      businessName: d.legal_business_name || "",
      description: d.business_description || "",
      industry: d.business_industry || "",
      category: d.business_category || "",
      headquarters: d.headquarters || "",
    },
    activity: {
      referralsGiven: g.rows[0]?.c || 0,
      referralsReceived: r.rows[0]?.c || 0,
      businessConverted: conv.rows[0]?.c || 0,
      revenueGenerated: Number(rev.rows[0]?.s || 0),
    },
    social: {
      facebook: p.facebook_url || null,
      linkedIn: p.linked_in_url || null,
      website: p.website || null,
    },
  };
}

/**
 * GET /admin-api/users/fetch-user-detail?userId=123
 * Returns all data needed for the View Profile template
 */
router.get("/users/fetch-user-detail", async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const data = await buildProfile(userId);
    if (!data) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json(data);
  } catch (e) {
    console.error("fetch-user-detail error:", e && (e.stack || e));
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /admin-api/users/suspend-user
 * Body can be JSON or FormData with { userId }; sets status to SUSPENDED
 */
router.post("/users/suspend-user", upload.none(), async (req, res) => {
  try {
    let userId =
      typeof req.body === "number" ? req.body :
      typeof req.body === "string" ? parseInt(req.body, 10) :
      req.body?.userId != null     ? parseInt(req.body.userId, 10) :
      req.query?.userId != null    ? parseInt(req.query.userId, 10) :
      NaN;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Single-statement update; handles race without requiring a transaction
    const upd = await pool.query(
      `UPDATE public.users
          SET status = 'SUSPENDED'
        WHERE user_id = $1
          AND status <> 'SUSPENDED'
        RETURNING user_id, status`,
      [userId]
    );

    if (upd.rowCount === 1) {
      return res.status(200).json({ success: true, userId, status: "SUSPENDED" });
    }

    // If no row updated, check whether the user exists or is already suspended
    const chk = await pool.query(
      `SELECT status FROM public.users WHERE user_id = $1`,
      [userId]
    );
    if (chk.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (chk.rows[0].status === "SUSPENDED") {
      return res.status(409).json({ success: false, message: "Already SUSPENDED" });
    }

    return res.status(500).json({ success: false, message: "Update failed" });
  } catch (e) {
    console.error("suspend-user error:", e && (e.stack || e));
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
