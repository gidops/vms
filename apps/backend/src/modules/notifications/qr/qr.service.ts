import { Injectable } from '@nestjs/common';
import { toBuffer } from 'qrcode';

@Injectable()
export class QrService {
  /** 240px suits an email; pass a larger `width` for print. */
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
