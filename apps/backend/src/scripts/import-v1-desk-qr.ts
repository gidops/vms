/**
 * Adopts the already-printed desk QR so it keeps working. Idempotent.
 *   npm run desk-qr:import-v1 -w @vms/backend -- <qr-link-or-32-hex-token>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DeskQrService } from '../modules/desk-qr/desk-qr.service';

async function main(): Promise<void> {
  const [link] = process.argv.slice(2);
  if (!link) {
    console.error('Usage: import-v1-desk-qr <v1-qr-link-or-token>');
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const qr = await app.get(DeskQrService).importV1(link);
    console.log(`Desk QR imported. It now opens ${qr.url}`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
