import { IsString, MinLength } from 'class-validator';

export class ReturnToReviewDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
