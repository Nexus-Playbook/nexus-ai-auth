import { 
  IsEmail, 
  IsString, 
  MinLength, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum,
  IsDateString,
  IsMobilePhone,
  IsBoolean
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE', 
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY'
}

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsMobilePhone()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsBoolean()
  termsAccepted: boolean;
}

export class GoogleAuthDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsString()
  @IsNotEmpty()
  oauthId: string;

  @IsOptional()
  @IsMobilePhone()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}