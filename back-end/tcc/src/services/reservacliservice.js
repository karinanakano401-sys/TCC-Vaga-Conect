import prismaClient from '../prisma/index.js'




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
  const reservaClis = await prismaClient.reservaCli.findMany({
    include: relacoes
  })
  return reservaClis
}


export async function buscarReservaCliPorId(id) {
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