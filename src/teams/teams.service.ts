import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole } from '../types/prisma.types';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  // Team creation method
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

  async inviteToTeam(teamId: string, userEmail: string, inviterId: string, roleInTeam: TeamRole = 'MEMBER') {
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
        roleInTeam,
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

  async getTeamMembers(teamId: string, requesterId: string) {
    // Check if requester is a team member
    const requesterMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: requesterId,
      },
    });

    if (!requesterMembership) {
      throw new BadRequestException('You are not a member of this team');
    }

    // Fix #4: Sort with team creator (OWNER) first, then by join date
    return this.prisma.teamMember.findMany({
      where: { teamId },
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
      orderBy: [
        { 
          roleInTeam: 'asc' // OWNER (creator) first, then ADMIN, then others
        },
        { 
          joinedAt: 'asc' // Earliest joiners first within each role
        }
      ],
    });
  }

  async updateMemberRole(teamId: string, userId: string, newRole: TeamRole, requesterId: string) {
    // Check if requester has permission (only OWNER can change roles)
    const requesterMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: requesterId,
        roleInTeam: 'OWNER',
      },
    });

    if (!requesterMembership) {
      throw new BadRequestException('Only team owners can change member roles');
    }

    // Check if member exists
    const memberToUpdate = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!memberToUpdate) {
      throw new BadRequestException('Member not found in this team');
    }

    // Don't allow changing owner role
    if (memberToUpdate.roleInTeam === 'OWNER') {
      throw new BadRequestException('Cannot change owner role');
    }

    // Fix: Prevent multiple OWNER roles - don't allow setting new OWNER
    if (newRole === 'OWNER') {
      throw new BadRequestException('Cannot assign OWNER role. Each team can only have one owner.');
    }

    return this.prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: {
        roleInTeam: newRole,
        updatedAt: new Date(),
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
      },
    });
  }

  async removeMember(teamId: string, userId: string, requesterId: string) {
    // Check if requester has permission (OWNER can remove anyone, others can leave)
    const requesterMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: requesterId,
      },
    });

    if (!requesterMembership) {
      throw new BadRequestException('You are not a member of this team');
    }

    // Check if member exists
    const memberToRemove = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!memberToRemove) {
      throw new BadRequestException('Member not found in this team');
    }

    // Don't allow removing owner
    if (memberToRemove.roleInTeam === 'OWNER') {
      throw new BadRequestException('Cannot remove team owner');
    }

    // Only owner can remove others, or user can remove themselves
    if (requesterMembership.roleInTeam !== 'OWNER' && requesterId !== userId) {
      throw new BadRequestException('Only team owners can remove other members');
    }

    return this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
  }

  /**
   * Fix #7: Check if user is the team creator (owner of the team)
   */
  async isTeamCreator(teamId: string, userId: string): Promise<boolean> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    
    return team?.ownerId === userId;
  }

  /**
   * Fix #5: Check if user can invite members to team
   */
  async canUserInviteMembers(teamId: string, userId: string, userRole: string): Promise<boolean> {
    // System-level permissions
    if (['OWNER', 'ADMIN', 'TEAM_LEAD'].includes(userRole)) {
      // Check if user is a member of the team
      const membership = await this.prisma.teamMember.findFirst({
        where: { teamId, userId },
      });
      
      if (!membership) {
        return false;
      }

      // Team-level permissions
      return ['OWNER', 'ADMIN'].includes(membership.roleInTeam);
    }
    
    return false;
  }
}