import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../../common/middleware/rate-limiter.js';

const router = Router();

router.post('/login', loginRateLimiter, AuthController.login);
router.post('/first-login-change-password', authenticate, AuthController.firstLoginChangePassword);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', passwordResetRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/change-password', authenticate, AuthController.changePassword);
router.get('/me', authenticate, AuthController.getMe);

export const authRouter = router;
