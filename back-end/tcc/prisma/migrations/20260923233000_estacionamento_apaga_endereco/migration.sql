-- Ao excluir o estacionamento, apaga o endereco dele.
-- Se um usuario for dono desse endereco, o endereco permanece e o usuario nao e afetado.

CREATE OR REPLACE FUNCTION apagar_endereco_do_estacionamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Usuario" WHERE "fk_idEndereco" = OLD."fk_idEndereco"
  ) THEN
    DELETE FROM "Endereco" WHERE id = OLD."fk_idEndereco";
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estacionamento_apaga_endereco ON "Estacionamento";

CREATE TRIGGER estacionamento_apaga_endereco
AFTER DELETE ON "Estacionamento"
FOR EACH ROW
EXECUTE FUNCTION apagar_endereco_do_estacionamento();
