exports.web_logout = (req, res) => {
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
};
