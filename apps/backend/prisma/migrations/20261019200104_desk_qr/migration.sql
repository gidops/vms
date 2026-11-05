-- CreateTable
CREATE TABLE "DeskQr" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'desk',
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "codeEmail" TEXT NOT NULL,
    "tokenRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanDay" TEXT,
    "scansToday" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeskQrRegistration" (
    "id" TEXT NOT NULL,
    "deskQrId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeskQrRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeskQr_key_key" ON "DeskQr"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DeskQr_token_key" ON "DeskQr"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DeskQrRegistration_visitId_key" ON "DeskQrRegistration"("visitId");

-- CreateIndex
CREATE INDEX "DeskQrRegistration_deskQrId_createdAt_idx" ON "DeskQrRegistration"("deskQrId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeskQr" ADD CONSTRAINT "DeskQr_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskQrRegistration" ADD CONSTRAINT "DeskQrRegistration_deskQrId_fkey" FOREIGN KEY ("deskQrId") REFERENCES "DeskQr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskQrRegistration" ADD CONSTRAINT "DeskQrRegistration_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
