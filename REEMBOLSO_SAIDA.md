# Reembolso e código de saída

## 1. Resumo

O código de saída agora só é exigido de quem **está ocupando uma vaga**. Quem ainda
não entrou no estacionamento cancela e pede o reembolso **sem código**. Quem já saiu
não recebe novo pedido de código. A decisão é do servidor, a partir da situação real
da ocupação, e a tela apenas mostra o que o servidor informa.

## 2. Como funcionava antes

- Entrada: o pátio gerava o `codigoPresenca` e o cliente o digitava
  (`confirmar-presenca`). A reserva virava `Ativa` e a vaga `Ocupada`.
  **Não havia data de entrada gravada.**
- Cancelar com reembolso (`POST /reservacli/:id/confirmar-saida`) exigia o código de
  saída em **qualquer** reserva em andamento, inclusive `Reservada`, `Tolerância` e
  `Atraso`, quando o cliente nem tinha chegado.
- `horaSaida` é o horário **planejado**. Na saída era sobrescrito e não existia um
  registro separado de saída.
- `POST /reembolso` aceitava pedido de quem estava na vaga sem código e sem sair,
  e não cancelava a reserva nem liberava a vaga.

## 3. Problemas identificados

| # | Gravidade | Problema |
|---|---|---|
| 1 | Crítico | Código de saída exigido de quem nunca entrou (telas e textos mandavam "ir ao pátio"). |
| 2 | Crítico | Contorno pela API: `POST /reembolso` durante a ocupação criava o pedido sem sair da vaga. |
| 3 | Alto | Sem registro real de entrada e saída; o horário planejado era apagado. |
| 4 | Alto | `gerarCodigoSaida` aceitava reservas sem ocupação. |
| 5 | Médio | Telas do pátio ofereciam "Código de saída" para quem ainda não tinha chegado. |
| 6 | Médio | Pedidos simultâneos podiam devolver erro cru do banco (400). |

O problema da exposição pública dos códigos está em **Pendências** (seção 12).

## 4. Nova lógica

### Como o sistema identifica a ocupação ativa
Módulo único: `back-end/tcc/src/services/ocupacaoservice.js`
(`situacaoDaOcupacao`). Usa `entradaEm`, `saidaEm`, o status da reserva e o status da
vaga:

| Situação | Quando | Pede código de saída? |
|---|---|---|
| `sem_entrada` | Reservada/Tolerância/Atraso, sem entrada, vaga não ocupada | **Não** |
| `ocupando` | Reserva `Ativa`, ou `entradaEm` sem `saidaEm`, ou vaga `Ocupada` com a reserva ainda aguardando | **Sim** |
| `saiu` | `Concluída`, ou `saidaEm` preenchido, ou cancelada depois de ter entrado | **Não** |
| `cancelada` | Cancelada sem nunca ter entrado | **Não** |

Reserva `Ativa` sem `entradaEm` (ativada antes do registro existir) conta como
`ocupando`, para nunca dispensar o código de quem está dentro.

O resultado vai para o front no campo novo **`ocupacao`** de `GET /reservacli` e
`GET /reservacli/:id` (aditivo, junto de `cobranca`).

### Quando o código é exigido
Somente em `ocupando`. Nas demais situações o campo `codigo` enviado é ignorado.

### Validação do código (`cancelarComReembolso`)
1. Identifica o usuário (token) e a reserva; só o dono ou a equipe seguem (403 para outro cliente).
2. Calcula a situação da ocupação **no servidor**.
3. Se `ocupando`: sem código → 400 (`exigeCodigoSaida: true`); sem código gerado pelo pátio → 400; código diferente → 400 `Código de saída inválido.` Nada é gravado em nenhum desses casos.
4. Numa transação: troca o status da reserva com atualização condicional (só vence uma chamada, as demais recebem 409), libera a vaga, apaga os códigos, grava `saidaEm` (e `horaSaida`) **apenas se havia ocupação** e cria o reembolso `Pendente`.
5. Quem perde uma corrida recebe 409 com mensagem clara, não erro do banco.

### Reembolso x saída
São etapas separadas. A saída (validada pelo código) libera a vaga. O reembolso segue
as **mesmas regras financeiras de antes** (`calcularEstorno`: devolve os minutos não
usados, a garantia fica retida, a equipe aprova ou recusa uma vez, um reembolso ativo
por reserva). Nenhuma regra financeira nova foi criada.

## 5. Banco de dados

Migration aditiva `20261118140000_reservacli_entrada_saida` (aplicada com
`prisma migrate deploy`):

| Item | Detalhe |
|---|---|
| `ReservaCli.entradaEm` | `DateTime?`: preenchido ao confirmar a presença |
| `ReservaCli.saidaEm` | `DateTime?`: preenchido quando a vaga é liberada com o cliente dentro |
| Restrição | `saidaEm >= entradaEm` (quando ambos existem) |
| Dados existentes | Nada alterado ou apagado. As 2 reservas `Ativa` receberam `entradaEm = LEAST(hora, agora)`. As encerradas ficam sem os dois campos, pois não há como saber. |

Verificação: 22 → 22 reservas, 0 divergência nos campos antigos.

## 6. Arquivos modificados

### Back end
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` + migration | `entradaEm`, `saidaEm` |
| `src/services/ocupacaoservice.js` (novo) | Situação da ocupação (fonte única) |
| `src/services/reservacliservice.js` | `ocupacao` nas respostas; `entradaEm` na entrada; `saidaEm` em `/sair` e na saída com reembolso; `gerarCodigoSaida` só com ocupação; novo `cancelarComReembolso` (usado por `confirmarSaida` e por `POST /reembolso`); erros de concorrência viram 409 |
| `src/services/reembolsoservice.js` | `criarReembolso`: bloqueia ocupação ativa (409 + `exigeCodigoSaida`); sem entrada, cancela e abre o pedido na mesma transação |
| `src/controller/reservaCliController.js` | `confirmar-saida` usa `responderErro` (sem texto do banco) |
| `src/auth.js` | `responderErro` repassa `exigeCodigoSaida` |

### Front end
| Arquivo | Mudança |
|---|---|
| `Usuario/HTML/TelaReembolso.html` e `CSS/TelaReembolso.css` | Aviso conforme a situação; sem entrada envia direto, sem campo de código; ocupando abre o modal do código; mensagens para "já saiu" e "cancelada antes da entrada" |
| `Base/JS/presenca.js` | `Presenca.ocupando`; textos do modal de saída; erro repassa `exigeCodigoSaida` |
| `Base/JS/cobranca.js` | `Cobranca.ocupando` e `textoCancelamento` (só exibição) |
| `Usuario/HTML/TelaCheckoutEncerrar.html`, `TelaReserAndamento.html` | Aviso de cancelamento por situação (sem mandar ir ao pátio quem não entrou) |
| `Funcionario/HTML/TelaFuncReservas.html`, `Administrador/HTML/TelaReservas.html` | Botão "Código de saída" só com ocupação ativa |
| `Administrador/HTML/ReserDetalhe.html` | Botão de saída só com ocupação ativa |

## 7. APIs alteradas

| Endpoint | Mudança |
|---|---|
| `GET /reservacli`, `GET /reservacli/:id` | Campo novo `ocupacao { situacao, ocupacaoAtiva, exigeCodigoSaida, entradaEm, saidaEm }` |
| `POST /reservacli/:id/confirmar-saida` | Código só exigido com ocupação ativa. Erros: 400 (código ausente/inválido, com `exigeCodigoSaida`), 403 (reserva de outro), 409 (já encerrada ou situação mudou) |
| `POST /reservacli/:id/codigo-saida` | 409 se não há ocupação ativa |
| `POST /reservacli/:id/confirmar-presenca` | Grava `entradaEm` |
| `POST /reservacli/:id/sair` | Grava `saidaEm` |
| `POST /reembolso` (pedido de minutos não usados) | Ocupando: 409 + `exigeCodigoSaida`. Sem entrada: cancela a reserva, libera a vaga e cria o reembolso numa transação. Após a saída: 409 (política mantida) |

Preservados sem mudança: estorno total do administrador, decisão de reembolso
(`PUT /reembolso/:id`), cálculo do valor.

## 8. Cenário C (reembolso após a saída)

Por decisão sua, a política atual foi **mantida**: depois da saída não há novo pedido
de reembolso. Nesse caso o sistema **não pede código** e a tela explica a situação
("você já saiu do estacionamento, por isso não é preciso informar código de saída").

## 9. Testes e resultados

**Back end (API real, dados temporários removidos depois): 47 de 48 na primeira rodada.**
A falha era um 400 de transação sob carga em 6 pedidos simultâneos. Corrigido (409 com
mensagem clara) e revalidado na bateria de interface (24 pedidos simultâneos sem
nenhum erro fora de 200/409).

| Cenário | Resultado |
|---|---|
| A. Antes da entrada | `ocupacao = sem_entrada`; cancela sem código; reserva `Cancelada`, vaga `Livre`, reembolso `Pendente` de R$ 60,00 (85 pagos − 25 de garantia); `saidaEm` nulo e `horaSaida` planejada preservada; `POST /reembolso` equivalente; código de saída não pode ser gerado |
| B. Durante a ocupação | Entrada grava `entradaEm`; sem código, recusado; código inválido recusado e **nada liberado**; outro cliente recebe 403; código correto registra `saidaEm`, libera a vaga e cria o reembolso pelas regras existentes |
| C. Após a saída | Repetir a saída: 409, sem novo reembolso; `POST /reembolso`: 409 sem pedir código; `/sair` grava `saidaEm` e `ocupacao = saiu` |
| D. Burlar pela API | `POST /reembolso` durante a ocupação: 409; nem a equipe cria reembolso sem sair; `confirmar-saida` sem código: 400; sem login: 401; `Ativa` legada sem `entradaEm` continua exigindo código; estorno total do admin segue funcionando |
| E. Duplicadas e simultâneas | 6 saídas com código, 6 cancelamentos sem entrada e 6 `POST /reembolso` simultâneos: exatamente 1 vence, 1 reembolso, vaga livre, sem erro 500 |

**Interface (Chrome headless, sessões reais): 33 de 33.** Cliente sem entrada: aviso
verde, nenhum campo de código, cancelamento direto e banco correto. Cliente ocupando:
aviso âmbar, campo de código, mensagem para campo vazio e para código inválido, banco
intacto após o erro, "Saída confirmada" com o código certo. Cliente que já saiu:
mensagem sem código. Celular (390 px): sem rolagem horizontal. Telas do pátio
(funcionário e administrador): "Código de saída" só na reserva ocupando.

**Integridade:** depois da limpeza, `ReservaCli`, `Reserva`, `Vaga`, `Reembolso` e
`Pagamento` ficaram idênticos ao snapshot, exceto as colunas novas.

## 10. Mudanças de comportamento

- `POST /reembolso` de quem ainda não entrou agora **também cancela a reserva e libera a vaga** (antes só criava o pedido e deixava a reserva viva).
- O botão de saída de `ReserDetalhe` e o "Código de saída" das listas do pátio deixam de aparecer para quem não entrou. O cliente cancela sozinho, sem código.
- Cancelar antes da entrada não sobrescreve mais `horaSaida` (horário planejado).

## 11. Como aplicar em outro ambiente

`npx prisma migrate deploy` e depois `npx prisma generate` (API parada no Windows).
Reiniciar a API. Não usar `migrate dev` neste banco.

## 12. Pendências e riscos

1. **Códigos de entrada e saída continuam públicos** (você optou por não alterar agora):
   - `GET /reservacli` sem login devolve `codigoSaida` e `codigoPresenca`;
   - `POST /:id/codigo-saida` e `/codigo-presenca` não exigem login;
   - o WebSocket entrega o código a quem entrar na sala da reserva.
   Enquanto isso valer, um cliente técnico consegue ler o próprio código. A exigência
   de saída fica forte contra o fluxo comum e contra `POST /reembolso`, mas **não** contra
   quem lê o código na API. Recomendado tratar em seguida.
2. O código de 6 dígitos não tem limite de tentativas.
3. **"Encerrar" do pátio** usa `PUT /reserva/:id` e `PUT /vaga/:id`, rotas sem login que
   liberam a vaga sem passar por este fluxo (nem registram `saidaEm`).
4. Reservas encerradas antes desta migration não têm `entradaEm` nem `saidaEm`.
5. A promoção automática para `Ativa` quando a vaga já consta como `Ocupada`
   (`atrasoservice.js`) não grava `entradaEm`. A regra trata esse caso como ocupando.
6. Códigos antigos ficaram gravados em 3 reservas já `Concluída` (não alterado).
7. `Cobranca.ocupando` e `Presenca.ocupando` repetem uma regra de 3 linhas no front,
   só para exibição, porque as telas do pátio e do cliente carregam scripts diferentes.
