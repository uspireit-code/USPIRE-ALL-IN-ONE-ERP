import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ExecutePaymentRunDto {
  @IsDateString()
  executionDate!: string;

  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsUUID()
  bankAccountId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  paymentProposalIds!: string[];

  @IsOptional()
  @IsString()
  reference?: string;
}

export class ListPaymentRunsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
