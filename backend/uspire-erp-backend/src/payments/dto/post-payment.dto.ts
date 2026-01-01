import { IsOptional, IsString } from 'class-validator';

export class PostPaymentDto {
  @IsOptional()
  @IsString()
  apControlAccountCode?: string;

  @IsOptional()
  @IsString()
  arControlAccountCode?: string;
}
