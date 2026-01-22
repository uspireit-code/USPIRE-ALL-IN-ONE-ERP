import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  confirmNewPassword!: string;
}

export class UploadAvatarResponseDto {
  @IsString()
  avatarUrl!: string;
}

export class MeResponseDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  language?: string | null;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

export const AllowedAvatarMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedAvatarMimeType = (typeof AllowedAvatarMimeTypes)[number];
