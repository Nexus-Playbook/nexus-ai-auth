import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class InviteToTeamDto {
  @IsEmail()
  email: string;
}