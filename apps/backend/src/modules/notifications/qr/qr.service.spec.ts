import { QrService } from './qr.service';

describe('QrService', () => {
  const qr = new QrService();

  it('renders a PNG buffer for an access code', async () => {
    const buf = await qr.toPngBuffer('4486-BC9C');
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG magic number.
    expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('renders larger for print when asked', async () => {
    // PNG width is the big-endian uint32 at byte 16 of the IHDR chunk.
    const small = await qr.toPngBuffer('https://example.org/r/abc');
    const big = await qr.toPngBuffer('https://example.org/r/abc', {
      width: 600,
    });
    expect(small.readUInt32BE(16)).toBe(240);
    expect(big.readUInt32BE(16)).toBe(600);
  }, 20_000);
});
