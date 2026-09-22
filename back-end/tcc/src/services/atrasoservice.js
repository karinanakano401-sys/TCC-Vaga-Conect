import prismaClient from '../prisma/index.js'


export const TOLERANCIA_MS = 10 * 60 * 1000
export const ATRASO_MS = 20 * 60 * 1000
export const STATUS_AGUARDANDO = ['Reservada', 'Tolerância', 'Atraso']

const GARANTIA = 25

let emAndamento = null


function arredondar(valor) {
  return Math.round(Number(valor || 0) * 100) / 100
}


function totalPago(item) {
  return arredondar(
    (item.pagamentos || []).reduce(
      (soma, pagamento) => soma + Number(pagamento.valor || 0),
      0
    )
  )
}


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
      where: { id: item.reserva.id }
    })

    if (!atual || !STATUS_AGUARDANDO.includes(atual.status)) return

    await tx.reserva.update({
      where: { id: item.reserva.id },
      data: { status: 'Cancelada' }
    })

    if (vaga?.id) {
      await tx.vaga.update({
        where: { id: vaga.id },
        data: { status: 'Livre' }
      })
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
      const destino = proximoStatus(item.hora, agora)
      if (!destino || destino === item.reserva.status) continue

      if (destino === 'Cancelada') {
        await cancelarNoShow(item)
      } else {
        await prismaClient.reserva.update({
          where: { id: item.reserva.id },
          data: { status: destino }
        })
      }
    } catch (error) {
      console.error('Falha ao processar atraso da reserva', item.id, error.message)
    }
  }
}


export async function processarAtrasos() {
  if (emAndamento) return emAndamento
  emAndamento = executar().finally(() => {
    emAndamento = null
  })
  return emAndamento
}
