/*
  Warnings:

  - You are about to drop the column `avaliacao` on the `Feedback` table. All the data in the column will be lost.
  - You are about to drop the column `fk_reserva` on the `Feedback` table. All the data in the column will be lost.
  - Added the required column `assunto` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoria` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fk_idCliente` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mensagem` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nota` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_fk_reserva_fkey";

-- DropIndex
DROP INDEX "Feedback_fk_reserva_idx";

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "avaliacao",
DROP COLUMN "fk_reserva",
ADD COLUMN     "assunto" TEXT NOT NULL,
ADD COLUMN     "categoria" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fk_idCliente" TEXT NOT NULL,
ADD COLUMN     "mensagem" TEXT NOT NULL,
ADD COLUMN     "nota" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Feedback_fk_idCliente_idx" ON "Feedback"("fk_idCliente");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fk_idCliente_fkey" FOREIGN KEY ("fk_idCliente") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
