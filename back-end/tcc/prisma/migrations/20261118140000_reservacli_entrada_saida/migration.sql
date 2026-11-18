-- Registro real de entrada e saída do estacionamento.
--
-- Antes, "entrada" era deduzida só do status da reserva e "saída" não era
-- guardada (horaSaida é o horário PLANEJADO e era sobrescrito na saída).
-- Agora:
--   entradaEm = momento em que o cliente confirmou a presença (virou Ativa)
--   saidaEm   = momento em que a vaga foi liberada com o cliente dentro
--
-- Migration aditiva: duas colunas opcionais. Nenhum dado é apagado.

ALTER TABLE "ReservaCli" ADD COLUMN "entradaEm" TIMESTAMP(3);
ALTER TABLE "ReservaCli" ADD COLUMN "saidaEm" TIMESTAMP(3);

-- Quem está dentro agora (reserva Ativa) já entrou: usa o horário reservado
-- como aproximação, sem passar de "agora". Reservas já encerradas ficam sem
-- os dois campos, porque não há como saber quando entraram ou saíram.
UPDATE "ReservaCli" rc
SET "entradaEm" = LEAST(rc."hora", NOW())
FROM "Reserva" r
WHERE r."id" = rc."fk_idReserva"
  AND r."status" = 'Ativa'
  AND rc."entradaEm" IS NULL;

-- A saída nunca pode ser anterior à entrada
ALTER TABLE "ReservaCli"
  ADD CONSTRAINT "ReservaCli_saida_depois_da_entrada"
  CHECK ("saidaEm" IS NULL OR "entradaEm" IS NULL OR "saidaEm" >= "entradaEm");
