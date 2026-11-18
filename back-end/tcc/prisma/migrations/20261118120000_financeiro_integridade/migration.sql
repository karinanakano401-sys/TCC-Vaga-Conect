-- Integridade da área financeira
--
-- 1) Pagamento ganha data real (criadoEm) e categoria (taxa | tempo_extra | ajuste)
-- 2) Backfill dos registros existentes (nenhum valor é alterado)
-- 3) Travas de integridade no próprio banco


-- 1) Colunas novas -----------------------------------------------------------
ALTER TABLE "Pagamento"
  ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'taxa',
  ADD COLUMN "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- 2) Backfill ----------------------------------------------------------------

-- Categoria: numa reserva com mais de um pagamento, a taxa é o menor valor
-- que ainda cobre a garantia (R$ 25). Os demais são tempo extra.
-- Reservas com um único pagamento continuam como 'taxa'.
UPDATE "Pagamento" p
SET "categoria" = 'tempo_extra'
WHERE (SELECT COUNT(*) FROM "Pagamento" o WHERE o."fk_reserva" = p."fk_reserva") > 1
  AND p."id" <> (
    SELECT o."id"
    FROM "Pagamento" o
    WHERE o."fk_reserva" = p."fk_reserva" AND o."valor" >= 25
    ORDER BY o."valor" ASC, o."id" ASC
    LIMIT 1
  );

-- Data: antes, os relatórios usavam a hora da reserva como data do pagamento.
-- Mantemos esse mesmo critério para a taxa (os relatórios antigos não mudam)
-- e usamos a hora de saída (real, gravada na saída) para o tempo extra.
UPDATE "Pagamento" p
SET "criadoEm" = COALESCE(
  CASE WHEN p."categoria" = 'tempo_extra' THEN rc."horaSaida" ELSE rc."hora" END,
  rc."hora",
  p."criadoEm"
)
FROM "ReservaCli" rc
WHERE rc."id" = p."fk_reserva";


-- 3) Travas ------------------------------------------------------------------
CREATE INDEX "Pagamento_criadoEm_idx" ON "Pagamento"("criadoEm");

-- valor sempre positivo
ALTER TABLE "Pagamento"
  ADD CONSTRAINT "Pagamento_valor_positivo" CHECK ("valor" > 0);

-- categoria conhecida
ALTER TABLE "Pagamento"
  ADD CONSTRAINT "Pagamento_categoria_valida" CHECK ("categoria" IN ('taxa', 'tempo_extra', 'ajuste'));

-- no máximo uma taxa por reserva (evita lançamento duplicado)
CREATE UNIQUE INDEX "Pagamento_uma_taxa_por_reserva"
  ON "Pagamento"("fk_reserva") WHERE "categoria" = 'taxa';

-- reembolso nunca devolve mais do que foi pago
ALTER TABLE "Reembolso"
  ADD CONSTRAINT "Reembolso_valores_validos"
  CHECK ("valorDevolver" >= 0 AND "valorPago" >= 0 AND "valorDevolver" <= "valorPago");

-- status conhecido
ALTER TABLE "Reembolso"
  ADD CONSTRAINT "Reembolso_status_valido" CHECK ("status" IN ('Pendente', 'Aprovada', 'Recusada'));

-- um pedido ativo (Pendente ou Aprovada) por reserva
CREATE UNIQUE INDEX "Reembolso_um_ativo_por_reserva"
  ON "Reembolso"("fk_reservacli") WHERE "status" IN ('Pendente', 'Aprovada');
