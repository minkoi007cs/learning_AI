import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({
    example: 'Explain the concept of backpropagation in neural networks',
  })
  @IsString()
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ExplainDto {
  @ApiProperty({ example: 'What is the Pythagorean theorem?' })
  @IsString()
  topic!: string;

  @ApiPropertyOptional({ example: 'high school' })
  @IsOptional()
  @IsString()
  level?: string;
}

export class SolveDto {
  @ApiProperty({ example: 'Solve the equation: 2x + 5 = 13' })
  @IsString()
  problem!: string;

  @ApiPropertyOptional({ example: 'Show detailed steps' })
  @IsOptional()
  @IsString()
  instructions?: string;
}
