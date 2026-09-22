import prismaClient from '../prisma/index.js'
import { processarAtrasos, STATUS_AGUARDANDO } from './atrasoservice.js'
import { avisarPresenca } from '../websocket.js'


const relacoes = {
  usuario:    true,
  carro:      true,
  pagamentos: true,
  reserva:    { include: { vaga: { include: { estacionamento: true } } } }
}


export async function criarReservaCli(dados) {
  const reservaCli = await prismaClient.reservaCli.create({
    data: {
      data:         dados.data ? new Date(dados.data) : undefined,
      hora:         dados.hora ? new Date(dados.hora) : undefined,
      horaSaida:    dados.horaSaida ? new Date(dados.horaSaida) : null,
      fk_idCliente: dados.fk_idCliente,
      fk_idReserva: dados.fk_idReserva,
      fk_idCarro:   dados.fk_idCarro || null,
    },
    include: relacoes
  })
  return reservaCli
}


export async function listarReservaClis() {
  await processarAtrasos()
  const reservaClis = await prismaClient.reservaCli.findMany({
    include: relacoes
  })
  return reservaClis
}


export async function buscarReservaCliPorId(id) {
  await processarAtrasos()
  const reservaCli = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })
  return reservaCli
}


export async function atualizarReservaCli(id, dados) {
  const reservaCli = await prismaClient.reservaCli.update({
    where: { id },
    data: {
      data:         dados.data ? new Date(dados.data) : undefined,
      hora:         dados.hora ? new Date(dados.hora) : undefined,
      horaSaida:    dados.horaSaida ? new Date(dados.horaSaida) : undefined,
      fk_idCliente: dados.fk_idCliente,
      fk_idReserva: dados.fk_idReserva,
      fk_idCarro:   dados.fk_idCarro,
    },
    include: relacoes
  })
  return reservaCli
}


export async function deletarReservaCli(id) {
  await prismaClient.reservaCli.delete({
    where: { id }
  })
}


async function codigoLivre() {
  for (let i = 0; i < 20; i++) {
    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    const existe = await prismaClient.reservaCli.findFirst({
      where: {
        OR: [
          { codigoPresenca: codigo },
          { codigoSaida: codigo }
        ]
      }
    })
    if (!existe) return codigo
  }
  return String(Date.now()).slice(-6)
}


export async function gerarCodigoPresenca(id) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_AGUARDANDO.includes(item.reserva?.status)) {
    throw new Error('Só é possível gerar código para reserva aguardando chegada.')
  }

  const atualizado = await prismaClient.reservaCli.update({
    where: { id },
    data: { codigoPresenca: await codigoLivre() },
    include: relacoes
  })

  avisarPresenca(id, {
    tipo: 'codigo-gerado',
    codigo: atualizado.codigoPresenca
  })

  return atualizado
}


export async function confirmarPresenca(id, codigoDigitado) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_AGUARDANDO.includes(item.reserva?.status)) {
    throw new Error('Esta reserva não está aguardando confirmação de presença.')
  }

  if (!item.codigoPresenca) {
    throw new Error('O pátio ainda não gerou o código de entrada.')
  }

  const codigo = String(codigoDigitado || '').replace(/\s/g, '')

  if (codigo !== item.codigoPresenca) {
    throw new Error('Código inválido.')
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.reserva.update({
      where: { id: item.fk_idReserva },
      data: { status: 'Ativa' }
    })

    if (item.reserva?.vaga?.id) {
      await tx.vaga.update({
        where: { id: item.reserva.vaga.id },
        data: { status: 'Ocupada' }
      })
    }

    await tx.reservaCli.update({
      where: { id },
      data: { codigoPresenca: null }
    })
  })

  avisarPresenca(id, { tipo: 'presenca-confirmada' })

  return prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })
}


const STATUS_SAIDA = ['Reservada', 'Tolerância', 'Atraso', 'Ativa']
const GARANTIA = 25


function arredondar(valor) {
  return Math.round(Number(valor || 0) * 100) / 100
}


function calcularEstorno(item) {
  const status = item.reserva?.status
  const precoHora = Number(item.reserva?.vaga?.preco || 0)
  const pago = arredondar(
    (item.pagamentos || []).reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0)
  )
  const credito = Math.max(0, arredondar(pago - GARANTIA))

  let minutosUsados = 0
  if (status === 'Ativa') {
    const entrada = new Date(item.hora)
    const agora = new Date()
    if (!isNaN(entrada.getTime()) && agora > entrada) {
      minutosUsados = Math.ceil((agora.getTime() - entrada.getTime()) / 60000)
    }
  }

  const valorUsado = arredondar(minutosUsados * precoHora / 60)

  return {
    minutosUsados,
    valorUsado,
    pago,
    reembolso: Math.max(0, arredondar(credito - valorUsado))
  }
}


export async function gerarCodigoSaida(id) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_SAIDA.includes(item.reserva?.status)) {
    throw new Error('Só é possível gerar código de saída para reserva em andamento.')
  }

  const atualizado = await prismaClient.reservaCli.update({
    where: { id },
    data: { codigoSaida: await codigoLivre() },
    include: relacoes
  })

  avisarPresenca(id, {
    tipo: 'codigo-saida-gerado',
    codigo: atualizado.codigoSaida
  })

  return atualizado
}


export async function confirmarSaida(id, codigoDigitado, motivo) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_SAIDA.includes(item.reserva?.status)) {
    throw new Error('Esta reserva não pode mais ser cancelada com reembolso.')
  }

  if (!item.codigoSaida) {
    throw new Error('O pátio ainda não gerou o código de saída.')
  }

  const codigo = String(codigoDigitado || '').replace(/\s/g, '')

  if (codigo !== item.codigoSaida) {
    throw new Error('Código de saída inválido.')
  }

  const conta = calcularEstorno(item)

  await prismaClient.$transaction(async (tx) => {
    await tx.reserva.update({
      where: { id: item.fk_idReserva },
      data: { status: 'Cancelada' }
    })

    if (item.reserva?.vaga?.id) {
      await tx.vaga.update({
        where: { id: item.reserva.vaga.id },
        data: { status: 'Livre' }
      })
    }

    await tx.reservaCli.update({
      where: { id },
      data: {
        codigoSaida: null,
        codigoPresenca: null,
        horaSaida: new Date()
      }
    })

    const jaTem = await tx.reembolso.findFirst({
      where: { fk_reservacli: id }
    })

    if (!jaTem && item.fk_idCliente) {
      await tx.reembolso.create({
        data: {
          valorPago:     conta.pago,
          valorDevolver: conta.reembolso,
          minutosUsados: conta.minutosUsados,
          valorUsado:    conta.valorUsado,
          motivo:        motivo || 'Cancelamento antecipado com código de saída',
          status:        'Pendente',
          observacao:    'Confirmado com o código de saída do pátio.',
          fk_reservacli: id,
          fk_idCliente:  item.fk_idCliente
        }
      })
    }
  })

  avisarPresenca(id, { tipo: 'saida-confirmada' })

  const atualizado = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  return {
    ...atualizado,
    estorno: conta
  }
}