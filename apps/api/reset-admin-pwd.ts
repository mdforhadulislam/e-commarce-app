import mongoose from "mongoose";
import User from "./models/userModel.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

const resetPassword = async () => {
  try {
    await connectDB();

    const email = "admin@gmail.com";
    const password = "Iloveyou@2025$";

    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User ${email} not found.`);
      process.exit(1);
    }

    user.password = password; // The pre-save hook in userModel.js will hash it
    user.role = "admin";
    await user.save();

    console.log(
      `Successfully reset password for ${email} and ensured role is admin.`,
    );
    process.exit(0);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
};

resetPassword();
