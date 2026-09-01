import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        color: dto.color || 'violet',
        icon: dto.icon || 'book',
      },
    });
    this.logger.log(`Subject created: ${subject.id}`);
    return subject;
  }

  async list(userId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { slideSessions: true } } },
    });
    return { data: subjects };
  }

  async get(userId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, userId },
      include: {
        slideSessions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            sourceFileName: true,
            sourceFileType: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(userId: string, subjectId: string, dto: UpdateSubjectDto) {
    await this.assertOwned(userId, subjectId);
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      },
    });
  }

  async remove(userId: string, subjectId: string) {
    await this.assertOwned(userId, subjectId);
    await this.prisma.subject.delete({ where: { id: subjectId } });
    return { success: true };
  }

  /** Verifies the subject exists and belongs to the user. */
  async assertOwned(userId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, userId },
      select: { id: true, name: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }
}
