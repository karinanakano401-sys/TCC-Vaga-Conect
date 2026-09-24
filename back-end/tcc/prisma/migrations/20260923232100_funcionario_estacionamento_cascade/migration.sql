-- DropForeignKey
ALTER TABLE "Funcionario" DROP CONSTRAINT "Funcionario_fk_est_fkey";

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_fk_est_fkey" FOREIGN KEY ("fk_est") REFERENCES "Estacionamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
