/*
  Warnings:

  - You are about to drop the column `numero_casa` on the `Usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fk_idEndereco]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cep` to the `Endereco` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `Endereco` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fk_idEndereco` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Carro" DROP CONSTRAINT "Carro_fk_idCliente_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_fk_reserva_fkey";

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_fk_reserva_fkey";

-- DropForeignKey
ALTER TABLE "ReservaCli" DROP CONSTRAINT "ReservaCli_fk_idCliente_fkey";

-- AlterTable
ALTER TABLE "Endereco" ADD COLUMN     "cep" TEXT NOT NULL,
ADD COLUMN     "numero" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "numero_casa",
ADD COLUMN     "fk_idEndereco" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Carro_fk_idCliente_idx" ON "Carro"("fk_idCliente");

-- CreateIndex
CREATE INDEX "Feedback_fk_reserva_idx" ON "Feedback"("fk_reserva");

-- CreateIndex
CREATE INDEX "Funcionario_fk_est_idx" ON "Funcionario"("fk_est");

-- CreateIndex
CREATE INDEX "Funcionario_fk_tipofunc_idx" ON "Funcionario"("fk_tipofunc");

-- CreateIndex
CREATE INDEX "Pagamento_fk_reserva_idx" ON "Pagamento"("fk_reserva");

-- CreateIndex
CREATE INDEX "Reserva_fk_vaga_idx" ON "Reserva"("fk_vaga");

-- CreateIndex
CREATE INDEX "ReservaCli_fk_idCliente_idx" ON "ReservaCli"("fk_idCliente");

-- CreateIndex
CREATE INDEX "ReservaCli_fk_idReserva_idx" ON "ReservaCli"("fk_idReserva");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_fk_idEndereco_key" ON "Usuario"("fk_idEndereco");

-- CreateIndex
CREATE INDEX "Vaga_fk_est_idx" ON "Vaga"("fk_est");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_fk_idEndereco_fkey" FOREIGN KEY ("fk_idEndereco") REFERENCES "Endereco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carro" ADD CONSTRAINT "Carro_fk_idCliente_fkey" FOREIGN KEY ("fk_idCliente") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaCli" ADD CONSTRAINT "ReservaCli_fk_idCliente_fkey" FOREIGN KEY ("fk_idCliente") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_fk_reserva_fkey" FOREIGN KEY ("fk_reserva") REFERENCES "ReservaCli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fk_reserva_fkey" FOREIGN KEY ("fk_reserva") REFERENCES "ReservaCli"("id") ON DELETE CASCADE ON UPDATE CASCADE;
