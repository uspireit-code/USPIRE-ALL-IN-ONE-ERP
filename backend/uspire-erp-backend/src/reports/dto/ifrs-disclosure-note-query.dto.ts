import { IsUUID } from 'class-validator';

export class IfrsDisclosureNoteQueryDto {
  @IsUUID()
  periodId!: string;
}
