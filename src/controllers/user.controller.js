import { ApiError } from "../utils/apiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// method for generating access token and refresh token....

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validationBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Failed to generate token");
    }
};

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
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // check for image and avatar, which are required in models
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // upload the image and avatar on cloudinary server....
    // code to upload image and avatar on cloudinary....

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar file is required");
    }

    // create user......
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

// user login.....

const userLogin = asyncHandler(async (req, res) => {
    // steps to follow for user login....
    // .1 req body -> data
    // .2 username or email
    // .3 find username
    //.4 password check
    // .5 generate access and refresh token for user
    // .6 send cookies

    //.get data from req.body...
    const { username, password, email } = req.body;
    if (!(username && email)) {
        throw new ApiError(400, "Username and email are required");
    }

    // find either username or email address

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // password check...

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // generate access and refresh token for user....

    const { refreshToken, accessToken } = generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // send cookies....
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "Logged in successfully"
            )
        );
});

// user logout.....

const userLogout = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined },
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// refresh access token.......

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        res.cookies.refreshToken || res.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    //verify the refresh token by jwt, which provides decoded token
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        //find the user by id
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "invalid refresh token");
        }

        // match the incoming token with users refresh token..
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true,
        };

        //generate new access token and refresh token...
        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshToken(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token");
    }
});

export { registerUser, userLogin, userLogout, refreshAccessToken };
