import prismaClient from '../prisma/index.js'




export async function criarCarro(dados) {
  const carro = await prismaClient.carro.create({
    data: {
      placacarro:   dados.placacarro,
      modelo:       dados.modelo,
      fk_idCliente: dados.fk_idCliente,
    }
  })
  return carro
}


export async function listarCarros() {
  const carros = await prismaClient.carro.findMany()
  return carros
}


export async function buscarCarroPorId(id) {
  const carro = await prismaClient.carro.findUnique({
    where: { id }
  })
  return carro
}


export async function atualizarCarro(id, dados) {
  const carro = await prismaClient.carro.update({
    where: { id },
    data: {
      placacarro:   dados.placacarro,
      modelo:       dados.modelo,
      fk_idCliente: dados.fk_idCliente,
    }
  })
  return carro
}


export async function deletarCarro(id) {
  await prismaClient.carro.delete({
    where: { id }
  })
}