import { IsArray, IsString } from 'class-validator';

export class ValidateUserRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
