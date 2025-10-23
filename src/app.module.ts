import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { 
        expiresIn: '15m'
      },
    }),
    PassportModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    TeamsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}