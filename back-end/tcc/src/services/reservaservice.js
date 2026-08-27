import prismaClient from '../prisma/index.js'




export async function criarReserva(dados) {
  const reserva = await prismaClient.reserva.create({
    data: {
      status:  dados.status,
      fk_vaga: dados.fk_vaga,
    }
  })
  return reserva
}


export async function listarReservas() {
  const reservas = await prismaClient.reserva.findMany({
    include: {
      vaga: { include: { estacionamento: true } },
      reservasCli: { include: { usuario: true } }
    }
  })
  return reservas
}


export async function buscarReservaPorId(id) {
  const reserva = await prismaClient.reserva.findUnique({
    where: { id },
    include: {
      vaga: { include: { estacionamento: true } },
      reservasCli: { include: { usuario: true } }
    }
  })
  return reserva
}


export async function atualizarReserva(id, dados) {
  const reserva = await prismaClient.reserva.update({
    where: { id },
    data: {
      status:  dados.status,
      fk_vaga: dados.fk_vaga,
    }
  })
  return reserva
}


export async function deletarReserva(id) {
  await prismaClient.reserva.delete({
    where: { id }
  })
}