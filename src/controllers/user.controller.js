import { ApiError } from "../utils/apiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// user registration.....

const registerUser = asyncHandler(async (req, res) => {
    //steps to follow for user registration....
    // 1. Get user data from frontend.
    // 2.validation, in case wrong user information or empty string.
    // 3. check if user already exists in the database. username and email.
    // 4. check for image and avatar, which are required in models
    // 5. upload the image and avatar on cloudinary server.
    // 6. create user object to send to mongodb.
    // 7.remove password and refresh token field from response.
    // 8. check user creation
    // 9. send the response to frontend.

    const { fullname, email, password, username } = req.body;
    console.log("email: ", email);

    // validation check........
    if (
        [username, password, email, fullname].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }
    // check if user already exists in the database....
    const existedUser = User.findOne({
        $or: [{ username }, { email }],
    });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // check for image and avatar, which are required in models
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    // upload the image and avatar on cloudinary server....
    // code to upload image and avatar on cloudinary....

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar is required");
    }

    // create user........

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || " ",
        email,
        username: username.toLowerCase,
        password,
    });

    // remove password and refresh token field from response....

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // check user creation....

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    // send the response to frontend....

    res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );
});

export { registerUser };
