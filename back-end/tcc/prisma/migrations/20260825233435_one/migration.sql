/*
  Warnings:

  - Added the required column `numero_casa` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "numero_casa" INTEGER NOT NULL;
