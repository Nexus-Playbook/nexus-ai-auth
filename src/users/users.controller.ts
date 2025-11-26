import { Controller, Get, Param, UseGuards, Req, Patch, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/prisma.types';
import { UpdateUserDto } from './dto/users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.id);
  }

  // Fix #8: Add users management endpoint for admins/owners
  @Get()
  async getAllUsers(@Req() req: AuthenticatedRequest) {
    // Only allow OWNER and ADMIN roles to view all users
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
      throw new BadRequestException('You do not have permission to view all users');
    }
    return this.usersService.findAll();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  async updateCurrentUser(
    @Req() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.updateUser(req.user.id, updateUserDto);
  }
}