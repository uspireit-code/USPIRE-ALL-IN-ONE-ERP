import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export enum CoaStructureChangeRequestTypeDto {
  SEGMENT_DEFINITION = 'SEGMENT_DEFINITION',
  SEGMENT_ORDER = 'SEGMENT_ORDER',
  HIERARCHY_CHANGE = 'HIERARCHY_CHANGE',
  ADD_ACCOUNT = 'ADD_ACCOUNT',
  EFFECTIVE_DATED_RECLASSIFICATION = 'EFFECTIVE_DATED_RECLASSIFICATION',
  REPORTING_NODE_CHANGE = 'REPORTING_NODE_CHANGE',
  TEMPLATE_EXTENSION = 'TEMPLATE_EXTENSION',
  ROOT_CATEGORY_MODIFICATION = 'ROOT_CATEGORY_MODIFICATION',
  OTHER = 'OTHER',
}

export class CreateCoaStructureChangeRequestDraftDto {
  @IsEnum(CoaStructureChangeRequestTypeDto)
  requestType!: CoaStructureChangeRequestTypeDto;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsObject()
  beforeState!: Record<string, any>;

  @IsObject()
  proposedState!: Record<string, any>;
}

export class UpdateCoaStructureChangeRequestDraftDto {
  @IsOptional()
  @IsEnum(CoaStructureChangeRequestTypeDto)
  requestType?: CoaStructureChangeRequestTypeDto;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsObject()
  beforeState?: Record<string, any>;

  @IsOptional()
  @IsObject()
  proposedState?: Record<string, any>;
}

export class SubmitCoaStructureChangeRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  comment?: string;
}

export class RejectCoaStructureChangeRequestDto {
  @IsString()
  @MinLength(3)
  rejectionReason!: string;
}
