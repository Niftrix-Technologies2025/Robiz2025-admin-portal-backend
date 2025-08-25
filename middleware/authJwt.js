const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET_KEY || "supersecret";

function authenticateToken(req, res, next) {
    const token = req.cookies.token; // Read from cookie
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, admin) => {
        if (err) return res.sendStatus(403);
        req.admin = admin;
        next();
    });
}
module.exports = {
    authenticateToken: authenticateToken,
};
