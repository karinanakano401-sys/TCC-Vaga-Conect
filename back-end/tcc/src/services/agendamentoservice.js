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
  const lista = await cliente.reservaCli.findMany({
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
