import { IsIn, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateTaxRateDto {
  @IsString()
  name!: string;

  @Min(0)
  @Max(1)
  rate!: number;

  @IsIn(['OUTPUT', 'INPUT'])
  type!: 'OUTPUT' | 'INPUT';

  @IsUUID()
  glAccountId!: string;
}
