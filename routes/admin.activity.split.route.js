
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const pool = require("../db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : def;
}

//
// ------- Premium / Banners / Profiles / Search Preference -------
//

function mapPremiumBannerRow(r) {
  return {
    premiumId: r.premium_id ?? null,
    userId: r.user_id ?? null,
    bannerImageUrl: r.banner_url ?? null,
    dates: r.dates ?? null,
    amount: r.amount != null ? Number(r.amount) : null,
    currency: r.currency ?? null,
    isSuccessful: !!r.is_successful,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
    orderId: r.order_id ?? null,
  };
}
function mapTrendingBannerRow(r) {
  return {
    premiumId: r.premium_id ?? null,
    userId: r.user_id ?? null,
    bannerImageUrl: r.banner_url ?? null,
    dates: r.dates ?? null,
    amount: r.amount != null ? Number(r.amount) : null,
    currency: r.currency ?? null,
    isSuccessful: !!r.is_successful,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
    orderId: r.order_id ?? null,
    trendingBannerSlotNo: r.trending_banner_slot_no != null ? Number(r.trending_banner_slot_no) : null,
  };
}
function mapSimplePremiumRow(r) {
  return {
    premiumId: r.premium_id ?? null,
    userId: r.user_id ?? null,
    dates: r.dates ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

router.post("/users/premium-banner-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_premium_banner,false) = true`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT premium_id, user_id, dates, amount, currency, is_successful,
              created_at, updated_at, banner_url, order_id
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_premium_banner,false) = true
        ORDER BY created_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results: dataRs.rows.map(mapPremiumBannerRow),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users/trending-banner-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_trending_banner,false) = true`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT premium_id, user_id, dates, amount, currency, is_successful,
              created_at, updated_at, banner_url, order_id, trending_banner_slot_no
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_trending_banner,false) = true
        ORDER BY created_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results: dataRs.rows.map(mapTrendingBannerRow),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users/featured-profile-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_featured_profile,false) = true`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT premium_id, user_id, dates, created_at, updated_at
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_featured_profile,false) = true
        ORDER BY created_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results: dataRs.rows.map(mapSimplePremiumRow),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users/search-preference-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_search_preference,false) = true`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT premium_id, user_id, dates, created_at, updated_at
         FROM public.premium
        WHERE user_id = $1 AND COALESCE(is_search_preference,false) = true
        ORDER BY created_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results: dataRs.rows.map(mapSimplePremiumRow),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

//
// -------------------------- Referrals --------------------------
// table: public.referral_page
//

function decisionFromFlags(isApproved, isRejected) {
  if (isApproved) return "accepted";
  if (isRejected) return "rejected";
  return "pending";
}
function confirmCancelFromActor(actorId, expectedId) {
  if (actorId == null) return null;
  return String(actorId) === String(expectedId) ? "confirm" : null;
}
function cancelFromActor(actorId, expectedId) {
  if (actorId == null) return null;
  return String(actorId) === String(expectedId) ? "cancel" : null;
}

// Given: you -> someone
router.post("/users/referrals-given-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.referral_page
        WHERE user_id = $1`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT
         referral_id,
         referred_user_id,
         referred_username,
         referral_type,
         referral_title,
         referral_description,
         referred_mobile_number,
         referred_whatsapp,
         urgency,
         estimated_completion_date,
         total_business_value,
         is_approved,
         is_rejected,
         accepted_by,
         rejected_by,
         testimonial_given_id,
         created_at
       FROM public.referral_page
       WHERE user_id = $1
       ORDER BY COALESCE(created_at, NOW()) DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const results = dataRs.rows.map((r) => {
      const toDecision = decisionFromFlags(r.is_approved, r.is_rejected);
      const youConfirm = confirmCancelFromActor(r.accepted_by, userId);
      const youCancel  = cancelFromActor(r.rejected_by, userId);
      const yourDecision = youConfirm || youCancel; // "confirm" | "cancel" | null

      return {
        id: r.referral_id ?? null,
        toUserId: r.referred_user_id ?? null,
        toUsername: r.referred_username ?? null,
        type: r.referral_type ?? null,
        title: r.referral_title ?? null,
        description: r.referral_description ?? null,
        phoneNumber: r.referred_mobile_number ?? null,
        whatsappNumber: r.referred_whatsapp ?? null,
        urgency: r.urgency ?? null,
        completionDate: r.estimated_completion_date ?? null,
        businessValue: r.total_business_value != null ? Number(r.total_business_value) : null,
        toUserDecision: toDecision,     // "accepted" | "rejected" | "pending"
        yourDecision,                   // "confirm" | "cancel" | null
        yourTestimonial: r.testimonial_given_id ?? null,
        createdAt: r.created_at ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Received: someone -> you
router.post("/users/referrals-received-activity", upload.none(), async (req, res) => {
  try {
    const userId = parseInt(req.body?.userId, 10);
    const page = toInt(req.body?.page, 1);
    const limit = Math.min(toInt(req.body?.limit, 10), 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const offset = (page - 1) * limit;

    const countRs = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.referral_page
        WHERE referred_user_id = $1`,
      [userId]
    );
    const total = countRs.rows[0]?.total ?? 0;

    const dataRs = await pool.query(
      `SELECT
         referral_id,
         user_id,
         username,
         referral_type,
         referral_title,
         referral_description,
         mobile_number,
         whatsapp_number,
         urgency,
         estimated_completion_date,
         total_business_value,
         is_approved,
         is_rejected,
         accepted_by,
         rejected_by,
         testimonial_given_id,
         created_at
       FROM public.referral_page
       WHERE referred_user_id = $1
       ORDER BY COALESCE(created_at, NOW()) DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const results = dataRs.rows.map((r) => {
      const youDecision = decisionFromFlags(r.is_approved, r.is_rejected);
      const fromConfirm = confirmCancelFromActor(r.accepted_by, r.user_id);
      const fromCancel  = cancelFromActor(r.rejected_by, r.user_id);
      const fromUserDecision = fromConfirm || fromCancel; // "confirm" | "cancel" | null

      return {
        id: r.referral_id ?? null,
        fromUserId: r.user_id ?? null,
        fromUsername: r.username ?? null,
        type: r.referral_type ?? null,
        title: r.referral_title ?? null,
        description: r.referral_description ?? null,
        phoneNumber: r.mobile_number ?? null,
        whatsappNumber: r.whatsapp_number ?? null,
        urgency: r.urgency ?? null,
        completionDate: r.estimated_completion_date ?? null,
        businessValue: r.total_business_value != null ? Number(r.total_business_value) : null,
        youDecision,                     // "accepted" | "rejected" | "pending"
        fromUserDecision,                // "confirm" | "cancel" | null
        receivedTestimonial: r.testimonial_given_id ?? null,
        createdAt: r.created_at ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      results,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
