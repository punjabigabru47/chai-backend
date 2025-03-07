import { asyncHandler } from "../utils/asyncHandler.js";

// user registration.....

const registerUser = asyncHandler(async (req, res) => {
    return res.status(200).json({
        message: "well registered",
    });
});

export { registerUser };
