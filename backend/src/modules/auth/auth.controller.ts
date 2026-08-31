import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  firstLoginChangePasswordSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.validation.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const deviceInfo = req.headers['user-agent'];
      const result = await AuthService.login(validated.email, validated.password, deviceInfo);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async firstLoginChangePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = firstLoginChangePasswordSchema.parse(req.body);
      const deviceInfo = req.headers['user-agent'];
      const result = await AuthService.firstLoginChangePassword(
        req.user!.id,
        validated.newPassword,
        deviceInfo
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.body.refreshToken || req.headers['x-refresh-token'];
      if (!rawToken || typeof rawToken !== 'string') {
        res.status(400).json({ success: false, error: { message: 'Refresh token is required' } });
        return;
      }
      const deviceInfo = req.headers['user-agent'];
      const result = await AuthService.refreshToken(rawToken, deviceInfo);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.body.refreshToken || req.headers['x-refresh-token'];
      const result = await AuthService.logout(typeof rawToken === 'string' ? rawToken : undefined);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const result = await AuthService.forgotPassword(validated.email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      const result = await AuthService.resetPassword(validated.token, validated.newPassword);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword(
        req.user!.id,
        validated.currentPassword,
        validated.newPassword
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: { user: req.user } });
  }
}
