import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuditQuery, PERMISSIONS } from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { AuditTrailService } from './audit-trail.service';

/** Operations → Audit trail. System Admin only. */
@Controller('audit')
export class AuditTrailController {
  private readonly logger = new Logger(AuditTrailController.name);

  constructor(private readonly audit: AuditTrailService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(@Query(new ZodValidationPipe(AuditQuery)) query: AuditQuery) {
    return this.audit.list(query);
  }

  /** The filtered trail as CSV (no paging); the export itself is audited. */
  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.AUDIT_READ, PERMISSIONS.AUDIT_EXPORT)
  async export(
    @Query(new ZodValidationPipe(AuditQuery)) query: AuditQuery,
    @CurrentUser() principal: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.audit.filename(query)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    try {
      await this.audit.write(query, res, principal.userId);
    } catch (err) {
      // Once bytes have gone out the status can't change; cut the download.
      if (!res.headersSent) throw err;
      this.logger.error(
        `Audit export failed after streaming began: ${String(err)}`,
      );
      res.destroy(err instanceof Error ? err : undefined);
    }
  }
}
