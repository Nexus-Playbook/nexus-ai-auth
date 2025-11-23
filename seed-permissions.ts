import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  'create_project',
  'delete_project', 
  'manage_users',
  'assign_tasks',
  'reassign_tasks',
  'update_task_status',
  'delete_tasks',
  'view_all_tasks',
  'view_assigned_tasks',
  'create_tasks',
  'edit_task_details',
  'manage_team_settings',
  'view_analytics',
  'billing_management',
  'invite_users',
  'remove_users',
  'change_user_roles'
];

const rolePermissions = {
  OWNER: [
    'create_project', 'delete_project', 'manage_users', 'assign_tasks', 
    'reassign_tasks', 'update_task_status', 'delete_tasks', 'view_all_tasks',
    'create_tasks', 'edit_task_details', 'manage_team_settings', 'view_analytics',
    'billing_management', 'invite_users', 'remove_users', 'change_user_roles'
  ],
  ADMIN: [
    'create_project', 'manage_users', 'assign_tasks', 'reassign_tasks',
    'update_task_status', 'delete_tasks', 'view_all_tasks', 'create_tasks',
    'edit_task_details', 'manage_team_settings', 'view_analytics', 
    'invite_users', 'remove_users', 'change_user_roles'
  ],
  TEAM_LEAD: [
    'create_project', 'assign_tasks', 'update_task_status', 'view_all_tasks',
    'create_tasks', 'edit_task_details', 'view_analytics'
  ],
  DEVELOPER: [
    'view_assigned_tasks', 'edit_task_details', 'create_tasks'
  ],
  TESTER: [
    'view_assigned_tasks', 'edit_task_details', 'update_task_status'
  ],
  MEMBER: [
    'view_assigned_tasks'
  ]
};

async function seedRolePermissions() {
  console.log('🌱 Seeding role permissions...');
  
  try {
    // Clear existing permissions
    await prisma.rolePermission.deleteMany({});
    
    // Create role permissions
    for (const [role, perms] of Object.entries(rolePermissions)) {
      for (const permission of perms) {
        await prisma.rolePermission.create({
          data: {
            role: role as any,
            permission,
            canAccess: true
          }
        });
      }
      console.log(`✅ Created permissions for ${role}: ${perms.length} permissions`);
    }
    
    console.log('🎉 Role permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedRolePermissions();