import prismaClient from '../prisma/index.js'
import { GARANTIA, arredondar, totalPago } from './cobrancaservice.js'
import { ativarAgendamentos, liberarVaga, vagaEhDestaReserva } from './agendamentoservice.js'


export const TOLERANCIA_MS = 10 * 60 * 1000
export const ATRASO_MS = 20 * 60 * 1000
export const STATUS_AGUARDANDO = ['Reservada', 'Tolerância', 'Atraso']

let emAndamento = null


export function proximoStatus(hora, agora = new Date()) {
  const chegada = new Date(hora)
  if (isNaN(chegada.getTime())) return null

  const fimTolerancia = new Date(chegada.getTime() + TOLERANCIA_MS)
  const fimAtraso = new Date(chegada.getTime() + TOLERANCIA_MS + ATRASO_MS)

  if (agora < chegada) return 'Reservada'
  if (agora < fimTolerancia) return 'Tolerância'
  if (agora < fimAtraso) return 'Atraso'
  return 'Cancelada'
}


async function cancelarNoShow(item) {
  const vaga = item.reserva?.vaga
  if (!item.reserva?.id) return

  const pago = totalPago(item)
  const credito = Math.max(0, arredondar(pago - GARANTIA))

  await prismaClient.$transaction(async (tx) => {
    const atual = await tx.reserva.findUnique({
      where: { id: item.reserva.id },
      include: { vaga: true }
    })

    if (!atual || !STATUS_AGUARDANDO.includes(atual.status)) return

    // Presença já confirmada: o atraso não cancela quem já entrou.
    if (atual.vaga?.status === 'Ocupada') {
      await tx.reserva.update({
        where: { id: atual.id },
        data: { status: 'Ativa' }
      })
      return
    }

    // só libera a vaga se ela estava com esta reserva (não a de outro cliente)
    const eraDona = await vagaEhDestaReserva(tx, vaga?.id, item.id)

    await tx.reserva.update({
      where: { id: item.reserva.id },
      data: { status: 'Cancelada' }
    })

    if (eraDona) {
      await liberarVaga(tx, vaga.id)
    }

    const jaTem = await tx.reembolso.findFirst({
      where: { fk_reservacli: item.id }
    })

    if (!jaTem && item.fk_idCliente) {
      await tx.reembolso.create({
        data: {
          valorPago:     pago,
          valorDevolver: credito,
          minutosUsados: 0,
          valorUsado:    0,
          motivo:        'Não comparecimento (cancelamento automático)',
          status:        'Pendente',
          observacao:    'A reserva passou da tolerância de 10 min e do atraso de 20 min sem confirmação de presença.',
          fk_reservacli: item.id,
          fk_idCliente:  item.fk_idCliente
        }
      })
    }
  })
}


// Se o cliente anterior saiu depois da hora marcada desta reserva, a chegada
// conta a partir da saída dele (a vaga só ficou livre naquele momento).
async function chegadaEfetiva(item, vagaId) {
  const hora = new Date(item.hora)

  const anterior = await prismaClient.reservaCli.findFirst({
    where: {
      id: { not: item.id },
      reserva: { fk_vaga: vagaId },
      saidaEm: { gt: hora }
    },
    orderBy: { saidaEm: 'desc' },
    select: { saidaEm: true }
  })

  return anterior ? anterior.saidaEm : hora
}


async function executar() {
  const pendentes = await prismaClient.reservaCli.findMany({
    where: {
      reserva: {
        status: { in: STATUS_AGUARDANDO }
      }
    },
    include: {
      pagamentos: true,
      reserva: { include: { vaga: true } }
    }
  })

  const agora = new Date()

  for (const item of pendentes) {
    try {
      const atual = await prismaClient.reserva.findUnique({
        where: { id: item.reserva.id },
        include: { vaga: true }
      })

      if (!atual || !STATUS_AGUARDANDO.includes(atual.status)) continue

      // agendamento futuro: nada a processar até a hora marcada
      // (a vaga fica Livre e é ativada por ativarAgendamentos)
      if (new Date(item.hora) > agora) continue

      // vaga ainda com outro cliente (quem passou do prazo): esta reserva espera,
      // sem tolerância, atraso nem cancelamento por não comparecimento
      const outraDentro = await prismaClient.reserva.count({
        where: { fk_vaga: atual.fk_vaga, status: 'Ativa', id: { not: atual.id } }
      })

      if (outraDentro > 0) continue

      if (atual.vaga?.status === 'Ocupada') {
        // a condição da vaga vai junto no UPDATE: se ela foi liberada entre a leitura
        // e a gravação (o outro cliente acabou de sair), nada é promovido
        await prismaClient.reserva.updateMany({
          where: {
            id: atual.id,
            status: { in: STATUS_AGUARDANDO },
            vaga: { status: 'Ocupada' }
          },
          data: { status: 'Ativa' }
        })
        continue
      }

      // o relógio da chegada só começa quando a vaga ficou livre para esta reserva
      const chegada = await chegadaEfetiva(item, atual.fk_vaga)

      const destino = proximoStatus(chegada, agora)
      if (!destino || destino === atual.status) continue

      if (destino === 'Cancelada') {
        await cancelarNoShow(item)
      } else {
        await prismaClient.reserva.updateMany({
          where: { id: atual.id, status: { in: STATUS_AGUARDANDO } },
          data: { status: destino }
        })
      }
    } catch (error) {
      console.error('Falha ao processar atraso da reserva', item.id, error.message)
    }
  }

  // chegou a hora de um agendamento: a vaga passa a 'Reservada'
  try {
    await ativarAgendamentos(new Date())
  } catch (error) {
    console.error('Falha ao ativar agendamentos', error.message)
  }
}


export async function processarAtrasos() {
  if (emAndamento) return emAndamento
  emAndamento = executar().finally(() => {
    emAndamento = null
  })
  return emAndamento
}



