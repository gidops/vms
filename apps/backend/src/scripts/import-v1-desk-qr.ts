/**
 * Adopts the already-printed desk QR so it keeps working. Idempotent.
 *   npm run desk-qr:import-v1 -w @vms/backend -- <qr-link-or-32-hex-token> <code-email>
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
