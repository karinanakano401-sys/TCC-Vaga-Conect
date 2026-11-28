-- Recuperação de senha por e-mail.
--
--   RecuperacaoSenha  = um pedido de redefinição. Guarda só o HASH do token
--                       (o token existe apenas no link enviado por e-mail),
--                       a validade e quando foi usado (uso único).
--   senhaAlteradaEm   = data da última redefinição. Tokens de login emitidos
--                       antes dela deixam de valer (sessões antigas caem).
--
-- Migration aditiva: uma tabela nova e duas colunas opcionais.
-- Nenhum dado existente é alterado ou apagado.

ALTER TABLE "Usuario"     ADD COLUMN "senhaAlteradaEm" TIMESTAMP(3);
ALTER TABLE "Funcionario" ADD COLUMN "senhaAlteradaEm" TIMESTAMP(3);

CREATE TABLE "RecuperacaoSenha" (
    "id"        TEXT         NOT NULL,
    "tokenHash" TEXT         NOT NULL,
    "tipo"      TEXT         NOT NULL,
    "contaId"   TEXT         NOT NULL,
    "expiraEm"  TIMESTAMP(3) NOT NULL,
    "usadoEm"   TIMESTAMP(3),
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecuperacaoSenha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecuperacaoSenha_tokenHash_key" ON "RecuperacaoSenha"("tokenHash");
CREATE INDEX "RecuperacaoSenha_tipo_contaId_idx" ON "RecuperacaoSenha"("tipo", "contaId");
