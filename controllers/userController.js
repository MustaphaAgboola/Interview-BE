const asynchandler = require("express-async-handler");
const User = require("../models/userModel");
const DAstatus = require("../models/dAssignmentStatus");
const Token = require("../models/tokenModel");
const subDialogue = require("../models/subDialogueModel");
const Oratory = require("../models/oratoryModel");
const userTask = require("../models/userTaskModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { respondsSender } = require("../middleWare/respondsHandler");
const { ResponseCode } = require("../utils/responseCode");
const dotenv = require("dotenv").config();
const { frontEndUrl } = require("../utils/frontEndUrl");

const generateToken = (id) => {
  const timestamp = Date.now();
  const expirationTime = 6 * 60 * 1000; // 6 minutes in milliseconds
  const expirationDate = timestamp + expirationTime;
  const token = jwt.sign({ id, exp: expirationDate }, process.env.JWT_SECRET);
  return token;
};

//kindly ignore but don't delete
function generateRandomString(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

// Register user
const registerUser = asynchandler(async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      gender,
      dateOfBirth,
      accent,
      //   tribe,
      //   ethnicity,
      consent,
      password,
    } = req.body;

    // Validation Check
    if (
      !firstname ||
      !lastname ||
      !email ||
      !gender ||
      !dateOfBirth ||
      !accent ||
      //   !tribe ||
      //   !ethnicity ||
      !consent ||
      !password
    ) {
      respondsSender(
        null,
        "Please fill in all required fields",
        ResponseCode.badRequest,
        res
      );
    }
    if (password.length < 6) {
      respondsSender(
        null,
        "Password must be at least 6 characters",
        ResponseCode.badRequest,
        res
      );
    }
    const lowerEmail = email.toLowerCase();

    // Validation check if user email already exists
    const userExists = await User.findOne({ email: lowerEmail });
    if (userExists) {
      respondsSender(
        null,
        "User already registered",
        ResponseCode.dataDuplication,
        res
      );
    }

    // Add user info to the database
    const user = await User.create({
      firstname,
      lastname,
      email: lowerEmail,
      gender,
      dateOfBirth,
      accent,
      //   tribe,
      //   ethnicity,
      consent,
      password,
      verified: false,
    });

    // User was successfully created, perform your desired action here
    const randomText = generateRandomString(12);

    // Construct Reset URL
    const environment = process.env.ENVIRONMENT;
    const verifyUrl = `${frontEndUrl[environment]}verify?userid=${user._id}&&awarrillmNOW=${randomText}`;

    // Reset Email.
    const message = `
        <h2> Hello ${user.firstname},</h2>
        <p> Please use the URL below to verify your registration </p>
        <a href=${verifyUrl} clicktracking="off">${verifyUrl}</a>
        <p> Regards ... </p>
        <p>Awarri LLM team. </p>`;

    const subject = "Verify Registration Request";
    const send_to = user.email;
    const sent_from = process.env.EMAIL_USER;

    // Send the verification email
    await sendEmail(subject, message, send_to, sent_from);
    console.log(verifyUrl);
    const response = {
      message: "Verification Email Sent",
      url: verifyUrl,
      mail: message,
    };

    //res.status(200).json(response);
    respondsSender(response, "successful", ResponseCode.successful, res);
  } catch (error) {
    // Handle any errors that occurred during user registration
    console.error("Error registering user:", error);
    respondsSender(
      data,
      "Registration Failed" + error.message,
      ResponseCode.internalServerError,
      res
    );
  }
});

// Verify User Registration
const verifyUser = asynchandler(async (req, res) => {
  const { id } = req.params;
  //check if User exist
  const user = await User.findOne({ _id: id });
  if (!user) {
    respondsSender(
      null,
      "User not Found Please Sign-up",
      ResponseCode.noData,
      res
    );
  }
  // check if user already verified
  if (user.verified == true) {
    respondsSender(
      null,
      "User Already Verified,  please Login",
      ResponseCode.dataDuplication,
      res
    );
  } else {
    // set Verification to true
    user.verified = true;
    await user.save();
    respondsSender(
      null,
      "User Successfully Verified",
      ResponseCode.successful,
      res
    );
  }
});

// Function that assigns Dialogue Tasks
const dialogueAssigner = async (numToAssign, user) => {
  try {
    // Retrieve all subDialogues from the database where assignmentStatus is false
    const allSubDialogues = await subDialogue
      .find({ assignmentStatus: false })
      .limit(numToAssign * 2);

    //check number of retrieved subDialogu
    const numOfAllSubDialog = allSubDialogues.length;
    // Initialize an array to store the selected subDialogues
    const selectedSubDialogues = [];

    //share dialogue evenly if all dialogus is more than what is to be share else dont evenly share
    if (numOfAllSubDialog > numToAssign) {
      for (let i = 1; i <= allSubDialogues.length; i += 2) {
        selectedSubDialogues.push(allSubDialogues[i]);
      }
    } else {
      for (let i = 1; i <= allSubDialogues.length; i++) {
        selectedSubDialogues.push(allSubDialogues[i]);
      }
      g;
    }

    // Initialize a variable to keep track of the alternating assignment status
    let assign = true;

    // Iterate over the selected subDialogues
    for (let i = 0; i < selectedSubDialogues.length; i++) {
      const subDialogueItem = selectedSubDialogues[i];

      // Create a new user task
      const newUserTask = new userTask({
        taskStatus: "Undone",
        subDialogueId: subDialogueItem._id,
        userId: user._id, // Replace with the actual user ID
        type: "dialogue",
      });

      // Assign task or skip based on the alternating assign status
      if (assign) {
        await newUserTask.save();
        // Update the assignmentStatus of the subDialogueItem
        await subDialogue.findByIdAndUpdate(subDialogueItem._id, {
          assignmentStatus: true,
        });
      }
    }

    //check if user id exits in dialogue task table and assigned a task, if not insert or update user task status true
    const existingTask = await DAstatus.findOne({ userId: user._id });
    if (existingTask) {
      // If the user already has a task assigned, update its status to true
      existingTask.status = true;
      existingTask.taskType = "Dialogue";
      await existingTask.save();
    } else {
      // If the user does not have a task assigned, insert a new document
      const newTask = new DAstatus({
        userId: user._id,
        status: true,
        taskType: "Dialogue",
      });
      await newTask.save();
    }

    // respondsSender(selectedSubDialogues, "User tasks created successfully!", ResponseCode.successful, res);
  } catch (error) {
    // respondsSender(error, "Error creating user tasks", ResponseCode.internalServerError, res);
  }
};

//Function that assigns oratory task
const oratoryAssigner = async (numToAssign, user) => {
  console.log("user has completed the previous task i should assign oratory");
  try {
    // Retrieve all subDialogues from the database where assignmentStatus is false
    const allOratory = await Oratory.find({ assignmentStatus: false }).limit(
      numToAssign
    );

    //check number of retrieved subDialogues
    const numOfAllOratory = allOratory.length;

    // Iterate over the selected subDialogues
    for (let i = 0; i < numOfAllOratory; i++) {
      const oratoryItem = allOratory[i];

      // Create a new user task
      const newUserTask = new userTask({
        taskStatus: "Undone",
        oratoryId: oratoryItem._id,
        userId: user._id,
        type: "Oratory",
      });

      console.log();

      try {
        // Attempt to save the new user task
        const savedUserTask = await newUserTask.save();
        // If the save operation succeeds, `savedUserTask` will contain the saved document
        console.log("User task saved successfully:", savedUserTask);

        // Update the assignmentStatus of the subDialogueItem
        await Oratory.findByIdAndUpdate(oratoryItem._id, {
          assignmentStatus: true,
        });
      } catch (error) {
        // If an error occurs during the save operation, it will be caught here
        console.error("Error saving user task:", error);
      }
    }

    //check if user id exits in dialogue task table and assigned a task, if not insert or update user task status true
    const existingTask = await DAstatus.findOne({ userId: user._id });
    if (existingTask) {
      // If the user already has a task assigned, update its status to true
      existingTask.status = true;
      existingTask.taskType = "Oratory";
      await existingTask.save();
    } else {
      // If the user does not have a task assigned, insert a new document
      const newTask = new DAstatus({
        userId: user._id,
        status: true,
        taskType: "Oratory",
      });
      await newTask.save();
    }
    console.log("everything checked out fine");
    // respondsSender(selectedSubDialogues, "User tasks created successfully!", ResponseCode.successful, res);
  } catch (error) {
    // respondsSender(error, "Error creating user tasks", ResponseCode.internalServerError, res);
  }
};

//Login user
const loginUser = asynchandler(async (req, res) => {
  const { email, password } = req.body;

  //validate Request
  if (!email || !password) {
    respondsSender(
      null,
      "Please Add Email and password",
      ResponseCode.badRequest,
      res
    );
  }
  const lowerEmail = email.toLowerCase();
  //Check if user Exists
  const user = await User.findOne({ email: lowerEmail });
  if (!user) {
    respondsSender(
      null,
      "User not Found Please Sign-up",
      ResponseCode.noData,
      res
    );
  }

  // User exists, check if password is correct
  const passwordIsCorrect = await bcrypt.compare(password, user.password);

  if (user && passwordIsCorrect) {
    if (user.verified == true) {
      //Generate Login Token
      const token = generateToken(user._id);

      //delete all user previous token
      const deletionResult = await Token.deleteMany({ userId: user._id });

      //save token to token db
      const savedToken = await Token.create({
        userId: user._id,
        token,
      });

      const data = {
        userInfo: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          accent: user.accent,
          //   tribe: user.tribe,
          //   ethnicity: user.ethnicity,
        },
        token: token,
      };

      // Check Tasks
      const foundDaStatus = await DAstatus.findOne({
        userId: user._id,
        status: true,
      });

      const numToAssign = 10;
      if (!foundDaStatus) {
        // Assign Dialogue Tasks
        dialogueAssigner(numToAssign, user);
        oratoryAssigner(numToAssign, user);
        // oratoryAssigner(numToAssign, user);
      } else {
        // check if user has finished task assigned to them, and assign new task
        //fecth user task where status is undone,
        
        try {
          // Query userTasks to find undone tasks for the user
          const userTasks = await userTask.find({
            userId: user._id,
            taskStatus: "Undone",
          }); // Assuming taskStatus field indicates the status of the task

          // If there are no undone tasks found for the user, return an appropriate response
          if (userTasks.length === 0) {
            //check the last assigned task and assign new task (dialog or oratory)
            if (foundDaStatus.taskType == "Oratory") {
              //assign subdialogs
              dialogueAssigner(numToAssign, user);
            } else {
              //assign oratory
              // oratoryAssigner(numToAssign, user);
            }
          }
        } catch (error) {
          // Handle errors
          console.error("Error fetching user tasks:", error);

          respondsSender(
            error.message,
            null,
            ResponseCode.internalServerError,
            res
          ); // Pass internal server error status code
        }
      }

      respondsSender(data, "Login successful", ResponseCode.successful, res);
    } else {
      //password and email is right but user is not verified resend verification mail

      respondsSender(
        null,
        "Please verify your email",
        ResponseCode.noData,
        res
      );
    }
  } else {
    respondsSender(null, "Invalid email or Password", ResponseCode.noData, res);
  }
});

//Logout User
const logout = asynchandler(async (req, res) => {
  //delete all token related to a user from db

  if (!req.body._id) {
    respondsSender(null, "No user id Passed", ResponseCode.badRequest, res);
  }
  try {
    // Assuming the field name in your Token model is 'userId'
    const result = await Token.deleteMany({ userId: req.body._id });

    if (result.deletedCount > 0) {
      //token deleted from db
      //clear token saved in server cookies
      res.cookie("token", "", {
        path: "/",
        httpOnly: true,
        expires: new Date(0),
        sameSite: "none",
        secure: true,
      });
      respondsSender(
        null,
        "Successfully Logged out",
        ResponseCode.successful,
        res
      );
    } else {
      //clear token saved in server cookies
      res.cookie("token", "", {
        path: "/",
        httpOnly: true,
        expires: new Date(0),
        sameSite: "none",
        secure: true,
      });
      respondsSender(
        null,
        "User was not logged in, all token linked to user cleared anyway",
        ResponseCode.successful,
        res
      );
    }
  } catch (error) {
    respondsSender(
      null,
      `Error deleting tokens:  ${error.message}`,
      ResponseCode.internalServerError,
      res
    );
  }
});

//Get User Profile data
const getUser = asynchandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (user) {
    userInfo = {
      _id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      accent: user.accent,
      //   tribe: user.tribe,
      //   ethnicity: user.ethnicity,
    };
    respondsSender(
      userInfo,
      "User Profile displayed successfully",
      ResponseCode.successful,
      res
    );
  } else {
    respondsSender(null, "User Not Found", ResponseCode.noData, res);
  }
});

//Get Login Status
const loginStatus = asynchandler(async (req, res) => {
  if (!req.loginStatus) {
    respondsSender(null, false, ResponseCode.badRequest, res);
  }
  //Verify  Token
  respondsSender(null, true, ResponseCode.successful, res);
});

//Update User
const updateUser = asynchandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const { _id, name, email, photo, phone, bio } = user;
    user.email = email;
    user.name = req.body.name || name;
    user.phone = req.body.phone || phone;
    user.bio = req.body.bio || bio;
    user.photo = req.body.photo || photo;

    const updatedUser = await user.save();
    const user = {
      _id: updatedUser._id,
    };
    respondsSender(
      user,
      "User Info updated successfully",
      ResponseCode.successful,
      res
    );
  } else {
    respondsSender(null, "User Not Found", ResponseCode.noData, res);
  }
});

// Change Password
const changePassword = asynchandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { oldPassword, password } = req.body;
  if (!user) {
    respondsSender(
      null,
      "User Not Found, Please Sign-up",
      ResponseCode.noData,
      res
    );
  }
  //validate
  if (!oldPassword || !password) {
    respondsSender(
      null,
      "Please add old and New Password",
      ResponseCode.noData,
      res
    );
  }

  //check if old password matched password in DB
  const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password);

  //Save new Password
  if (user && passwordIsCorrect) {
    user.password = password;
    await user.save();

    respondsSender(
      null,
      "Password changed Successfully",
      ResponseCode.successful,
      res
    );
  } else {
    respondsSender(null, "Old Password is Incorrect", ResponseCode.noData, res);
  }
});

//Forgot Password Process
const forgotPassword = asynchandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    respondsSender(null, "Please add an email", ResponseCode.badRequest, res);
  }
  const user = await User.findOne({ email });
  if (!user) {
    respondsSender(null, "User email does not exist", ResponseCode.noData, res);
  }

  // Delete token if it exists in DB
  try {
    // Find and delete the token based on userId
    const deletedToken = await Token.findOneAndDelete({ userId: user._id });

    if (deletedToken) {
      console.log(`Token for userId deleted: ${user._id}`);
    } else {
      console.log(`No token found for userId: ${user._id}`);
    }
  } catch (error) {
    console.error(`Error deleting token: ${error.message}`);
  }

  //create Reset token
  const resetToken = generateToken(user._id);

  //Hash token before Saving to DB
  //  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")
  //Save Token to DB
  await new Token({
    userId: user._id,
    token: resetToken,
  }).save();

  const randomText = generateRandomString(12);
  //construct Reset URL
  const environment = process.env.ENVIRONMENT;
  const resetUrl = `${frontEndUrl[environment]}reset-password?token=${resetToken}&&jzhdh=${randomText}`;

  // Reset Email
  const message = `
                <h2> Hello ${user.lastname},</h2>
                <p> Please use the url below to reset your password </p>
                <p> This reset link is valid for only 5 minutes </p>
                
                <a href=${resetUrl} clicktracking = off > ${resetUrl}</a>
                
                <p> Regards ... </p>
                <p> Awarri LLM Team. </p>`;
  const subject = "Password Reset Request";
  const send_to = user.email;
  const sent_from = process.env.EMAIL_USER;

  try {
    await sendEmail(subject, message, send_to, sent_from);
    respondsSender(resetUrl, "Reset Email Sent", ResponseCode.successful, res);
  } catch (error) {
    respondsSender(
      null,
      "Email not Sent, Please try again" + error.message,
      ResponseCode.internalServerError,
      res
    );
  }
});

//Reset Password
const resetPassword = asynchandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.body;
  console.log(resetToken);
  if (!password || !resetToken) {
    respondsSender(
      null,
      "password and reset token needed",
      ResponseCode.badRequest,
      res
    );
  }

  //Hash token,  then Compare to Token in DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  //Find Token in DB before reseting
  const userToken = await Token.findOne({
    token: resetToken,
  });

  if (!userToken) {
    respondsSender(
      null,
      "Invalid or Expired Token",
      ResponseCode.invalidToken,
      res
    );
  }

  //Find user
  const user = await User.findOne({ _id: userToken.userId });
  user.password = password;
  await user.save();
  //delete token from db
  try {
    // Find and delete the token based on userId
    const deletedToken = await Token.findOneAndDelete({ userId: user._id });

    if (deletedToken) {
      console.log(`Deleted token for userId: ${user._id}`);
    } else {
      console.log(`No token found for userId: ${user._id}`);
    }
  } catch (error) {
    console.error(`Error deleting token: ${error.message}`);
  }
  respondsSender(
    null,
    "Password Reset Successful, Please Login",
    ResponseCode.successful,
    res
  );
});

// Get Accent of User
const getAccent = asynchandler(async (req, res) => {
  const allAccents = [
    "Yoruba",
    "Hausa",
    "Igbo",
    "Ijaw",
    "Idoma",
    "Igala",
    "Izon",
    "Ebira",
    "Urhobo",
    "Nembe",
    "Ibibio",
    "Pidgin",
    "Esan",
    "Alago",
    "Fulani",
    "Isoko",
    "Ikwere",
    "Efik",
    "Edo",
    "Bekwarra",
    "Hausa/Fulani",
    "Epie",
    "Nupe",
    "Anaang",
    "English",
    "Afemai",
    "Eggon",
    "Ukwuani",
    "Benin",
    "Kagoma",
    "Nasarawa Eggon",
    "Tiv",
    "Ogoni",
    "Mada",
    "Bette",
    "Berom",
    "Bini",
    "Ngas",
    "Etsako",
    "Okrika",
    "Damara",
    "Kanuri",
    "Itsekiri",
    "Ekpeye",
    "Mwaghavul",
    "Bajju",
    "Ekene",
    "Jaba",
    "Ika",
    "Angas",
    "Brass",
    "Ikulu",
    "Eleme",
    "Oklo",
    "Agatu",
    "Okirika",
    "Igarra",
    "Ijaw(nembe)",
    "Khana",
    "Ogbia",
    "Gbagyi",
    "Delta",
    "Bassa",
    "Etche",
    "Kubi",
    "Jukun",
    "Urobo",
    "Kalabari",
    "Ibani",
    "Obolo",
    "Idah",
    "Bassa-nge/nupe",
    "Yala mbembe",
    "Eket",
    "Afo",
    "Ebiobo",
    "Nyandang",
    "Ishan",
    "Bagi",
    "Estako",
    "Gerawa",
  ];
  respondsSender(allAccents, "Successful", ResponseCode.successful, res);
});

module.exports = {
  registerUser,
  loginUser,
  logout,
  getUser,
  loginStatus,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyUser,
  getAccent,
};
