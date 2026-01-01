import { IsUUID } from 'class-validator';

export class DisclosureNoteListQueryDto {
  @IsUUID()
  periodId!: string;
}
