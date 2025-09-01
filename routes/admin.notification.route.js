const express = require("express");
const router = express.Router();
const multer = require("multer");
const nodemailer = require("nodemailer");
const pool = require("../db");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
});

const TYPE_MAP = {
    all: null,
    verified: "ACTIVE",
    unverified: "NEW",
    suspended: "SUSPENDED",
};

async function makeTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_PORT || "") === "465";

    if (host && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.verify();
        return {
            transporter,
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            test: false,
        };
    }

    const testAcc = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
        host: testAcc.smtp.host,
        port: testAcc.smtp.port,
        secure: testAcc.smtp.secure,
        auth: { user: testAcc.user, pass: testAcc.pass },
    });
    await transporter.verify();
    return { transporter, from: testAcc.user, test: true };
}

router.post(
    "/users/send-notification",
    upload.array("attachments"),
    async (req, res) => {
        try {
            const message = (req.body?.message || "").trim();
            const recipientType = (req.body?.recipientType || "")
                .trim()
                .toLowerCase();

            if (!message) {
                return res
                    .status(400)
                    .json({ success: false, message: "message is required" });
            }
            if (!Object.keys(TYPE_MAP).includes(recipientType)) {
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid recipientType" });
            }

            const status = TYPE_MAP[recipientType];

            let sql = `SELECT user_id, email, firstname, lastname
                   FROM public.users
                  WHERE email IS NOT NULL`;
            const params = [];
            if (status) {
                sql += ` AND status = $1`;
                params.push(status);
            }
            sql += ` ORDER BY user_id ASC`;

            const { rows } = await pool.query(sql, params);
            const recipients = rows.filter((r) => r.email);

            if (recipients.length === 0) {
                return res.status(200).json({
                    success: true,
                    totalRecipients: 0,
                    attempted: 0,
                    sent: 0,
                    failed: 0,
                    previewUrls: [],
                });
            }

            const { transporter, from, test } = await makeTransporter();

            const files = Array.isArray(req.files) ? req.files : [];
            const mailAttachments = files.map((f) => ({
                filename: f.originalname,
                content: f.buffer,
                contentType: f.mimetype,
            }));

            let sent = 0;
            let failed = 0;
            const errors = [];
            const previewUrls = [];

            // Safety cap to avoid extremely long requests
            const MAX_SEND = Number(process.env.NOTIFY_MAX || 500);
            const slice = recipients.slice(0, MAX_SEND);

            for (const r of slice) {
                const name = [r.firstname, r.lastname]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                try {
                    const info = await transporter.sendMail({
                        from,
                        to: r.email,
                        subject: "Notification",
                        text: message,
                        html: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
                        attachments: mailAttachments,
                    });
                    sent += 1;
                    if (test && previewUrls.length < 20) {
                        const url = nodemailer.getTestMessageUrl(info);
                        if (url)
                            previewUrls.push({
                                userId: r.user_id,
                                email: r.email,
                                previewUrl: url,
                            });
                    }
                } catch (e) {
                    failed += 1;
                    if (errors.length < 20) {
                        errors.push({
                            userId: r.user_id,
                            email: r.email,
                            error: e.message || "send failed",
                        });
                    }
                }
            }

            const attempted = slice.length;
            const truncated = recipients.length > attempted;

            return res.status(200).json({
                success: true,
                recipientType,
                totalRecipients: recipients.length,
                attempted,
                sent,
                failed,
                truncated, // true if limited by MAX_SEND
                previewUrls: test ? previewUrls : [],
                errors, // capped list
            });
        } catch (e) {
            return res
                .status(500)
                .json({ success: false, message: "Server error" });
        }
    }
);

module.exports = router;
