import bcrypt from 'bcryptjs';
import { UserModel } from '../users/user.model.js';
import { UserStatus } from '../users/user.types.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import {
  hashToken,
  generateRandomToken,
  generateAccessToken,
  generateFirstLoginToken
} from '../../common/utils/token.js';
import { UnauthorizedError, BadRequestError } from '../../common/errors/app-error.js';

export class AuthService {
  /**
   * User Login
   */
  static async login(email: string, password: string, deviceInfo?: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedError('Invalid email or password or account is locked');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-min lockout
      }
      await user.save();
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === UserStatus.BLOCKED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedError('Account is inactive or blocked');
    }

    // Reset lockout counters on successful authentication
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const userSummary = {
      id: user._id!.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ? user.tenantId.toString() : undefined,
      status: user.status,
      firstLogin: !!user.firstLogin
    };

    // First Login Flow: Issue restricted first-login token ONLY
    if (user.firstLogin) {
      const firstLoginToken = generateFirstLoginToken({
        sub: user._id!.toString(),
        role: user.role,
        tenantId: user.tenantId?.toString()
      });

      return {
        firstLoginRequired: true,
        firstLoginToken,
        user: userSummary
      };
    }

    // Normal Authentication Flow
    const accessToken = generateAccessToken({
      sub: user._id!.toString(),
      role: user.role,
      tenantId: user.tenantId?.toString()
    });

    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshTokenModel.create({
      userId: user._id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
      deviceInfo
    });

    return {
      firstLoginRequired: false,
      accessToken,
      refreshToken: rawRefreshToken,
      user: userSummary
    };
  }

  /**
   * First Login Mandatory Password Change
   */
  static async firstLoginChangePassword(userId: string, newPassword: string, deviceInfo?: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;
    user.firstLogin = false;
    await user.save();

    // Revoke any existing refresh tokens
    await RefreshTokenModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    // Issue normal tokens after password change
    const accessToken = generateAccessToken({
      sub: user._id!.toString(),
      role: user.role,
      tenantId: user.tenantId?.toString()
    });

    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshTokenModel.create({
      userId: user._id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
      deviceInfo
    });

    return {
      message: 'Password changed successfully',
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id!.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : undefined,
        status: user.status
      }
    };
  }

  /**
   * Refresh Access Token with Token Rotation & Reuse Detection
   */
  static async refreshToken(rawRefreshToken: string, deviceInfo?: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const existingToken = await RefreshTokenModel.findOne({ tokenHash });

    if (!existingToken || existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Suspicious Token Reuse Detection: If token was already revoked, revoke ALL user sessions
    if (existingToken.revokedAt) {
      await RefreshTokenModel.updateMany(
        { userId: existingToken.userId, revokedAt: { $exists: false } },
        { revokedAt: new Date() }
      );
      throw new UnauthorizedError('Suspicious token reuse detected. All active sessions revoked.');
    }

    const user = await UserModel.findById(existingToken.userId);
    if (!user || user.status === UserStatus.BLOCKED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedError('User account unavailable or inactive');
    }

    // Token Rotation
    const newRawRefreshToken = generateRandomToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newToken = await RefreshTokenModel.create({
      userId: user._id,
      tenantId: user.tenantId,
      tokenHash: newTokenHash,
      expiresAt,
      deviceInfo
    });

    existingToken.revokedAt = new Date();
    existingToken.replacedByTokenId = newToken._id;
    await existingToken.save();

    const accessToken = generateAccessToken({
      sub: user._id!.toString(),
      role: user.role,
      tenantId: user.tenantId?.toString()
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken
    };
  }

  /**
   * Logout (Revoke Refresh Token)
   */
  static async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshTokenModel.updateOne(
        { tokenHash, revokedAt: { $exists: false } },
        { revokedAt: new Date() }
      );
    }
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Forgot Password - Send Reset Token (Generic Response)
   */
  static async forgotPassword(email: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (user) {
      const rawResetToken = generateRandomToken();
      user.passwordResetToken = hashToken(rawResetToken);
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();
      // In production, send email with rawResetToken
    }
    return {
      message: 'If an account with that email exists, password reset instructions have been sent.'
    };
  }

  /**
   * Reset Password with Token
   */
  static async resetPassword(token: string, newPassword: string) {
    const hashedResetToken = hashToken(token);
    const user = await UserModel.findOne({
      passwordResetToken: hashedResetToken,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken');

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.firstLogin = false;
    await user.save();

    // Revoke all active sessions
    await RefreshTokenModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  /**
   * Normal Authenticated Password Change
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Revoke active sessions
    await RefreshTokenModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    return { message: 'Password updated successfully. Active sessions revoked.' };
  }
}
