# Avatar dos usuários

## 1. Resumo

O personagem (avatar) escolhido pelo usuário agora é salvo no banco de dados
(`Usuario.avatar`) e aparece ao lado do nome dele nas telas do sistema.
O avatar é **opcional**: quem não escolheu usa o sistema normalmente e é mostrado
com um círculo com as iniciais do nome.

## 2. Como era antes

- Havia 20 personagens (`f1`–`f10`, `m1`–`m10`) desenhados em SVG por JavaScript,
  **dentro** de `Usuario/HTML/TelaUsuario.html`.
- A escolha ficava só no navegador (`localStorage["vagaconnect-avatar-<id>"]`):
  mudava de navegador/computador e sumia, e nenhuma outra tela conseguia usá-la.

## 3. Como é agora

- O banco guarda só o **código** do personagem (ex.: `"f3"`), nunca imagem.
- `TelaUsuario` grava e lê o avatar pela API. Recarregar a página ou entrar em outro
  navegador mantém a escolha. Escolher outro personagem **substitui** o anterior;
  "Remover personagem" volta o campo para `NULL`.
- O desenho dos personagens foi movido para um módulo compartilhado
  (`Base/JS/avatar.js`), usado pela tela de escolha e pelas demais telas.
- A escolha antiga feita só no navegador **não se perde**: na primeira visita à
  `TelaUsuario`, se o banco está sem avatar e existe uma escolha local, ela é enviada
  ao banco uma vez e a chave local é apagada.

## 4. Banco de dados

| Item | Detalhe |
|---|---|
| Campo | `Usuario.avatar String?` (**opcional**, sem valor padrão) |
| Migração | `back-end/tcc/prisma/migrations/20261117230000_add_avatar_usuario/migration.sql` |
| SQL | `ALTER TABLE "Usuario" ADD COLUMN "avatar" TEXT;` |
| Impacto | Nenhum dado alterado ou apagado. Usuários existentes ficam com `NULL`. |

Aplicar em outro ambiente: `npx prisma migrate deploy` e depois `npx prisma generate`
(com a API parada, no Windows, para o `generate` conseguir sobrescrever o client).

## 5. API

**Rota nova** (o `PUT /usuario/:id` existente **não foi alterado**):

```
PUT /usuario/:id/avatar
body: { "avatar": "f3" }     -> escolhe/substitui
body: { "avatar": null }     -> remove
```

- Valida o formato `^[fm](10|[1-9])$`. Valor inválido: `400 { erro: "Avatar inválido" }`.
- Usuário inexistente: `404 { erro: "Usuário não encontrado" }`.
- Responde com o usuário atualizado, sem a senha.

O campo `avatar` chega ao front automaticamente em login, `GET /usuario`,
`GET /usuario/:id`, e nos endpoints que já incluíam `usuario: true`
(`/reservacli`, `/reserva`, `/pagamento`). Foi preciso adicioná-lo aos `select`
de `reembolsoservice.js` e `feedbackservice.js`.

## 6. Arquivos modificados

### Back-end
| Arquivo | Alteração |
|---|---|
| `prisma/schema.prisma` | Campo `avatar String?` em `Usuario`. |
| `prisma/migrations/20261117230000_add_avatar_usuario/` | Migração (nova). |
| `src/services/usuarioservice.js` | `atualizarAvatar` + validação do código. |
| `src/controller/usuariocontroller.js` | Rota `PUT /:id/avatar`. |
| `src/services/reembolsoservice.js` | `avatar: true` no `select` de `usuario`. |
| `src/services/feedbackservice.js` | `avatar: true` nos `select` de `usuario` (e `avatar` na avaliação pública). |

### Front-end — base compartilhada (novos)
| Arquivo | Função |
|---|---|
| `Base/JS/avatar.js` | Dados e desenho dos 20 personagens (código movido da `TelaUsuario`, sem alteração de lógica) + `Avatar.tag(usuario, tamanho)`. |
| `Base/CSS/avatar.css` | Tamanhos (`.av`, `.av-p`, `.av-g`), círculo de iniciais (`.av-vazio`) e `.av-linha` (avatar + texto lado a lado). |

### Front-end — telas
| Tela | O que mudou |
|---|---|
| `Usuario/HTML/TelaUsuario.html` | Removeu o código dos personagens (agora em `avatar.js`); salva/lê pela API; migra a escolha local; atualiza `usuarioLogado` na sessão. |
| `Usuario/HTML/TelaFeedbacks.html` | Avatar nas avaliações dos outros usuários. |
| `Administrador/HTML/TelaUsuarios.html` | Avatar na lista de usuários. |
| `Administrador/HTML/TelaReservas.html`, `TelaADM.html` | Avatar na coluna do cliente. |
| `Administrador/HTML/ReserDetalhe.html` | Avatar em "Dados do Cliente". |
| `Administrador/HTML/TelaPagamentos.html`, `TelaPagamentosTempo.html`, `TelaReembolsos.html` | Avatar na célula do cliente. |
| `Administrador/HTML/TelaFeedback.html` | Avatar do autor de cada avaliação. |
| `Administrador/JS/TelaFuncProrrogacoes.js` + `Administrador/HTML/TelaProrrongações.html`, `Funcionario/HTML/TelaFuncProrrongações.html` | Avatar na célula do cliente (o mesmo JS serve às duas telas). |
| `Funcionario/HTML/TelaFunc.html` | Mostra o personagem no lugar das iniciais **só se** o cliente tem avatar; senão mantém o visual atual. |
| `Funcionario/HTML/TelaFuncReservas.html`, `TelaFuncPagamentos.html`, `TelaPagamentosTempo.html`, `TelaFuncReembolsos.html` | Avatar na célula do cliente. |

Nas telas acima só foram adicionados `avatar.css`/`avatar.js` e a chamada
`Avatar.tag(...)` junto ao nome. O restante do layout não foi tocado.

## 7. Regras do avatar opcional

- Banco: `NULL` = sem avatar. Cadastro e edição de usuário **não mudaram** e não exigem avatar.
- `Avatar.tag(usuario)` aceita `null`, `undefined`, avatar `null`/vazio/inválido
  (`"x1"`, `"f11"`, número…) sem erro e nesses casos mostra as **iniciais**
  ("Maria Santos" → `MS`; sem nome → `?`).
- Na `TelaUsuario` quem não tem avatar continua vendo o ícone padrão e o texto
  "Escolher personagem".
- Nomes são escapados antes de entrar no HTML do avatar.

## 8. Testes realizados

**API (contra o banco real, com restauração ao final):**
- Escolher `f3`, depois `m10`: o segundo substitui o primeiro; `GET /usuario/:id` confirma. OK
- `{ "avatar": null }` e `{}` remove. OK
- Inválidos `x1`, `f11`, `f0`, `5` → 400; usuário inexistente → 404. OK
- Resposta nunca traz `senha`. OK
- Avatar `m4` aparece em `/reservacli`, `/reserva`, `/usuario`, `/usuario/:id`, `/pagamento`,
  `/reembolso`, `/feedback`. OK
- `PUT /usuario/:id` existente continua com status 200 e não altera o avatar. OK
- Ao final, os 10 usuários voltaram a `avatar = NULL`.

**Front-end:**
- `node --check` em todos os scripts das 17 telas alteradas e em `avatar.js` e
  `TelaFuncProrrogacoes.js`: sem erro de sintaxe. OK
- `avatar.js` carregado antes do primeiro script de cada tela. OK
- Teste do `Avatar.tag` em Node (15 verificações): nulo, indefinido, vazio, códigos
  inválidos, HTML no nome, 20/20 personagens desenhados, ids de gradiente únicos
  quando há vários avatares na mesma página, tamanhos. OK

## 9. Limitações e pontos de atenção

- **Não foi feito teste visual em navegador** (não havia como abrir as telas neste
  ambiente). Vale conferir alinhamento e responsividade nas telas listadas, nos
  modos escuro e claro, e o fluxo: escolher personagem → atualizar a página →
  remover personagem → entrar com usuário sem avatar.
- `Base/JS/presenca.js` (janelas "Cliente chegou") **não** mostra avatar: é um arquivo
  compartilhado entre fluxos de funcionário e de usuário e o nome ali é só texto.
- Não tem avatar: as barras laterais "A"/"F" (administrador/funcionário, que não têm
  o campo) e os depoimentos de exemplo de `Base/HTML/Abertura.html`.
- Os personagens estão com `nome: ""` no código original, por isso a legenda da
  `TelaUsuario` aparece como "· trocar". Não alterado (fora do escopo).
- As rotas da API não têm autenticação (padrão do projeto): quem souber o `id`
  consegue trocar o avatar dele.
- Problema pré-existente, **não alterado**: `GET /usuario` devolve o campo `senha`
  de todos os usuários. Recomendado corrigir à parte.
- O banco Neon possui 4 migrações que não estão na pasta local
  (`vaga_estacionamento_cascade`, `funcionario_estacionamento_cascade`,
  `estacionamento_apaga_endereco`, `reserva_cascade`). Por isso a migração foi aplicada
  com `migrate deploy` (nunca `migrate dev`, que poderia pedir reset).
