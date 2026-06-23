import { QrService } from './qr.service';

describe('QrService', () => {
  const qr = new QrService();

  it('renders a PNG buffer for an access code', async () => {
    const buf = await qr.toPngBuffer('4486-BC9C');
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG magic number.
    expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
