import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole } from '../types/prisma.types';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async createTeam(name: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Create team with owner
      const team = await tx.team.create({
        data: { 
          name,
          ownerId: userId, // Set the creator as owner
        },
      });

      // Add creator as team owner
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          roleInTeam: 'OWNER',
          assignedBy: userId, // Self-assigned as owner
        },
      });

      return team;
    });
  }

  async getUserTeams(userId: string) {
    return this.prisma.team.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async inviteToTeam(teamId: string, userEmail: string, inviterId: string) {
    // Check if inviter has permission (OWNER, ADMIN, or TEAM_LEAD can invite)
    const inviterMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: inviterId,
        roleInTeam: { 
          in: ['OWNER', 'ADMIN', 'TEAM_LEAD'],
        },
      },
    });

    if (!inviterMembership) {
      throw new BadRequestException('Only team leaders and admins can invite members');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a team member');
    }

    // Add to team
    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        roleInTeam: 'MEMBER',
        assignedBy: inviterId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        team: true,
      },
    });
  }
}