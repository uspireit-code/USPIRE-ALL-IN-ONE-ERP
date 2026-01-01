import { IsNumberString } from 'class-validator';

export class SoceQueryDto {
  @IsNumberString()
  fiscalYear!: string;
}
