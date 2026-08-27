-- AlterTable
ALTER TABLE "ReservaCli" ADD COLUMN     "fk_idCarro" TEXT,
ADD COLUMN     "horaSaida" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReservaCli_fk_idCarro_idx" ON "ReservaCli"("fk_idCarro");

-- AddForeignKey
ALTER TABLE "ReservaCli" ADD CONSTRAINT "ReservaCli_fk_idCarro_fkey" FOREIGN KEY ("fk_idCarro") REFERENCES "Carro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
