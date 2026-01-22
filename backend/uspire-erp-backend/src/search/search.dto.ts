import { IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export type SearchResultType = 'ROUTE' | 'JOURNAL' | 'BANK_STATEMENT' | 'IMPREST';

export type SearchResultItem = {
  type: SearchResultType;
  label: string;
  targetUrl: string;
};
