import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { AuthenticatedRequest } from '../types/prisma.types';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(
      signupDto.email,
      signupDto.password,
      signupDto.name
    );
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
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
    
    // Redirect to frontend with tokens (in production, use secure cookies)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
    
    res.redirect(redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    // In a more complete implementation, you'd invalidate the refresh token
    return { message: 'Logged out successfully' };
  }
}