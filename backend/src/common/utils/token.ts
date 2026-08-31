import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface TokenPayload {
  sub: string;
  role: string;
  tenantId?: string;
  type: 'access' | 'first_login';
}

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateRandomToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateAccessToken = (payload: { sub: string; role: string; tenantId?: string }): string => {
  const tokenPayload: TokenPayload = {
    sub: payload.sub,
    role: payload.role,
    ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
    type: 'access'
  };
  const options: jwt.SignOptions = { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(tokenPayload, env.JWT_SECRET, options);
};

export const generateFirstLoginToken = (payload: { sub: string; role: string; tenantId?: string }): string => {
  const tokenPayload: TokenPayload = {
    sub: payload.sub,
    role: payload.role,
    ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
    type: 'first_login'
  };
  return jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: '15m' });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
