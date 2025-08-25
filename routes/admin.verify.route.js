// const express = require("express");
// const router = express.Router();
// const nodemailer = require("nodemailer");
// const pool = require("../db");

// async function makeTransporter() {
//   if (process.env.EMAIL_MODE === "test" || !process.env.SMTP_HOST) {
//     const testAcc = await nodemailer.createTestAccount();
//     return {
//       transporter: nodemailer.createTransport({
//         host: testAcc.smtp.host,
//         port: testAcc.smtp.port,
//         secure: testAcc.smtp.secure,
//         auth: { user: testAcc.user, pass: testAcc.pass },
//       }),
//       from: testAcc.user,
//       test: true,
//     };
//   }
//   return {
//     transporter: nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: Number(process.env.SMTP_PORT || 587),
//       secure: String(process.env.SMTP_PORT || "") === "465",
//       auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
//     }),
//     from: process.env.MAIL_FROM || process.env.SMTP_USER,
//     test: false,
//   };
// }

// async function sendWelcomeEmail(to, name) {
//   const { transporter, from, test } = await makeTransporter();
//   const info = await transporter.sendMail({
//     from,
//     to,
//     subject: "Welcome",
//     html: `<p>Hi ${name || ""},</p><p>Your account is now active.</p>`,
//   });
//   return test ? (nodemailer.getTestMessageUrl(info) || null) : null;
// }

// router.post("/users/set-user-verified", async (req, res) => {
//   try {
//     const body = req.body;
//     const userId =
//       typeof body === "number"
//         ? body
//         : typeof body === "string"
//         ? parseInt(body, 10)
//         : body && body.userId
//         ? parseInt(body.userId, 10)
//         : NaN;

//     if (!Number.isInteger(userId) || userId <= 0) {
//       return res.status(400).json({ success: false, message: "Invalid userId" });
//     }

//     const upd = await pool.query(
//       `UPDATE public.users
//          SET status = 'ACTIVE'
//        WHERE user_id = $1 AND status = 'NEW'
//        RETURNING user_id, email, firstname, lastname`,
//       [userId]
//     );

//     if (upd.rowCount === 0) {
//       const check = await pool.query(
//         "SELECT status FROM public.users WHERE user_id = $1",
//         [userId]
//       );
//       if (check.rowCount === 0) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }
//       if (check.rows[0].status === "ACTIVE") {
//         return res.status(400).json({ success: false, message: "Already ACTIVE" });
//       }
//       return res.status(400).json({ success: false, message: "Only NEW users can be verified" });
//     }

//     const row = upd.rows[0];
//     try {
//       const previewUrl = await sendWelcomeEmail(
//         row.email,
//         [row.firstname, row.lastname].filter(Boolean).join(" ")
//       );
//       return res.status(200).json({
//         success: true,
//         userId: row.user_id,
//         status: "ACTIVE",
//         previewUrl,
//       });
//     } catch {
//       return res.status(500).json({ success: false, message: "Email failed" });
//     }
//   } catch {
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const pool = require("../db");

async function makeTransporter() {
  if (process.env.EMAIL_MODE === "test" || !process.env.SMTP_HOST) {
    const testAcc = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: testAcc.smtp.host,
        port: testAcc.smtp.port,
        secure: testAcc.smtp.secure,
        auth: { user: testAcc.user, pass: testAcc.pass },
      }),
      from: testAcc.user,
      test: true,
    };
  }
  return {
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT || "") === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    }),
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    test: false,
  };
}

async function sendWelcomeEmail(to, name) {
  const { transporter, from, test } = await makeTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject: "Welcome",
    html: `<p>Hi ${name || ""},</p><p>Your account is now active.</p>`,
  });
  return test ? (nodemailer.getTestMessageUrl(info) || null) : null;
}

router.post("/users/set-user-verified", async (req, res) => {
  const body = req.body;
  const userId =
    typeof body === "number"
      ? body
      : typeof body === "string"
      ? parseInt(body, 10)
      : body && body.userId
      ? parseInt(body.userId, 10)
      : NaN;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid userId" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sel = await client.query(
      `SELECT user_id, email, firstname, lastname, status
         FROM public.users
        WHERE user_id = $1
        FOR UPDATE`,
      [userId]
    );

    if (sel.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const u = sel.rows[0];
    if (u.status === "ACTIVE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Already ACTIVE" });
    }
    if (u.status !== "NEW") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Only NEW users can be verified" });
    }

    await client.query(
      `UPDATE public.users
          SET status = 'ACTIVE'
        WHERE user_id = $1`,
      [userId]
    );

    let previewUrl = null;
    try {
      const name = [u.firstname, u.lastname].filter(Boolean).join(" ");
      previewUrl = await sendWelcomeEmail(u.email, name);
    } catch (e) {
      await client.query("ROLLBACK");
      return res.status(500).json({ success: false, message: "Email failed" });
    }

    await client.query("COMMIT");
    return res.status(200).json({
      success: true,
      userId: u.user_id,
      status: "ACTIVE",
      previewUrl,
    });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
