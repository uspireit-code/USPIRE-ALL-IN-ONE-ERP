import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export enum IfrsStatementDto {
  BS = 'BS',
  PL = 'PL',
  CF = 'CF',
}

export class CreateIfrsNodeDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(IfrsStatementDto)
  statement!: IfrsStatementDto;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateIfrsNodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
