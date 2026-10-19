/**
 * Cutover: keep the QR already printed at the VMC desk working in v2.
 *
 *   npm run desk-qr:import-v1 -w @vms/backend -- <v1-qr-link> <code-email>
 *   (built image: node dist/scripts/import-v1-desk-qr.js <v1-qr-link> <code-email>)
 *
 * <v1-qr-link> is the URL shown under the issuer's QR in V1
 * (https://aatcabuja.com.ng/qr.php?i=<32 hex>) or just the 32-hex token.
 * <code-email> is where verification codes go (V1: that issuer's email).
 * Once aatcabuja.com.ng points at v2, /qr.php?i=… redirects to the v2 form.
 * Safe to re-run: it replaces the desk QR's token and email.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DeskQrService } from '../modules/desk-qr/desk-qr.service';

async function main(): Promise<void> {
  const [link, codeEmail] = process.argv.slice(2);
  if (!link || !codeEmail) {
    console.error(
      'Usage: import-v1-desk-qr <v1-qr-link-or-token> <code-email>',
    );
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const qr = await app.get(DeskQrService).importV1(link, codeEmail);
    console.log(`Desk QR imported. It now opens ${qr.url}`);
    console.log(`Verification codes go to ${qr.codeEmail}.`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
