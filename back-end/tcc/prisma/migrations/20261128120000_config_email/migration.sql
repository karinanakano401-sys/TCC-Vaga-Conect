-- Configuração do envio de e-mail (SMTP), gerenciada pelo administrador.
--
-- Tabela com uma única linha (id = 'smtp'). A senha SMTP nunca é guardada em
-- texto puro: "senhaCifrada" guarda o resultado da cifra AES-256-GCM.
-- "verificadoEm" é o momento em que a conexão com o servidor foi validada
-- com sucesso; uma configuração só é gravada depois dessa validação.
--
-- Migration aditiva: uma tabela nova. Nada existente é alterado.

CREATE TABLE "ConfigEmail" (
    "id"             TEXT         NOT NULL,
    "host"           TEXT         NOT NULL,
    "porta"          INTEGER      NOT NULL,
    "seguro"         BOOLEAN      NOT NULL,
    "usuario"        TEXT         NOT NULL,
    "senhaCifrada"   TEXT         NOT NULL,
    "emailRemetente" TEXT         NOT NULL,
    "nomeRemetente"  TEXT         NOT NULL,
    "urlFront"       TEXT         NOT NULL,
    "verificadoEm"   TIMESTAMP(3) NOT NULL,
    "atualizadoEm"   TIMESTAMP(3) NOT NULL,
    "atualizadoPor"  TEXT,

    CONSTRAINT "ConfigEmail_pkey" PRIMARY KEY ("id")
);
