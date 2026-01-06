import { IsIn, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateTaxRateDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @Min(0)
  @Max(100)
  rate!: number;

  @IsIn(['OUTPUT', 'INPUT'])
  type!: 'OUTPUT' | 'INPUT';

  @IsOptional()
  @IsUUID()
  glAccountId?: string;
}
