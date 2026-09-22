-- CreateTable
CREATE TABLE "Reembolso" (
    "id" TEXT NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL,
    "valorDevolver" DOUBLE PRECISION NOT NULL,
    "minutosUsados" INTEGER NOT NULL DEFAULT 0,
    "valorUsado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "observacao" TEXT NOT NULL DEFAULT '',
    "decididoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido" TIMESTAMP(3),
    "fk_reservacli" TEXT NOT NULL,
    "fk_idCliente" TEXT NOT NULL,

    CONSTRAINT "Reembolso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reembolso_fk_reservacli_idx" ON "Reembolso"("fk_reservacli");

-- CreateIndex
CREATE INDEX "Reembolso_fk_idCliente_idx" ON "Reembolso"("fk_idCliente");

-- AddForeignKey
ALTER TABLE "Reembolso" ADD CONSTRAINT "Reembolso_fk_reservacli_fkey" FOREIGN KEY ("fk_reservacli") REFERENCES "ReservaCli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reembolso" ADD CONSTRAINT "Reembolso_fk_idCliente_fkey" FOREIGN KEY ("fk_idCliente") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
