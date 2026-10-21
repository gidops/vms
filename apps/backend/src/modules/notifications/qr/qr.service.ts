import { Injectable } from '@nestjs/common';
import { toBuffer } from 'qrcode';

/** Generates QR codes for visit access (embedded in emails as inline images). */
@Injectable()
export class QrService {
  /**
   * Render `content` (e.g. an access code) as a PNG buffer. 240px suits an
   * email; pass a larger `width` for print (the desk QR poster).
   */
  toPngBuffer(
    content: string,
    { width = 240 }: { width?: number } = {},
  ): Promise<Buffer> {
    return toBuffer(content, {
      type: 'png',
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
}
