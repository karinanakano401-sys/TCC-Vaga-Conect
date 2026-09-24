-- DropForeignKey
ALTER TABLE "Vaga" DROP CONSTRAINT "Vaga_fk_est_fkey";

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_fk_est_fkey" FOREIGN KEY ("fk_est") REFERENCES "Estacionamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
