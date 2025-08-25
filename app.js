const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const pool = require("./db");
const axios = require("axios");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET_KEY || "supersecret";
const PORT = process.env.PORT || 7000;
const API_BASE_URL = process.env.API_BASE_URL;
const ms = require("ms");

const bcrypt = require("bcrypt");
const Jwt = require("./util/jwt");
const { authenticateToken } = require("./middleware/authJwt");
const app = express();



// app.set("trust proxy", 1);
// app.use(
//     cors({
//         origin: "https://robizadmin.netlify.app", // frontend URL
//         credentials: true, // allow cookies
//     })
// );
app.use(
    cors({
        origin: "http://localhost:5173", // frontend URL
        credentials: true, // allow cookies
    })
);
app.use(express.json());
//app.use(express.json({ limit: "2mb", strict: false })); // strict:false allows numbers/strings

app.use(cookieParser());

// app.js (add these lines)
const adminVerifyRoutes = require("./routes/admin.verify.route");
app.use("/admin-api", adminVerifyRoutes);

const adminSearchRoutes = require("./routes/admin.search.route");
app.use("/admin-api", adminSearchRoutes);

const adminProfileRoutes = require("./routes/admin.profile.route");
app.use("/admin-api", adminProfileRoutes);


app.post("/admin-api/auth/login", async (req, res) => {
    const jwtSecretKey = Jwt.jwtSecretKey;
    const jwtExpiration = Jwt.jwtExpiration;
    //const { mobile_number, password } = req.body;
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM admin WHERE mobile_number = $1 OR email_id = $1",
            [username]
        );
        if (result.rows.length === 0)
            return res
                .status(401)
                .json({ message: "Invalid mobile_number or password" });

        const admin = result.rows[0];

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch)
            return res
                .status(401)
                .json({ message: "Invalid mobile_number or password" });

        const token = jwt.sign(
            { id: admin.admin_id, mobile_number: admin.mobile_number },
            jwtSecretKey,
            { expiresIn: jwtExpiration }
        );
        /*Local environment*/
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            maxAge: ms(jwtExpiration),
        });

        /*Server environment*/
        // res.cookie("token", token, {
        //     httpOnly: true,
        //     secure: true,
        //     sameSite: "None",
        //     maxAge: 60 * 60 * 2000,
        //     domain: "dev.robiz3190.org",
        // });
        return res.status(200).json({
            success: true,
            message: "Login successful",
            // userId: user.user_id,
            firstName: admin.first_name,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

app.post("/admin-api/auth/logout", async (req, res) => {
    /*Local environment*/
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
    });
    /*Server environment*/
    // res.clearCookie("token", {
    //     httpOnly: true,
    //     secure: true,
    //     sameSite: "None",
    //     domain: "dev.robiz3190.org",
    // });
    res.status(200).json({ message: "Logged out successfully" });
});

//middleware
app.get("/admin-api/get-profile", authenticateToken, async (req, res) => {
    try {
        const adminId = req.admin.id;

        const { rows } = await pool.query(
            `SELECT first_name
       FROM admin
       WHERE admin_id = $1`,
            [adminId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Administrator not found" });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error("GET /admin-api/get-profile failed:", err);

        return res.status(500).json({
            error: "Unexpected server error. Please try again later.",
        });
    }
});

app.post("/admin-api/users/fetch-all-users", async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM users`);
        return res.json(rows);
    } catch (err) {
        console.error("POST /admin-api/fetch-all-users failed:", err);

        return res.status(500).json({
            error: "Unexpected server error. Please try again later.",
        });
    }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
