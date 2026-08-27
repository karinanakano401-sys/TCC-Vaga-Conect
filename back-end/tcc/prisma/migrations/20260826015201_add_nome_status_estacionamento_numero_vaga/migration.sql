/*
  Warnings:

  - Added the required column `nome` to the `Estacionamento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Estacionamento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `Vaga` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Estacionamento" ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vaga" ADD COLUMN     "numero" TEXT NOT NULL;
