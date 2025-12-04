import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthenticatedRequest } from '../types/prisma.types';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 signups per minute
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 login attempts per minute
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    // Read refreshToken from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh token not found',
        error: 'Unauthorized',
        statusCode: 401
      });
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    
    // Set new tokens in httpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.status(200).json(tokens);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return {
      user: req.user,
      message: 'Profile retrieved successfully'
    };
  }

  @UseGuards(GitHubAuthGuard)
  @Get('github')
  async githubLogin() {
    // Initiates GitHub OAuth flow
  }

  @UseGuards(GitHubAuthGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const tokens = await this.authService.githubLogin(req.user);
    
    // Security: Use httpOnly cookies instead of URL params to prevent token exposure
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set access token (short-lived, 15 min)
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,        // Prevents XSS attacks
      secure: isProduction,  // HTTPS only in production
      sameSite: 'lax',       // CSRF protection
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    // Set refresh token (long-lived, 7 days)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Redirect to frontend without tokens in URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleLogin() {
    // Initiates Google OAuth flow
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req.user);
    
    // Security: Use httpOnly cookies instead of URL params to prevent token exposure
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set access token (short-lived, 15 min)
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,        // Prevents XSS attacks
      secure: isProduction,  // HTTPS only in production
      sameSite: 'lax',       // CSRF protection
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    // Set refresh token (long-lived, 7 days)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Redirect to frontend without tokens in URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest & Request, @Res() res: Response) {
    // Read refreshToken from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken, req.user.id);
    }
    
    // Clear httpOnly cookies on logout
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return res.json({
      message: 'Logged out successfully'
    });
  }
}