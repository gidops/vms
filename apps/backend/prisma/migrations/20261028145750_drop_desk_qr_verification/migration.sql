/*
  Warnings:

  - You are about to drop the column `codeEmail` on the `DeskQr` table. All the data in the column will be lost.
  - You are about to drop the `DeskQrRegistration` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeskQrRegistration" DROP CONSTRAINT "DeskQrRegistration_deskQrId_fkey";

-- DropForeignKey
ALTER TABLE "DeskQrRegistration" DROP CONSTRAINT "DeskQrRegistration_visitId_fkey";

-- AlterTable
ALTER TABLE "DeskQr" DROP COLUMN "codeEmail";

-- DropTable
DROP TABLE "DeskQrRegistration";
