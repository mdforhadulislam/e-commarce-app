import jwt, { type SignOptions } from "jsonwebtoken";
import type { Types } from "mongoose";

const generateToken = (id: Types.ObjectId | string) => {
  const accessToken = jwt.sign({ id: id.toString() }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRE || "15m") as SignOptions["expiresIn"],
  });

  const refreshToken = jwt.sign({ id: id.toString() }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRE || "7d") as SignOptions["expiresIn"],
  });

  return { accessToken, refreshToken };
};

export default generateToken;
