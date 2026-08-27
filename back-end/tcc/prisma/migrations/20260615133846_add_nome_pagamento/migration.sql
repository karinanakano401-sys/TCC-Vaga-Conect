/*
  Warnings:

  - Added the required column `nome` to the `Pagamento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "nome" TEXT NOT NULL;
