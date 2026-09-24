-- DropForeignKey
ALTER TABLE "Reserva" DROP CONSTRAINT "Reserva_fk_vaga_fkey";
ALTER TABLE "ReservaCli" DROP CONSTRAINT "ReservaCli_fk_idReserva_fkey";

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_fk_vaga_fkey" FOREIGN KEY ("fk_vaga") REFERENCES "Vaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservaCli" ADD CONSTRAINT "ReservaCli_fk_idReserva_fkey" FOREIGN KEY ("fk_idReserva") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
