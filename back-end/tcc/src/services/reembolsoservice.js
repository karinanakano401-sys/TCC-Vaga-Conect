import prismaClient from '../prisma/index.js'


const relacoes = {
  usuario: {
    select: {
      id:    true,
      nome:  true,
      email: true
    }
  },
  reservaCli: {
    include: {
      reserva: { include: { vaga: { include: { estacionamento: true } } } },
      carro:   true
    }
  }
}


function numero(valor, padrao = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : padrao
}


function dadosDoPedido(dados) {
  return {
    valorPago:     numero(dados.valorPago),
    valorDevolver: numero(dados.valorDevolver),
    minutosUsados: Math.max(0, Math.round(numero(dados.minutosUsados))),
    valorUsado:    numero(dados.valorUsado),
    motivo:        dados.motivo || '',
    status:        dados.status || 'Pendente',
    observacao:    dados.observacao || '',
    decididoPor:   dados.decididoPor || null,
    fk_reservacli: dados.fk_reservacli,
    fk_idCliente:  dados.fk_idCliente,
  }
}


function dadosDaAtualizacao(dados) {
  const data = {}

  if (dados.valorPago !== undefined)     data.valorPago = numero(dados.valorPago)
  if (dados.valorDevolver !== undefined) data.valorDevolver = numero(dados.valorDevolver)
  if (dados.minutosUsados !== undefined) data.minutosUsados = Math.max(0, Math.round(numero(dados.minutosUsados)))
  if (dados.valorUsado !== undefined)    data.valorUsado = numero(dados.valorUsado)
  if (dados.motivo !== undefined)        data.motivo = dados.motivo || ''
  if (dados.status !== undefined)        data.status = dados.status
  if (dados.observacao !== undefined)    data.observacao = dados.observacao || ''
  if (dados.decididoPor !== undefined)   data.decididoPor = dados.decididoPor || null
  if (dados.fk_reservacli !== undefined) data.fk_reservacli = dados.fk_reservacli
  if (dados.fk_idCliente !== undefined)  data.fk_idCliente = dados.fk_idCliente

  if (dados.respondido) {
    data.respondido = new Date(dados.respondido)
  } else if (dados.status && dados.status !== 'Pendente') {
    data.respondido = new Date()
  }

  return data
}


export async function criarReembolso(dados) {
  const reembolso = await prismaClient.reembolso.create({
    data: dadosDoPedido(dados),
    include: relacoes
  })
  return reembolso
}


export async function listarReembolsos() {
  const reembolsos = await prismaClient.reembolso.findMany({
    include: relacoes,
    orderBy: { criadoEm: 'desc' }
  })
  return reembolsos
}


export async function buscarReembolsoPorId(id) {
  const reembolso = await prismaClient.reembolso.findUnique({
    where: { id },
    include: relacoes
  })
  return reembolso
}


export async function atualizarReembolso(id, dados) {
  const reembolso = await prismaClient.reembolso.update({
    where: { id },
    data: dadosDaAtualizacao(dados),
    include: relacoes
  })
  return reembolso
}


export async function deletarReembolso(id) {
  await prismaClient.reembolso.delete({
    where: { id }
  })
}
