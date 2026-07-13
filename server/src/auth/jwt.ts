import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret';
const EXPIRES = '7d';

export interface JwtPayload {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, SECRET) as JwtPayload;
