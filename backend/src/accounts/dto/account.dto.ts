import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AccountType } from '@prisma/client';

const toMinorUnits = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : BigInt(String(value));

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsIn(Object.values(AccountType))
  type?: AccountType;

  @IsString()
  currencyCode: string;

  /** Solde initial en unités mineures (centimes) */
  @IsOptional()
  @Transform(toMinorUnits)
  initialBalance?: bigint;

  /** true = compte du foyer ; false/absent = compte personnel */
  @IsOptional()
  @IsBoolean()
  shared?: boolean;

  /** Fond de la carte : clé de dégradé (cover:…) ou data-URL */
  @IsOptional()
  @IsString()
  cover?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(Object.values(AccountType))
  type?: AccountType;

  @IsOptional()
  @Transform(toMinorUnits)
  initialBalance?: bigint;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsString()
  cover?: string;
}
