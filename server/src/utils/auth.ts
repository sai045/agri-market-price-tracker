import jwt from "jsonwebtoken";
import { config } from "../config.js";

type JwtPayload = {
  userId: string;
  email: string;
};

export function signAdminToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
