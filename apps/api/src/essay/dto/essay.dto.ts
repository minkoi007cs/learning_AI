import {
  IsString,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateEssayDto {
  @ApiProperty({
    example: 'Write a persuasive essay about the impact of AI on education',
  })
  @IsString()
  prompt!: string;

  @ApiProperty({
    example: {
      criteria: [
        {
          name: 'Thesis Statement',
          weight: 20,
          description: 'Clear and arguable thesis',
        },
        {
          name: 'Evidence & Support',
          weight: 25,
          description: 'Strong evidence and examples',
        },
        {
          name: 'Organization',
          weight: 20,
          description: 'Logical structure and flow',
        },
        {
          name: 'Analysis',
          weight: 20,
          description: 'Deep analysis of the topic',
        },
        {
          name: 'Grammar & Style',
          weight: 15,
          description: 'Proper grammar and academic style',
        },
      ],
      totalPoints: 100,
    },
  })
  @IsObject()
  rubric!: Record<string, unknown>;
}

export class ImproveEssayDto {
  @ApiProperty()
  @IsString()
  essayId!: string;

  @ApiPropertyOptional({
    example: 'Focus on strengthening the thesis and adding more evidence',
  })
  @IsOptional()
  @IsString()
  focusAreas?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  targetScore?: number;
}
