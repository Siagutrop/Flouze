import { IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateHouseholdDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  budgetGenerationDay?: number;
}

export class CreateInvitationDto {
  @IsEmail()
  email: string;
}
