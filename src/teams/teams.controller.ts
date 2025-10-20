import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto, InviteToTeamDto } from './dto/teams.dto';
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
    return this.teamsService.createTeam(createTeamDto.name, req.user.id);
  }

  @Get()
  async getUserTeams(@Req() req: AuthenticatedRequest) {
    return this.teamsService.getUserTeams(req.user.id);
  }

  @Post(':id/invite')
  async inviteToTeam(
    @Param('id') teamId: string,
    @Body() inviteDto: InviteToTeamDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.teamsService.inviteToTeam(teamId, inviteDto.email, req.user.id);
  }
}