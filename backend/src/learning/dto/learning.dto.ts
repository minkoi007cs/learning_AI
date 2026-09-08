import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
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

/**
 * One answer inside a quiz submission.
 *
 * IMPORTANT (see tech.md §9.2): the global ValidationPipe runs with
 * `whitelist: true` + `forbidNonWhitelisted: true`. Every field must carry a
 * class-validator decorator — `@ApiProperty()` alone does NOT count and the
 * whole request gets rejected with 400. This class exists because the previous
 * inline `Array<{...}>` type had no decorators, which made every single
 * `POST /quiz/submit` fail (BUG-01).
 */
export class QuizAnswerDto {
  @ApiProperty({ example: 0, description: 'Vị trí câu hỏi, bắt đầu từ 0' })
  @IsInt()
  @Min(0)
  @Max(199)
  questionIndex!: number;

  @ApiProperty({
    example: 'B',
    description: 'Đáp án: chữ cái với trắc nghiệm, văn bản với tự luận',
  })
  @IsString()
  @MaxLength(4000)
  answer!: string;
}

export class SubmitQuizDto {
  @ApiProperty()
  @IsString()
  quizId!: string;

  @ApiProperty({ type: [QuizAnswerDto], example: [{ questionIndex: 0, answer: 'B' }] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];

  @ApiPropertyOptional({ description: 'Thời gian làm bài, tính bằng giây' })
  @IsOptional()
  @IsInt()
  @Min(0)
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
  @MaxLength(500)
  topics?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  questionCount?: number;
}
