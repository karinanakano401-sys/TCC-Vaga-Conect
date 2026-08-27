/*
  Warnings:

  - You are about to drop the column `idade` on the `Funcionario` table. All the data in the column will be lost.
  - You are about to drop the column `idade` on the `Usuario` table. All the data in the column will be lost.
  - Added the required column `dataNascimento` to the `Funcionario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataNascimento` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Funcionario" DROP COLUMN "idade",
ADD COLUMN     "dataNascimento" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "idade",
ADD COLUMN     "dataNascimento" TIMESTAMP(3) NOT NULL;
