import { Injectable } from '@nestjs/common';
import { toBuffer } from 'qrcode';

/** Generates QR codes for visit access (embedded in emails as inline images). */
@Injectable()
export class QrService {
  /** Render `content` (e.g. an access code) as a PNG buffer. */
  toPngBuffer(content: string): Promise<Buffer> {
    return toBuffer(content, {
      type: 'png',
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
}
