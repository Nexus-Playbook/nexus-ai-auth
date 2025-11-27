import { Controller, Post, Get, Body, Param, UseGuards, Req, Patch, Delete, BadRequestException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto, InviteToTeamDto, UpdateMemberRoleDto } from './dto/teams.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/prisma.types';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @Body() createTeamDto: CreateTeamDto,
    @Req() req: AuthenticatedRequest
  ) {
    // Allow any user to create teams - they become the owner of their created team
    return this.teamsService.createTeam(createTeamDto.name, req.user.id);
  }

  @Get()
  async getUserTeams(@Req() req: AuthenticatedRequest) {
    return this.teamsService.getUserTeams(req.user.id);
  }

  @Get(':id/members')
  async getTeamMembers(
    @Param('id') teamId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.teamsService.getTeamMembers(teamId, req.user.id);
  }

  @Post(':id/invite')
  async inviteToTeam(
    @Param('id') teamId: string,
    @Body() inviteDto: InviteToTeamDto,
    @Req() req: AuthenticatedRequest
  ) {
    // Fix #5: Check if user can invite members before proceeding
    const canInvite = await this.teamsService.canUserInviteMembers(
      teamId, 
      req.user.id, 
      req.user.role
    );
    
    if (!canInvite) {
      throw new BadRequestException('You do not have permission to invite members to this team');
    }

    return this.teamsService.inviteToTeam(
      teamId, 
      inviteDto.email, 
      req.user.id, 
      inviteDto.role || 'MEMBER'
    );
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateMemberRoleDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.teamsService.updateMemberRole(
      teamId,
      userId,
      updateRoleDto.role,
      req.user.id
    );
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.teamsService.removeMember(teamId, userId, req.user.id);
  }
}