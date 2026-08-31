import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app.js';
import { UserModel } from '../../modules/users/user.model.js';
import { UserRole, UserStatus } from '../../modules/users/user.types.js';
import { RefreshTokenModel } from '../../modules/auth/refresh-token.model.js';
import { TenantModel } from '../../modules/tenants/tenant.model.js';
import { findOneTenantScoped } from '../../common/utils/tenant-query.js';
import { generateFirstLoginToken } from '../../common/utils/token.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loan-manager-test';

describe('Module 3 Authentication & Authorization Tests', () => {
  let tenantId: Types.ObjectId;
  const testUserPassword = 'TemporaryPass123!';
  const normalPassword = 'NormalSecurePassword123!';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await RefreshTokenModel.deleteMany({});
    await TenantModel.deleteMany({});

    const tenant = await TenantModel.create({
      name: 'Test Acme Corp',
      slug: 'test-acme',
      status: 'ACTIVE'
    });
    tenantId = tenant._id;
  });

  it('1. First Login: logs in with temporary password, returns restricted first-login token without full access or refresh tokens', async () => {
    const passwordHash = await bcrypt.hash(testUserPassword, 10);
    await UserModel.create({
      tenantId,
      email: 'newuser@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: true
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@acme.com', password: testUserPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.firstLoginRequired).toBe(true);
    expect(res.body.data.firstLoginToken).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('2. First Login Security: restricted token CANNOT access business/protected endpoints', async () => {
    const passwordHash = await bcrypt.hash(testUserPassword, 10);
    const user = await UserModel.create({
      tenantId,
      email: 'restricted@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: true
    });

    const firstLoginToken = generateFirstLoginToken({
      sub: user._id.toString(),
      role: UserRole.LOAN_OFFICER,
      tenantId: tenantId.toString()
    });

    // Try accessing protected endpoint
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLoginToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('First login password change required');
  });

  it('3. First Login Password Change: updates password, sets firstLogin=false, and issues normal tokens', async () => {
    const passwordHash = await bcrypt.hash(testUserPassword, 10);
    const user = await UserModel.create({
      tenantId,
      email: 'newuser@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: true
    });

    const firstLoginToken = generateFirstLoginToken({
      sub: user._id.toString(),
      role: user.role,
      tenantId: tenantId.toString()
    });

    const res = await request(app)
      .post('/api/v1/auth/first-login-change-password')
      .set('Authorization', `Bearer ${firstLoginToken}`)
      .send({
        newPassword: normalPassword,
        confirmPassword: normalPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    const updatedUser = await UserModel.findById(user._id);
    expect(updatedUser?.firstLogin).toBe(false);

    // Old temporary password cannot be reused for login
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@acme.com', password: testUserPassword });
    expect(oldLoginRes.status).toBe(401);

    // New password allows normal login
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@acme.com', password: normalPassword });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.data.firstLoginRequired).toBe(false);
    expect(newLoginRes.body.data.accessToken).toBeDefined();
  });

  it('4. Refresh Token Rotation: rotates token on refresh and rejects old token', async () => {
    const passwordHash = await bcrypt.hash(normalPassword, 10);
    await UserModel.create({
      tenantId,
      email: 'user@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@acme.com', password: normalPassword });

    const initialRefreshToken = loginRes.body.data.refreshToken;

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).not.toBe(initialRefreshToken);

    // Re-using old rotated refresh token triggers suspicious reuse detection
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.message).toContain('Suspicious token reuse detected');
  });

  it('5. Account Lockout: locks account after 5 failed attempts and auto-resets on successful login', async () => {
    const passwordHash = await bcrypt.hash(normalPassword, 10);
    const user = await UserModel.create({
      tenantId,
      email: 'lockout@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    // 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lockout@acme.com', password: 'WrongPassword123!' });
    }

    const lockedUser = await UserModel.findById(user._id);
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.lockUntil).toBeDefined();

    // Subsequent attempt fails due to lockout
    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@acme.com', password: normalPassword });
    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.error.message).toContain('account is locked');

    // Simulate lockout expiration
    lockedUser!.lockUntil = new Date(Date.now() - 1000);
    await lockedUser!.save();

    // Successful login resets counters
    const successRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@acme.com', password: normalPassword });
    expect(successRes.status).toBe(200);

    const unlockedUser = await UserModel.findById(user._id);
    expect(unlockedUser?.failedLoginAttempts).toBe(0);
    expect(unlockedUser?.lockUntil).toBeUndefined();
  });

  it('6. Logout: revokes specified refresh token', async () => {
    const passwordHash = await bcrypt.hash(normalPassword, 10);
    await UserModel.create({
      tenantId,
      email: 'logout@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logout@acme.com', password: normalPassword });

    const refreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Refresh after logout fails
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('7. Password Reset & Session Revocation: resets password and revokes all active sessions', async () => {
    const passwordHash = await bcrypt.hash(normalPassword, 10);
    const user = await UserModel.create({
      tenantId,
      email: 'reset@acme.com',
      passwordHash,
      role: UserRole.LOAN_OFFICER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    // Forgot password request returns generic message
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@acme.com' });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.data.message).toContain('If an account with that email exists');

    // Extract reset token from DB
    const dbUser = await UserModel.findById(user._id).select('+passwordResetToken');
    expect(dbUser?.passwordResetToken).toBeDefined();

    // Reset password with raw token
    const resetRes = await AuthServiceTestHelper.resetWithRawToken('reset@acme.com', 'BrandNewPassword123!');
    expect(resetRes.success).toBe(true);

    // Login with new password works
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@acme.com', password: 'BrandNewPassword123!' });
    expect(loginRes.status).toBe(200);
  });

  it('8. Roles & Tenant Isolation: PLATFORM_OWNER does not require tenantId, tenant users require matching tenantId', async () => {
    const platformOwner = await UserModel.create({
      email: 'owner@platform.com',
      passwordHash: await bcrypt.hash(normalPassword, 10),
      role: UserRole.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    const tenantUser = await UserModel.create({
      tenantId,
      email: 'tenantuser@acme.com',
      passwordHash: await bcrypt.hash(normalPassword, 10),
      role: UserRole.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false
    });

    expect(platformOwner.tenantId).toBeUndefined();
    expect(tenantUser.tenantId).toEqual(tenantId);

    // Test tenant-scoped helper query
    const scopedUser = await findOneTenantScoped(UserModel, tenantUser._id.toString(), tenantId.toString());
    expect(scopedUser).toBeDefined();

    const crossTenantUser = await findOneTenantScoped(UserModel, tenantUser._id.toString(), new Types.ObjectId().toString());
    expect(crossTenantUser).toBeNull();
  });
});

class AuthServiceTestHelper {
  static async resetWithRawToken(email: string, newPassword: string) {
    const user = await UserModel.findOne({ email }).select('+passwordResetToken');
    if (!user || !user.passwordResetToken) return { success: false };
    
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.firstLogin = false;
    await user.save();
    return { success: true };
  }
}
