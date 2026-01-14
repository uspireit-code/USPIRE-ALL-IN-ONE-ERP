import { IsOptional, IsString } from 'class-validator';

export class UploadSupplierDocumentDto {
  @IsString()
  docType!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
