import { IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
