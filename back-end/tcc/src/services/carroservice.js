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


// idCliente opcional: a equipe lista todos; o cliente só os dele
export async function listarCarros(idCliente) {
  const carros = await prismaClient.carro.findMany({
    where: idCliente ? { fk_idCliente: idCliente } : undefined
  })
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