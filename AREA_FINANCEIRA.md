# Área financeira — auditoria, correção e organização

## 1. Resumo

A área financeira (taxa de reserva, tempo extra, reembolsos, faturamento e painéis)
foi auditada no front end, no back end e no banco. O servidor passou a ser a
**fonte da verdade** dos valores: o front não envia mais preço, taxa nem valor de
estorno que o servidor aceite sem conferir. Os endpoints financeiros agora exigem
login, e o histórico financeiro ficou protegido por regras no banco.

Nenhum registro financeiro existente foi alterado em valor, apagado ou recriado.
A única mudança em dados existentes foi o preenchimento das duas colunas novas de
`Pagamento` (seção 8), verificado contra um snapshot.

## 2. Diagnóstico (como era)

- Valores calculados e "gravados" pelo front (`TAXA_PADRAO` fixo, valores de estorno
  enviados pelo navegador). O servidor aceitava o que chegasse.
- Endpoints `/pagamento`, `/reembolso` e parte de `/reservacli` **sem autenticação**.
- Reserva feita em 3 chamadas separadas (reserva, reserva do cliente, pagamento):
  se uma falhasse, sobrava registro órfão ou vaga presa.
- `Pagamento` sem data real e sem categoria: não dava para saber o que era taxa e o
  que era tempo extra, e o indicador "Hoje" mostrava sempre R$ 0,00.
- Quando o POST de pagamento falhava (400), o front gravava no `localStorage` e
  seguia como se tivesse dado certo. Estornos e pendências também ficavam só no
  navegador.
- `TelaFaturamento` chamava uma função inexistente (`soma()`), então a tela nunca
  renderizava.
- A senha (texto puro) vazava nas respostas de `/pagamento`, `/reservacli` e `/reserva`.

## 3. Problemas encontrados

### Críticos
1. API financeira sem autenticação nem controle de perfil.
2. Valores de pagamento e estorno definidos pelo cliente.
3. Reserva não atômica (risco de cobrança sem reserva ou reserva sem cobrança).
4. Vazamento da senha dos usuários nas respostas.
5. Registros financeiros "falsos" no `localStorage` (fallback silencioso).

### Altos
6. Cobrança em duplicidade: tempo extra registrado pelo funcionário e depois cobrado de novo em `/sair`.
7. Reembolso duplicado para a mesma reserva e pedido decidido várias vezes.
8. Sem categoria/data em `Pagamento` (relatórios e "Hoje" incorretos).
9. Sem restrições no banco (valor ≤ 0, estorno maior que o pago etc.).

### Médios
10. `TelaFaturamento` quebrada (`soma()` indefinida); mês/ano sem recarregar dados.
11. Regras de cobrança duplicadas em vários arquivos (`GARANTIA`, tolerância, arredondamento).
12. Erros do Prisma expostos ao cliente.
13. Somas em `Float` sem arredondamento controlado.

### Baixos
14. Campos fantasma no front (`taxa.metodo`, `taxa.data`).
15. Textos "modo local" em telas que já dependiam da API.

## 4. Correções feitas

| # | Correção |
|---|---|
| 1 | Token assinado (HMAC-SHA256, 12 h) e middleware `autenticar`/`exigirPerfil`. Cliente só vê o que é seu. |
| 2, 3 | Novo `POST /reservacli/reservar`: preço calculado no servidor, vaga travada de forma atômica, reserva + reserva do cliente + taxa numa única transação. `valorEsperado` opcional: se divergir, 409 com `valorCorreto`. |
| 4 | `usuario: { omit: { senha: true } }` nas consultas financeiras e de reserva. |
| 5 | Removido fallback de `localStorage` para pagamentos e estornos; erro de API aparece como erro. |
| 6 | `/sair` cobra só o `emAberto` (`resumoDeCobranca`), descontando o que a equipe já recebeu. |
| 7 | Reembolso com valor sempre calculado no servidor; um ativo por reserva; decisão única (Pendente → Aprovada/Recusada). |
| 8, 9 | Migration com `categoria`, `criadoEm` e restrições (seção 8). |
| 10 | `TelaFaturamento` reescrita sobre `GET /pagamento` e `GET /pagamento/resumo`. |
| 11 | Regras centralizadas em `cobrancaservice.js`. |
| 12 | `responderErro` traduz erros (P2002→409, P2025→404, P2003→400) sem expor internals. |
| 13 | Valores mantidos em `Float`, somados em centavos inteiros e arredondados a 2 casas no servidor. |

## 5. Melhorias de organização

- `src/auth.js`: token, autenticação, perfis e tratamento de erro HTTP.
- `src/services/cobrancaservice.js`: único lugar com as regras (garantia R$ 25, tolerância de 10 min, valor por minuto = preço/hora ÷ 60, estorno, tempo extra, resumo de cobrança).
- `front-end/Base/JS/auth.js`: envia o `Authorization` automaticamente e trata sessão expirada (401).
- `cobranca.js` no front ficou apenas para **exibição** (o servidor decide o valor).

## 6. Arquivos alterados e justificativa

### Back end
| Arquivo | Motivo |
|---|---|
| `src/auth.js` (novo) | Autenticação/perfis/erros |
| `src/services/cobrancaservice.js` (novo) | Regras de cobrança centralizadas |
| `src/services/pagamentoservice.js`, `controller/pagamentoController.js` | Pagamentos validados, resumo, sem exclusão |
| `src/services/reembolsoservice.js`, `controller/reembolsoController.js` | Estorno calculado no servidor, decisão única |
| `src/services/reservacliservice.js`, `controller/reservaCliController.js` | `reservar` atômico, `/sair` e `/confirmar-saida` protegidos, campo `cobranca` |
| `src/services/atrasoservice.js` | Passa a usar `cobrancaservice.js` |
| `src/services/reservaservice.js` | Exceção pontual (fora do escopo "só financeiro"): vazamento de senha |
| `src/controller/usuariocontroller.js`, `funcionarioController.js` | Login devolve `token` |
| `src/server.js` | CORS aceita `Authorization` |
| `prisma/schema.prisma` + migration `20261118120000_financeiro_integridade` | `categoria`, `criadoEm` e restrições |

### Front end
`Base/JS/auth.js` (novo, incluído em 17 telas) e as telas `TelaPagamentos`,
`TelaPagamentosTempo` (admin e funcionário), `TelaReembolsos`, `TelaFuncReembolsos`,
`TelaFaturamento`, `TelaADM`, `TelaPagamentoTaxa`, `TelaReembolso`, `TelaReserAndamento`.
Demais telas apenas receberam `auth.js`.

## 7. Mudanças por camada

- **Front:** valores vêm do servidor; sem `TAXA_PADRAO`; sem fallback local para pagamentos/estornos; faturamento por período vindo da API; indicador "Hoje" real; escape de HTML na tabela de faturamento.
- **Back:** autenticação, validação, transações (Serializable no pagamento), controle de concorrência (`updateMany` condicional), resumo financeiro.
- **Banco:** ver seção 8.

## 8. Banco de dados

Migration: `20261118120000_financeiro_integridade` (aplicada com `prisma migrate deploy`).

| Item | Detalhe |
|---|---|
| `Pagamento.categoria` | `taxa` (padrão) \| `tempo_extra` \| `ajuste` |
| `Pagamento.criadoEm` | Data real do pagamento (padrão `now()`), com índice |
| Restrições | `valor > 0`; categoria válida; **uma** `taxa` por reserva (índice único parcial) |
| `Reembolso` | `valorDevolver ≥ 0` e `≤ pago`; status ∈ `Pendente/Aprovada/Recusada`; **um** reembolso ativo por reserva |

**Dados existentes (backfill):** reservas com mais de um pagamento mantêm como `taxa`
o menor pagamento com valor ≥ 25 e os demais viram `tempo_extra` (2 linhas: R$ 3,00
e R$ 368,83). `criadoEm` = início da reserva (taxa) ou `horaSaida` (tempo extra).
**Verificação:** 24 → 24 pagamentos, 0 divergências de valor/nome/tipo/reserva,
13 reembolsos idênticos, categorias `{taxa: 22, tempo_extra: 2}`.

Aplicar em outro ambiente: `npx prisma migrate deploy` e depois `npx prisma generate`
(API parada no Windows). **Não** usar `migrate dev` neste banco.

## 9. Regras de negócio

**Corrigidas:** valor sempre definido no servidor; uma taxa por reserva; um reembolso ativo por reserva; tempo extra não cobrado duas vezes; pedido de reembolso decidido uma única vez; pagamentos não são excluídos (`DELETE` → 405).

**Preservadas:** taxa = minutos reservados × (preço/hora ÷ 60) + garantia fixa R$ 25; cancelamento/saída antecipada devolve os minutos não usados (garantia não é devolvida); tempo extra cobrado após `horaSaida` + 10 min de tolerância, apenas com reserva `Ativa`; fluxo de status Reservada → Tolerância → Atraso → Cancelada / Ativa → Concluída.

## 10. Endpoints afetados

Todos exigem `Authorization: Bearer <token>`.

| Endpoint | Perfil | Observação |
|---|---|---|
| `POST /reservacli/reservar` | cliente | novo; atômico; 409 se valor divergir/vaga ocupada/reserva em andamento |
| `POST /reservacli/:id/sair` | dono ou equipe | cobra só o em aberto; 409 se já encerrada |
| `POST /reservacli/:id/confirmar-saida` | dono ou equipe | idem |
| `GET /reservacli`, `/:id` | — | ganham campo aditivo `cobranca`; sem senha |
| `POST /pagamento` | admin/funcionário | valor calculado no servidor |
| `GET /pagamento`, `/:id` | logado | cliente vê só os seus; filtros `mes`, `ano`, `categoria` |
| `GET /pagamento/resumo` | equipe | totais, período anterior, crescimento, hoje, geral |
| `PUT /pagamento/:id` | admin | só `tipo`/`nome` |
| `DELETE /pagamento/:id` | — | 405 |
| `POST /reembolso` | logado | valor ignorado do corpo; `estornoTotal` só admin |
| `GET /reembolso`, `/:id` | logado | cliente vê só os seus |
| `PUT /reembolso/:id` | admin/funcionário | só Pendente → Aprovada/Recusada |
| `DELETE /reembolso/:id` | — | 405 |
| `POST /usuario/login`, `/funcionario/login` | público | resposta inclui `token` |

## 11. Testes e resultados

- **Back end (API real, dados temporários removidos depois):** 401 sem/forjado; 403 por perfil; isolamento entre clientes; 405 nos `DELETE`; validações sem texto do Prisma; reserva atômica (valorEsperado, vaga travada, uma reserva em andamento por usuário, condição de corrida); reembolsos com valor do servidor e decisão única; `resumo` igual à soma direta no banco; período vazio com zeros e crescimento `null`; tempo extra sem cobrança dupla; estorno total. Dados reais idênticos ao snapshot após a limpeza. **Todos passaram.**
- **Front end (Chrome headless, sessões reais):** 53 verificações OK. Cobre faturamento (cards, linhas e período vazio iguais ao servidor), taxas (total geral e "Estornada" vindos do banco), tempo (admin/funcionário), reembolsos (admin/funcionário/cliente), painel ADM (cards = resumo), pátio, painel do funcionário, reservas em andamento, sessão sem token (aviso + limpeza + login), sem sessão e cliente em tela de admin. Sem exceções, erros de console ou `alert()` inesperado.
- Uma verificação do E2E ("13 pedidos") falhou por expectativa errada do teste: a tela filtra por "Pendentes" por padrão (mostra "5 de 13"), e o 13 coincide com a API.
- **Não testado pela interface:** os fluxos que gravam dados reais (reservar pela `TelaPagamentoTaxa`, confirmar taxa/estornar/cobrar tempo, encerrar pela `TelaCheckoutEncerrar`) foram validados pela API, não clicando nas telas, para não criar registros financeiros no banco real. Recomenda-se um teste manual de cada um.

## 12. Pendências

1. **Senhas em texto puro** no banco (comparação direta no login).
2. Rotas **sem autenticação** fora do escopo financeiro: `POST/PUT/DELETE /reservacli` (o `PUT` pode alterar `horaSaida` e, portanto, a cobrança), `/reserva`, `/vaga` etc. O fluxo de prorrogação não foi auditado.
3. `onDelete: Cascade` em `Pagamento`/`Reembolso`: apagar reserva, usuário ou estacionamento apaga o histórico financeiro. Não alterado, porque a exclusão de estacionamento depende das cascatas.
4. Funcionário não é limitado ao seu estacionamento no servidor (só filtro no front).
5. Pendências de cobrança de tempo extra continuam só no navegador (não há tabela).
6. **4 registros órfãos em `Reserva`** (sem `ReservaCli`), um deles `Ativa` com a vaga 67 `Ocupada`. Não foram tocados; aguardam sua decisão.
7. Backfill de `categoria` (2 linhas) é heurístico; `criadoEm` das taxas antigas é aproximado pelo início da reserva.
8. `cobranca.js` no front ainda repete as regras (só exibição).

## 13. Riscos e recomendações

- **Sessões antigas não têm token:** todos precisam entrar de novo (a tela avisa e redireciona).
- Defina `AUTH_SECRET` no `.env` de produção. Sem ele, o segredo é derivado de `DATABASE_URL`.
- Reinicie a API após atualizar (não há nodemon).
- Valores continuam em `Float`. Estão arredondados a 2 casas e somados em centavos, mas o ideal a médio prazo é `Decimal`.
- Próximos passos recomendados: hash de senha (bcrypt) e proteger as rotas restantes, trocar `Cascade` por `Restrict` nas tabelas financeiras, tabela para as pendências de cobrança e decidir sobre os órfãos.
