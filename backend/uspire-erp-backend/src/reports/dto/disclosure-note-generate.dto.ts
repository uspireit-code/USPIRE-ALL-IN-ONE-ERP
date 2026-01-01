import { DisclosureNoteType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class DisclosureNoteGenerateDto {
  @IsUUID()
  periodId!: string;

  @IsEnum(DisclosureNoteType)
  noteType!: DisclosureNoteType;
}
