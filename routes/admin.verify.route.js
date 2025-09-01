// async function makeTransporter() {
//     if (process.env.EMAIL_MODE === "test" || !process.env.SMTP_HOST) {
//         const testAcc = await nodemailer.createTestAccount();
//         return {
//             transporter: nodemailer.createTransport({
//                 host: testAcc.smtp.host,
//                 port: testAcc.smtp.port,
//                 secure: testAcc.smtp.secure,
//                 auth: { user: testAcc.user, pass: testAcc.pass },
//             }),
//             from: testAcc.user,
//             test: true,
//         };
//     }
//     return {
//         transporter: nodemailer.createTransport({
//             host: process.env.SMTP_HOST,
//             port: Number(process.env.SMTP_PORT || 587),
//             secure: String(process.env.SMTP_PORT || "") === "465",
//             auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
//         }),
//         from: process.env.MAIL_FROM || process.env.SMTP_USER,
//         test: false,
//     };
// }

// async function sendWelcomeEmail(to, name) {
//     const { transporter, from, test } = await makeTransporter();
//     const info = await transporter.sendMail({
//         from,
//         to,
//         subject: "Welcome",
//         html: `<p>Hi ${name || ""},</p><p>Your account is now active.</p>`,
//     });
//     return test ? nodemailer.getTestMessageUrl(info) || null : null;
// }

// router.post("/users/set-user-verified", async (req, res) => {
//     const body = req.body;
//     const userId =
//         typeof body === "number"
//             ? body
//             : typeof body === "string"
//             ? parseInt(body, 10)
//             : body && body.userId
//             ? parseInt(body.userId, 10)
//             : NaN;

//     if (!Number.isInteger(userId) || userId <= 0) {
//         return res
//             .status(400)
//             .json({ success: false, message: "Invalid userId" });
//     }

//     const client = await pool.connect();
//     try {
//         await client.query("BEGIN");

//         const sel = await client.query(
//             `SELECT user_id, email, firstname, lastname, status
//          FROM public.users
//         WHERE user_id = $1
//         FOR UPDATE`,
//             [userId]
//         );

//         if (sel.rowCount === 0) {
//             await client.query("ROLLBACK");
//             return res
//                 .status(404)
//                 .json({ success: false, message: "User not found" });
//         }

//         const u = sel.rows[0];
//         if (u.status === "ACTIVE") {
//             await client.query("ROLLBACK");
//             return res
//                 .status(400)
//                 .json({ success: false, message: "Already ACTIVE" });
//         }
//         if (u.status !== "NEW") {
//             await client.query("ROLLBACK");
//             return res.status(400).json({
//                 success: false,
//                 message: "Only NEW users can be verified",
//             });
//         }

//         await client.query(
//             `UPDATE public.users
//           SET status = 'ACTIVE'
//         WHERE user_id = $1`,
//             [userId]
//         );

//         let previewUrl = null;
//         try {
//             const name = [u.firstname, u.lastname].filter(Boolean).join(" ");
//             previewUrl = await sendWelcomeEmail(u.email, name);
//         } catch (e) {
//             await client.query("ROLLBACK");
//             return res
//                 .status(500)
//                 .json({ success: false, message: "Email failed" });
//         }

//         await client.query("COMMIT");
//         return res.status(200).json({
//             success: true,
//             userId: u.user_id,
//             status: "ACTIVE",
//             previewUrl,
//         });
//     } catch (e) {
//         try {
//             await client.query("ROLLBACK");
//         } catch {}
//         return res
//             .status(500)
//             .json({ success: false, message: "Server error" });
//     } finally {
//         client.release();
//     }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const pool = require("../db");
const nodemailer = require("nodemailer");

async function makeTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_PORT || "") === "465";
  if (host && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.verify();
    return { transporter, from: process.env.MAIL_FROM || "admin@niftrix.com", test: false };
  }
  const testAcc = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAcc.smtp.host,
    port: testAcc.smtp.port,
    secure: testAcc.smtp.secure,
    auth: { user: testAcc.user, pass: testAcc.pass },
  });
  await transporter.verify();
  return { transporter, from: "admin@niftrix.com", test: true };
}

function renderEmail(firstname, lastname) {
  const full = [firstname, lastname].filter(Boolean).join(" ");
  const greeting = full ? `Dear ${full},` : "Dear User,";
  const text =
`${greeting}

We are excited to inform you that your Robiz3190 account has been successfully verified! You can now enjoy all the features of the Robiz3190 app and start connecting with fellow Rotarians and Rotaractors for amazing business opportunities.

We wish you the best in your networking journey. If you have any questions or need assistance, feel free to reach out to our support team at support@niftrix.com.

Happy Networking!

Best Regards,
Robiz3190 - Admin Team
https://robiz3190.com`;

  const html =
`<p>${greeting}</p>
<p>We are excited to inform you that your <strong>Robiz3190</strong> account has been successfully verified! You can now enjoy all the features of the Robiz3190 app and start connecting with fellow Rotarians and Rotaractors for amazing business opportunities.</p>
<p>We wish you the best in your networking journey. If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:support@niftrix.com">support@niftrix.com</a>.</p>
<p>Happy Networking!</p>
<p>Best Regards,<br/>
Robiz3190 - Admin Team<br/>
<a href="https://robiz3190.com">https://robiz3190.com</a></p>`;
  return { text, html, subject: "Congratulations! Your Robiz3190 Account is Verified! 🎉" };
}

router.post("/users/set-user-verified", upload.none(), async (req, res) => {
  try {
    let userId =
      typeof req.body === "number" ? req.body :
      typeof req.body === "string" ? parseInt(req.body, 10) :
      req.body?.userId != null ? parseInt(req.body.userId, 10) :
      req.body?.params?.userId != null ? parseInt(req.body.params.userId, 10) :
      req.query?.userId != null ? parseInt(req.query.userId, 10) :
      NaN;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const sel = await pool.query(
      `SELECT user_id, email, firstname, lastname, status FROM public.users WHERE user_id = $1`,
      [userId]
    );
    if (sel.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const user = sel.rows[0];

    if (user.status !== "NEW") {
      return res.status(409).json({ success: false, message: "Only NEW users can be verified" });
    }

    const upd = await pool.query(
      `UPDATE public.users SET status = 'ACTIVE' WHERE user_id = $1 RETURNING status`,
      [userId]
    );
    if (upd.rowCount === 0) {
      return res.status(500).json({ success: false, message: "Update failed" });
    }

    let emailSent = false;
    let previewUrl = null;

    if (user.email) {
      const { transporter, from, test } = await makeTransporter();
      const { subject, text, html } = renderEmail(user.firstname, user.lastname);
      const info = await transporter.sendMail({
        from,
        to: user.email,
        //bcc: ["govind@niftrix.com", "malar@niftrix.com"],
        subject,
        text,
        html,
      });
      emailSent = true;
      if (test) {
        const url = nodemailer.getTestMessageUrl(info);
        if (url) previewUrl = url;
      }
    }

    return res.status(200).json({
      success: true,
      userId,
      status: "ACTIVE",
      emailSent,
      previewUrl,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
