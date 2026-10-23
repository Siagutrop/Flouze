import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  householdName?: string;

  @IsOptional()
  @IsString()
  invitationToken?: string;
}
