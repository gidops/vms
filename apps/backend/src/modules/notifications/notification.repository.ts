import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Persistence for notifications — also the durable queue the dispatcher drains. */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(rows: Prisma.NotificationCreateManyInput[]) {
    return this.prisma.notification.createMany({ data: rows });
  }

  /** Pending rows whose backoff window has elapsed (FIFO by availableAt). */
  fetchPending(limit: number) {
    return this.prisma.notification.findMany({
      where: { status: 'PENDING', availableAt: { lte: new Date() } },
      orderBy: { availableAt: 'asc' },
      take: limit,
    });
  }

  async markSent(id: string, payload?: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        error: null,
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  }

  async markFailed(
    id: string,
    backoffMs: number,
    error: string,
    exhausted: boolean,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + backoffMs),
        error: error.slice(0, 500),
        ...(exhausted ? { status: 'FAILED' } : {}),
      },
    });
  }

  // ── In-app (dashboard) queries ─────────────────────────────────────────────

  listForUser(
    userId: string,
    opts: { page: number; pageSize: number; unreadOnly: boolean },
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: 'IN_APP',
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, channel: 'IN_APP' },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
    return res.count;
  }
}
