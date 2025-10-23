import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole } from '../types/prisma.types';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async createTeam(name: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Create team
      const team = await tx.team.create({
        data: { name },
      });

      // Add creator as team lead
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          roleInTeam: TeamRole.LEAD,
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
                metadata: true,
              },
            },
          },
        },
      },
    });
  }

  async inviteToTeam(teamId: string, userEmail: string, inviterId: string) {
    // Check if inviter is team lead
    const inviterMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: inviterId,
        roleInTeam: TeamRole.LEAD,
      },
    });

    if (!inviterMembership) {
      throw new BadRequestException('Only team leads can invite members');
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
        roleInTeam: TeamRole.MEMBER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            metadata: true,
          },
        },
        team: true,
      },
    });
  }
}