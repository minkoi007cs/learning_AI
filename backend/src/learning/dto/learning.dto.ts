import { IsString, IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReviewQuality {
  AGAIN = 0, // Complete blackout
  HARD = 1, // Incorrect, but recalled after hint
  GOOD = 2, // Correct with difficulty
  EASY = 3, // Perfect recall
}

export class ReviewFlashcardDto {
  @ApiProperty()
  @IsString()
  flashcardId!: string;

  @ApiProperty({ enum: ReviewQuality, example: ReviewQuality.GOOD })
  @IsInt()
  @Min(0)
  @Max(3)
  quality!: ReviewQuality;
}

export class SubmitQuizDto {
  @ApiProperty()
  @IsString()
  quizId!: string;

  @ApiProperty({ example: [{ questionIndex: 0, answer: 'B' }] })
  answers!: Array<{ questionIndex: number; answer: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  timeSpent?: number;
}

export class GenerateQuizDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lectureId?: string;

  @ApiPropertyOptional({ example: 'machine learning, neural networks' })
  @IsOptional()
  @IsString()
  topics?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  questionCount?: number;
}
