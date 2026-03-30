import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadLectureDto {
  @ApiProperty({ example: 'Introduction to Machine Learning' })
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ProcessLectureDto {
  @ApiProperty()
  @IsString()
  lectureId!: string;

  @ApiPropertyOptional({
    example: 'Focus on neural networks and backpropagation',
  })
  @IsOptional()
  @IsString()
  focusTopics?: string;
}
