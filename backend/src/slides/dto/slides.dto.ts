import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUBJECT_COLORS = [
  'violet',
  'blue',
  'emerald',
  'amber',
  'rose',
  'cyan',
] as const;

export class CreateSubjectDto {
  @ApiProperty({ example: 'Giải tích 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Môn học kỳ 1 — thầy Nam' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: SUBJECT_COLORS, default: 'violet' })
  @IsOptional()
  @IsIn(SUBJECT_COLORS as unknown as string[])
  color?: string;

  @ApiPropertyOptional({ example: 'book' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional({ example: 'Giải tích 2' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: SUBJECT_COLORS })
  @IsOptional()
  @IsIn(SUBJECT_COLORS as unknown as string[])
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}

export class UploadSlideDto {
  @ApiPropertyOptional({
    example: 'Buổi 3 — Đạo hàm',
    description: 'Optional title. Defaults to the uploaded file name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
