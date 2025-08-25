const jwt = {
    // jwtSecretKey: crypto.randomBytes(32).toString("hex"),
    jwtSecretKey: process.env.JWT_SECRET_KEY,
    jwtExpiration: "6h",
};

(module.exports = jwt);