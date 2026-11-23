// Agendamento de vagas: fonte única da verdade (back-end).
//
// Conceitos (sem campos novos, tudo sai do que já existe):
//
//   agendamento futuro  Reserva 'Reservada' com hora > agora. A vaga continua Livre.
//   reserva ativa       hora chegou: a vaga passa a 'Reservada' (ativarAgendamentos).
//   ocupação efetiva    Reserva 'Ativa' (entrada confirmada): vaga 'Ocupada'.
//   cancelada/concluída não bloqueiam horário nenhum.
//
// JANELA DE BLOQUEIO de cada reserva em andamento (fonte única da regra):
//
//     [ hora - 24 h  ,  horaSaida + 10 min ]
//
//   - começo: 24 h ANTES do horário agendado (margem de segurança operacional);
//   - fim: a saída contratada + tolerância de saída (gratuita, mas a vaga ainda é
//     de quem está saindo). Quem está 'Ativa' e passou do prazo continua dono da
//     vaga até sair: o bloqueio vai até agora.
//
// Duas reservas conflitam quando as janelas se cruzam. A regra vale para as duas
// pontas (a nova também protege as 24 h antes do próprio início), então, na prática,
// a próxima reserva só pode começar 24 h depois do fim da anterior (+ tolerância).
//
// A margem é só operacional: não muda a duração contratada, o valor pago nem gera
// cobrança. Cancelada/Concluída não bloqueiam nada.

import prismaClient from '../prisma/index.js'
import { STATUS_EM_ANDAMENTO, TOLERANCIA_SAIDA_MS } from './cobrancaservice.js'
import { erroHttp } from '../auth.js'
import { STATUS_AGUARDANDO_CHEGADA } from './ocupacaoservice.js'

// Margem de segurança antes do início de cada reserva (operacional, nunca cobrada)
export const MARGEM_SEGURANCA_MS = 24 * 60 * 60 * 1000


function ms(valor) {
  const t = new Date(valor).getTime()
  return isNaN(t) ? null : t
}


// Quando a reserva libera a vaga (com a tolerância de saída)
function fimDoBloqueio(item, agoraMs) {
  const inicio = ms(item.hora)
  const saida = ms(item.horaSaida)

  let fim = saida === null ? inicio : saida + TOLERANCIA_SAIDA_MS

  // quem está dentro e passou do prazo ainda ocupa a vaga: o bloqueio vai até agora
  if (item.reserva?.status === 'Ativa' && fim < agoraMs) fim = agoraMs

  return fim
}


// Procura uma reserva em andamento, na mesma vaga, que cruze o período pedido.
// `cliente` pode ser o prisma ou o tx de uma transação.
// `margemMs` existe só para a prorrogação de reservas antigas (ver atualizarReservaCli).
export async function buscarConflito(cliente, {
  vagaId,
  inicio,
  fim,
  ignorarReservaCliId = null,
  agora = new Date(),
  margemMs = MARGEM_SEGURANCA_MS
}) {
  const lista = await carregarReservasDaVaga(cliente, vagaId, ignorarReservaCliId)

  return acharConflito(lista, { inicio, fim, agora, margemMs })
}


// Reservas em andamento da vaga (as únicas que bloqueiam horário)
async function carregarReservasDaVaga(cliente, vagaId, ignorarReservaCliId = null) {
  return cliente.reservaCli.findMany({
    where: {
      reserva: { fk_vaga: vagaId, status: { in: STATUS_EM_ANDAMENTO } },
      ...(ignorarReservaCliId ? { id: { not: ignorarReservaCliId } } : {})
    },
    select: {
      id: true,
      hora: true,
      horaSaida: true,
      reserva: { select: { status: true } }
    }
  })
}


// A regra de conflito em si (sem acesso ao banco): usada pela reserva, pela consulta
// de disponibilidade e pela lista de durações, sempre igual.
function acharConflito(lista, { inicio, fim, agora = new Date(), margemMs = MARGEM_SEGURANCA_MS }) {
  const novoInicio = ms(inicio)
  // o novo período também precisa de folga (tolerância) antes da próxima reserva
  const novoFim = ms(fim) + TOLERANCIA_SAIDA_MS
  const agoraMs = new Date(agora).getTime()

  for (const item of lista) {
    const ini = ms(item.hora)
    const fimItem = fimDoBloqueio(item, agoraMs)

    if (ini === null || fimItem === null) continue

    // janelas de bloqueio: começam `margemMs` antes do início de cada reserva
    if (novoInicio - margemMs < fimItem && ini - margemMs < novoFim) {
      // sobreposição real (sem a margem) ou só invasão da margem de 24 h?
      const sobrepoe = novoInicio < fimItem && ini < novoFim

      return {
        reservaCliId: item.id,
        tipo: sobrepoe ? 'sobreposicao' : 'margem_24h',
        inicio: new Date(ini).toISOString(),
        bloqueioInicio: new Date(ini - margemMs).toISOString(),
        fim: new Date(fimItem).toISOString()
      }
    }
  }

  return null
}


// =====================================================
// DURAÇÃO DA RESERVA
//
// O cliente escolhe a duração (não digita a saída). Ela vale quando é um número
// inteiro de minutos, múltiplo de 30, entre 30 min e 24 h. O servidor calcula a saída
// (início + duração) e o valor; nada disso é confiado ao que vem da tela.
// A duração não fica em coluna própria: continua sendo horaSaida - hora.
// =====================================================
export const DURACAO_PASSO_MIN = 30
export const DURACAO_MINIMA_MIN = 30
export const DURACAO_MAXIMA_MIN = 24 * 60

export function opcoesDeDuracao() {
  const lista = []

  for (let m = DURACAO_MINIMA_MIN; m <= DURACAO_MAXIMA_MIN; m += DURACAO_PASSO_MIN) {
    lista.push(m)
  }

  return lista
}


// Devolve a duração em minutos ou lança 400
export function validarDuracao(valor) {
  if (valor === undefined || valor === null || valor === '') {
    throw erroHttp(400, 'Escolha o tempo de utilização da vaga.')
  }

  // só número inteiro (ou texto com dígitos): nada de 1.5, "1h", NaN, notação científica...
  const valido =
    (typeof valor === 'number' && Number.isInteger(valor)) ||
    (typeof valor === 'string' && /^\d+$/.test(valor.trim()))

  const minutos = valido ? Number(valor) : NaN

  if (!Number.isFinite(minutos)) {
    throw erroHttp(400, 'Tempo de utilização inválido. Escolha uma das opções da lista.')
  }

  if (minutos % DURACAO_PASSO_MIN !== 0) {
    throw erroHttp(400, `O tempo de utilização precisa ser em intervalos de ${DURACAO_PASSO_MIN} minutos.`)
  }

  if (minutos < DURACAO_MINIMA_MIN) {
    throw erroHttp(400, `O tempo mínimo de utilização é de ${DURACAO_MINIMA_MIN} minutos.`)
  }

  if (minutos > DURACAO_MAXIMA_MIN) {
    throw erroHttp(400, 'O tempo máximo de utilização é de 24 horas.')
  }

  return minutos
}


// =====================================================
// HORÁRIO DE ENTRADA
//
// O cliente escolhe a entrada em uma lista de 30 em 30 minutos (00:00, 00:30, 01:00...).
// O servidor não aceita outro minuto: reserva só começa em hora cheia ou meia hora.
// (os fusos do Brasil têm hora inteira de diferença, então vale em UTC e no horário local)
// =====================================================
export const ENTRADA_PASSO_MIN = 30

const TOLERANCIA_PASSADO_MS = 10 * 60 * 1000

// Devolve a Date da entrada ou lança 400
export function validarHorarioEntrada(valor) {
  const data = new Date(valor)

  if (valor === undefined || valor === null || valor === '' || isNaN(data.getTime())) {
    throw erroHttp(400, 'Escolha o horário de entrada.')
  }

  const passo = ENTRADA_PASSO_MIN * 60000

  if (data.getTime() % passo !== 0) {
    throw erroHttp(400, `O horário de entrada precisa ser em intervalos de ${ENTRADA_PASSO_MIN} minutos (por exemplo 08:00 ou 08:30).`)
  }

  return data
}


// A entrada não pode estar no passado nem cair numa vaga ocupada agora
function motivoDoInicio(vaga, inicioMs, agora) {
  if (inicioMs < agora.getTime() - TOLERANCIA_PASSADO_MS) return 'passado'

  if (inicioMs <= agora.getTime() && vaga.status !== 'Livre') return 'ocupada_agora'

  return null
}


// Horários de entrada (de 30 em 30 min) entre `de` e `ate` (ISO) e se a vaga está livre
// em cada um. "Livre" = cabe ao menos a duração mínima (30 min) pela MESMA regra de
// conflito da reserva (reservas existentes e margem de 24 h). Horários que já passaram
// não entram na lista.
export async function listarHorarios(vagaId, de, ate, ignorarReservaCliId = null) {
  const vaga = await prismaClient.vaga.findUnique({ where: { id: vagaId } })

  if (!vaga) throw erroHttp(404, 'Vaga não encontrada.')

  const inicio = ms(de)
  const fim = ms(ate)

  if (inicio === null || fim === null || fim <= inicio) {
    throw erroHttp(400, 'Informe o período dos horários (de/ate).')
  }

  // um dia (com folga) por consulta: evita listas gigantes
  if (fim - inicio > 48 * 60 * 60 * 1000) {
    throw erroHttp(400, 'Consulte no máximo 48 horas por vez.')
  }

  const agora = new Date()
  const lista = await carregarReservasDaVaga(prismaClient, vagaId, ignorarReservaCliId)
  const passo = ENTRADA_PASSO_MIN * 60000
  const horarios = []

  // primeiro horário em ponto/meia hora a partir de `de`
  for (let t = Math.ceil(inicio / passo) * passo; t < fim; t += passo) {
    const motivo = motivoDoInicio(vaga, t, agora)

    if (motivo === 'passado') continue

    if (motivo) {
      horarios.push({ inicio: new Date(t).toISOString(), disponivel: false, motivo, conflito: null })
      continue
    }

    const conflito = acharConflito(lista, {
      inicio: new Date(t),
      fim: new Date(t + DURACAO_MINIMA_MIN * 60000),
      agora
    })

    horarios.push(conflito
      ? { inicio: new Date(t).toISOString(), disponivel: false, motivo: conflito.tipo, conflito }
      : { inicio: new Date(t).toISOString(), disponivel: true, motivo: null, conflito: null })
  }

  return { passoMinutos: ENTRADA_PASSO_MIN, horarios }
}


// Quais durações cabem na vaga para quem chega em `inicio`.
// Cada opção passa pela MESMA regra de conflito da reserva (reservas existentes e
// margem de 24 h), então o que a tela oferece é o que o servidor aceita.
export async function listarDuracoes(vagaId, inicio, ignorarReservaCliId = null) {
  const vaga = await prismaClient.vaga.findUnique({ where: { id: vagaId } })

  if (!vaga) throw erroHttp(404, 'Vaga não encontrada.')

  const ini = ms(inicio)

  if (ini === null) throw erroHttp(400, 'Informe o horário de chegada.')

  const agora = new Date()
  const lista = await carregarReservasDaVaga(prismaClient, vagaId, ignorarReservaCliId)

  const motivoInicio = motivoDoInicio(vaga, ini, agora)

  const opcoes = opcoesDeDuracao().map((minutos) => {
    if (motivoInicio) return { minutos, disponivel: false, motivo: motivoInicio, conflito: null }

    const conflito = acharConflito(lista, {
      inicio: new Date(ini),
      fim: new Date(ini + minutos * 60000),
      agora
    })

    return conflito
      ? { minutos, disponivel: false, motivo: conflito.tipo, conflito }
      : { minutos, disponivel: true, motivo: null, conflito: null }
  })

  return {
    passoMinutos: DURACAO_PASSO_MIN,
    minimoMinutos: DURACAO_MINIMA_MIN,
    maximoMinutos: DURACAO_MAXIMA_MIN,
    inicio: new Date(ini).toISOString(),
    opcoes
  }
}


export function erroConflito(conflito) {
  const mensagem = conflito?.tipo === 'margem_24h'
    ? 'Esta vaga tem outra reserva próxima desse horário. Cada reserva protege a vaga por 24 horas antes do início, então a nova reserva precisa ficar a pelo menos 24 horas de distância. Escolha outro horário ou outra vaga.'
    : 'Esta vaga já tem uma reserva que cruza com este horário. Escolha outro horário ou outra vaga.'

  const erro = erroHttp(409, mensagem)
  erro.conflito = conflito
  return erro
}


// Qual reserva está com a vaga AGORA (ou null).
//   1. quem está dentro (Ativa, ou entrada sem saída) tem a vaga;
//   2. senão, a mais antiga que já chegou na hora marcada (vaga ativada).
// Agendamentos futuros nunca seguram a vaga.
export async function quemSegura(cliente, vagaId, agora = new Date()) {
  const lista = await cliente.reservaCli.findMany({
    where: { reserva: { fk_vaga: vagaId, status: { in: STATUS_EM_ANDAMENTO } } },
    select: {
      id: true,
      hora: true,
      entradaEm: true,
      saidaEm: true,
      reserva: { select: { status: true } }
    },
    orderBy: { hora: 'asc' }
  })

  const dentro = lista.find((r) => r.reserva.status === 'Ativa' || (r.entradaEm && !r.saidaEm))

  if (dentro) return dentro.id

  const agoraMs = new Date(agora).getTime()
  const ativada = lista.find((r) => ms(r.hora) !== null && ms(r.hora) <= agoraMs)

  return ativada ? ativada.id : null
}


// Quando a hora marcada chega, a vaga passa a 'Reservada' (só se estiver Livre).
// Roda junto com processarAtrasos e depois de qualquer liberação de vaga.
export async function ativarAgendamentos(agora = new Date()) {
  const chegaram = await prismaClient.reservaCli.findMany({
    where: {
      hora: { lte: agora },
      reserva: {
        status: { in: STATUS_AGUARDANDO_CHEGADA },
        vaga: { status: 'Livre' }
      }
    },
    select: { reserva: { select: { fk_vaga: true } } }
  })

  const vagas = [...new Set(chegaram.map((r) => r.reserva.fk_vaga))]

  if (vagas.length === 0) return 0

  const resultado = await prismaClient.vaga.updateMany({
    where: { id: { in: vagas }, status: 'Livre' },
    data: { status: 'Reservada' }
  })

  return resultado.count
}


// Libera a vaga só se for desta reserva. Chamar ANTES de encerrar a reserva,
// ainda dentro da transação (ela precisa estar em andamento para contar).
export async function vagaEhDestaReserva(tx, vagaId, reservaCliId, agora = new Date()) {
  if (!vagaId) return false
  return (await quemSegura(tx, vagaId, agora)) === reservaCliId
}


export async function liberarVaga(tx, vagaId) {
  await tx.vaga.updateMany({
    where: { id: vagaId, status: { in: ['Reservada', 'Ocupada'] } },
    data: { status: 'Livre' }
  })
}


// Horários já comprometidos de cada vaga (só início e fim, sem dados de pessoas).
// Serve para o front mostrar "livre agora, reservada a partir de ...".
export async function anexarAgendamentos(vagas) {
  if (!vagas || vagas.length === 0) return vagas

  const agora = Date.now()

  const itens = await prismaClient.reservaCli.findMany({
    where: {
      reserva: {
        fk_vaga: { in: vagas.map((v) => v.id) },
        status: { in: STATUS_EM_ANDAMENTO }
      }
    },
    select: {
      hora: true,
      horaSaida: true,
      reserva: { select: { fk_vaga: true, status: true } }
    },
    orderBy: { hora: 'asc' }
  })

  const porVaga = new Map()

  for (const item of itens) {
    const lista = porVaga.get(item.reserva.fk_vaga) || []
    const fim = fimDoBloqueio(item, agora)

    lista.push({
      inicio: new Date(item.hora).toISOString(),
      // a vaga fica protegida contra novas reservas desde 24 h antes do início
      bloqueioInicio: new Date(ms(item.hora) - MARGEM_SEGURANCA_MS).toISOString(),
      fim: fim === null ? null : new Date(fim).toISOString(),
      futuro: ms(item.hora) > agora
    })

    porVaga.set(item.reserva.fk_vaga, lista)
  }

  return vagas.map((vaga) => ({
    ...vaga,
    agendamentos: porVaga.get(vaga.id) || []
  }))
}


// A vaga está livre para este período? (consulta para a tela de reserva)
export async function verificarDisponibilidade(vagaId, inicio, fim, ignorarReservaCliId = null) {
  const vaga = await prismaClient.vaga.findUnique({ where: { id: vagaId } })

  if (!vaga) throw erroHttp(404, 'Vaga não encontrada.')

  const ini = ms(inicio)
  const fimMs = ms(fim)

  if (ini === null || fimMs === null || fimMs <= ini) {
    throw erroHttp(400, 'Informe um período válido (início antes do fim).')
  }

  const agora = new Date()
  const conflito = await buscarConflito(prismaClient, {
    vagaId,
    inicio: new Date(ini),
    fim: new Date(fimMs),
    ignorarReservaCliId,
    agora
  })

  if (conflito) {
    return { disponivel: false, motivo: 'conflito', conflito }
  }

  // reserva que começa agora precisa de vaga livre agora
  if (ini <= agora.getTime() && vaga.status !== 'Livre') {
    return { disponivel: false, motivo: 'ocupada_agora', conflito: null }
  }

  return { disponivel: true, motivo: null, conflito: null }
}
