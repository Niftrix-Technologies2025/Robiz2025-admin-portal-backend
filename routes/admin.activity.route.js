// // routes/admin.activity.route.js
// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const upload = multer();
// const pool = require("../db");

// function toInt(v, def) {
//   const n = parseInt(v, 10);
//   return Number.isInteger(n) && n > 0 ? n : def;
// }

// function mapReferralRow(r, direction) {
//   const bv = r.total_business_value ?? r.value ?? r.amount;
//   return {
//     id: r.id ?? r.referral_id ?? null,
//     direction,
//     fromUserId: r.user_id ?? null,
//     toUserId: r.referred_user_id ?? null,
//     createdAt: r.created_at ?? null,
//     title: r.title ?? r.subject ?? null,
//     details: r.details ?? r.description ?? r.message ?? r.notes ?? null,
//     estimatedCompletion: r.estimated_completion ?? r.estimated_completion_date ?? null,
//     businessValue: bv != null && !Number.isNaN(Number(bv)) ? Number(bv) : null,
//     isApproved: r.is_approved != null ? Boolean(r.is_approved) : null,
//   };
// }

// function mapPremiumBanner(r) {
//   return {
//     bannerUrl: r.banner_url ?? null,
//     dates: r.dates ?? null,
//     amount: r.amount != null ? Number(r.amount) : null,
//     currency: r.currency ?? null,
//     isSuccessful: !!r.is_successful,
//     createdAt: r.created_at ?? null,
//   };
// }

// function mapPremiumSimple(r) {
//   return {
//     dates: r.dates ?? null,
//     createdAt: r.created_at ?? null,
//   };
// }

// async function fetchPremiumRowsForUser(userId) {
//   const rs = await pool.query(
//     `SELECT premium_id, user_id, dates, banner_url, amount, currency,
//             is_successful, is_premium_banner, is_trending_banner,
//             is_search_preference, is_featured_profile,
//             created_at, updated_at
//        FROM public.premium
//       WHERE user_id = $1
//       ORDER BY COALESCE(created_at, NOW()) DESC`,
//     [userId]
//   );
//   return rs.rows;
// }

// router.post("/users/activity-history", upload.none(), async (req, res) => {
//   try {
//     const userId =
//       req.body?.userId != null ? parseInt(req.body.userId, 10)
//       : req.query?.userId != null ? parseInt(req.query.userId, 10)
//       : NaN;
//     if (!Number.isInteger(userId) || userId <= 0) {
//       return res.status(400).json({ success: false, message: "Invalid userId" });
//     }

//     const pageGiven = toInt(req.body?.pageGiven, 1);
//     const limitGiven = Math.min(toInt(req.body?.limitGiven, 10), 100);
//     const offGiven = (pageGiven - 1) * limitGiven;

//     const pageReceived = toInt(req.body?.pageReceived, 1);
//     const limitReceived = Math.min(toInt(req.body?.limitReceived, 10), 100);
//     const offReceived = (pageReceived - 1) * limitReceived;

//     const pageConv = toInt(req.body?.pageConverted, 1);
//     const limitConv = Math.min(toInt(req.body?.limitConverted, 10), 100);
//     const offConv = (pageConv - 1) * limitConv;

//     const givenCount = await pool.query(
//       `SELECT COUNT(*)::int AS total FROM public.referral_page WHERE user_id = $1`,
//       [userId]
//     );
//     const totalGiven = givenCount.rows[0]?.total ?? 0;

//     const givenRows = await pool.query(
//       `SELECT * FROM public.referral_page
//        WHERE user_id = $1
//        ORDER BY COALESCE(created_at, NOW()) DESC
//        LIMIT $2 OFFSET $3`,
//       [userId, limitGiven, offGiven]
//     );
//     const referralsGiven = givenRows.rows.map((r) => mapReferralRow(r, "GIVEN"));

//     const recvCount = await pool.query(
//       `SELECT COUNT(*)::int AS total FROM public.referral_page WHERE referred_user_id = $1`,
//       [userId]
//     );
//     const totalReceived = recvCount.rows[0]?.total ?? 0;

//     const recvRows = await pool.query(
//       `SELECT * FROM public.referral_page
//        WHERE referred_user_id = $1
//        ORDER BY COALESCE(created_at, NOW()) DESC
//        LIMIT $2 OFFSET $3`,
//       [userId, limitReceived, offReceived]
//     );
//     const referralsReceived = recvRows.rows.map((r) => mapReferralRow(r, "RECEIVED"));

//     const convCount = await pool.query(
//       `SELECT COUNT(*)::int AS total
//          FROM public.referral_page
//         WHERE referred_user_id = $1 AND COALESCE(is_approved, false) = true`,
//       [userId]
//     );
//     const totalConverted = convCount.rows[0]?.total ?? 0;

//     const convSum = await pool.query(
//       `SELECT COALESCE(SUM(total_business_value),0)::numeric AS sum_value
//          FROM public.referral_page
//         WHERE referred_user_id = $1 AND COALESCE(is_approved, false) = true`,
//       [userId]
//     );
//     const totalConvertedValue = Number(convSum.rows[0]?.sum_value || 0);

//     const convRows = await pool.query(
//       `SELECT * FROM public.referral_page
//         WHERE referred_user_id = $1 AND COALESCE(is_approved, false) = true
//         ORDER BY COALESCE(created_at, NOW()) DESC
//         LIMIT $2 OFFSET $3`,
//       [userId, limitConv, offConv]
//     );
//     const referralsConverted = convRows.rows.map((r) => mapReferralRow(r, "RECEIVED"));

//     const premiumRows = await fetchPremiumRowsForUser(userId);

//     const premiumBanners = [];
//     const trendingBanners = [];
//     const featuredProfiles = [];
//     const searchPreferences = [];

//     for (const row of premiumRows) {
//       if (row.is_premium_banner) premiumBanners.push(mapPremiumBanner(row));
//       if (row.is_trending_banner) trendingBanners.push(mapPremiumBanner(row));
//       if (row.is_featured_profile) featuredProfiles.push(mapPremiumSimple(row));
//       if (row.is_search_preference) searchPreferences.push(mapPremiumSimple(row));
//     }

//     return res.status(200).json({
//       success: true,
//       userId,
//       referrals: {
//         given: { total: totalGiven, page: pageGiven, limit: limitGiven, results: referralsGiven },
//         received: { total: totalReceived, page: pageReceived, limit: limitReceived, results: referralsReceived },
//         converted: { total: totalConverted, page: pageConv, limit: limitConv, totalValue: totalConvertedValue, results: referralsConverted },
//       },
//       banners: {
//         premium: premiumBanners,
//         trending: trendingBanners,
//       },
//       featuredProfiles: {
//         total: featuredProfiles.length,
//         results: featuredProfiles,
//       },
//       searchPreferences: {
//         total: searchPreferences.length,
//         results: searchPreferences,
//       },
//     });
//   } catch (e) {
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// module.exports = router;


// routes/admin.activity.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const pool = require("../db");

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : def;
}

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

function mapPremiumBanner(r) {
  return {
    bannerUrl: r.banner_url ?? null,
    dates: r.dates ?? null,
    amount: r.amount != null ? Number(r.amount) : null,
    currency: r.currency ?? null,
    isSuccessful: !!r.is_successful,
    createdAt: r.created_at ?? null,
  };
}

function mapPremiumSimple(r) {
  return {
    dates: r.dates ?? null,
    createdAt: r.created_at ?? null,
  };
}

async function fetchPremiumRowsForUser(userId) {
  const rs = await pool.query(
    `SELECT premium_id, user_id, dates, banner_url, amount, currency,
            is_successful, is_premium_banner, is_trending_banner,
            is_search_preference, is_featured_profile,
            created_at, updated_at
       FROM public.premium
      WHERE user_id = $1
      ORDER BY COALESCE(created_at, NOW()) DESC`,
    [userId]
  );
  return rs.rows;
}

router.post("/users/activity-history", upload.none(), async (req, res) => {
  try {
    const userId =
      req.body?.userId != null ? parseInt(req.body.userId, 10)
      : req.query?.userId != null ? parseInt(req.query.userId, 10)
      : NaN;
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const pageGiven = toInt(req.body?.pageGiven, 1);
    const limitGiven = Math.min(toInt(req.body?.limitGiven, 10), 100);
    const offGiven = (pageGiven - 1) * limitGiven;

    const pageReceived = toInt(req.body?.pageReceived, 1);
    const limitReceived = Math.min(toInt(req.body?.limitReceived, 10), 100);
    const offReceived = (pageReceived - 1) * limitReceived;

    const pageConv = toInt(req.body?.pageConverted, 1);
    const limitConv = Math.min(toInt(req.body?.limitConverted, 10), 100);
    const offConv = (pageConv - 1) * limitConv;

    // ---------- Referrals GIVEN (you → someone)
    const givenCount = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.referral_page
        WHERE user_id = $1`,
      [userId]
    );
    const totalGiven = givenCount.rows[0]?.total ?? 0;

    const givenRows = await pool.query(
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
      [userId, limitGiven, offGiven]
    );

    const referralsGiven = givenRows.rows.map((r) => {
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
        toUserDecision: toDecision,               // "accepted" | "rejected" | "pending"
        yourDecision,                              // "confirm" | "cancel" | null
        yourTestimonial: r.testimonial_given_id ?? null,
      };
    });

    // ---------- Referrals RECEIVED (someone → you)
    const recvCount = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.referral_page
        WHERE referred_user_id = $1`,
      [userId]
    );
    const totalReceived = recvCount.rows[0]?.total ?? 0;

    const recvRows = await pool.query(
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
      [userId, limitReceived, offReceived]
    );

    const referralsReceived = recvRows.rows.map((r) => {
      const youDecision = decisionFromFlags(r.is_approved, r.is_rejected); // your accept/reject on received items
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
        youDecision,                                // "accepted" | "rejected" | "pending"
        fromUserDecision,                           // "confirm" | "cancel" | null
        receivedTestimonial: r.testimonial_given_id ?? null,
      };
    });

    // ---------- Referrals CONVERTED (received + approved)
    const convCount = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public.referral_page
        WHERE referred_user_id = $1
          AND COALESCE(is_approved, false) = true`,
      [userId]
    );
    const totalConverted = convCount.rows[0]?.total ?? 0;

    const convSum = await pool.query(
      `SELECT COALESCE(SUM(total_business_value),0)::numeric AS sum_value
         FROM public.referral_page
        WHERE referred_user_id = $1
          AND COALESCE(is_approved, false) = true`,
      [userId]
    );
    const totalConvertedValue = Number(convSum.rows[0]?.sum_value || 0);

    const convRows = await pool.query(
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
         AND COALESCE(is_approved, false) = true
       ORDER BY COALESCE(created_at, NOW()) DESC
       LIMIT $2 OFFSET $3`,
      [userId, limitConv, offConv]
    );

    // Keep converted shape similar to received (you can adjust if needed)
    const referralsConverted = convRows.rows.map((r) => ({
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
      youDecision: "accepted", // by definition in this list
      fromUserDecision:
        confirmCancelFromActor(r.accepted_by, r.user_id) ||
        cancelFromActor(r.rejected_by, r.user_id),
      receivedTestimonial: r.testimonial_given_id ?? null,
    }));

    // ---------- Premium/trending/featured/searchPreference (unchanged)
    const premiumRows = await fetchPremiumRowsForUser(userId);
    const premiumBanners = [];
    const trendingBanners = [];
    const featuredProfiles = [];
    const searchPreferences = [];

    for (const row of premiumRows) {
      if (row.is_premium_banner) premiumBanners.push(mapPremiumBanner(row));
      if (row.is_trending_banner) trendingBanners.push(mapPremiumBanner(row));
      if (row.is_featured_profile) featuredProfiles.push(mapPremiumSimple(row));
      if (row.is_search_preference) searchPreferences.push(mapPremiumSimple(row));
    }

    return res.status(200).json({
      success: true,
      userId,
      referrals: {
        given: {
          total: totalGiven,
          page: pageGiven,
          limit: limitGiven,
          results: referralsGiven,
        },
        received: {
          total: totalReceived,
          page: pageReceived,
          limit: limitReceived,
          results: referralsReceived,
        },
        converted: {
          total: totalConverted,
          page: pageConv,
          limit: limitConv,
          totalValue: totalConvertedValue,
          results: referralsConverted,
        },
      },
      banners: {
        premium: premiumBanners,
        trending: trendingBanners,
      },
      featuredProfiles: {
        total: featuredProfiles.length,
        results: featuredProfiles,
      },
      searchPreferences: {
        total: searchPreferences.length,
        results: searchPreferences,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
