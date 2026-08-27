import prismaClient from '../prisma/index.js'




export async function criarEstacionamento(dados) {
  const estacionamento = await prismaClient.estacionamento.create({
    data: {
      nome:          dados.nome,
      status:        dados.status,
      fk_idEndereco: dados.fk_idEndereco,
    }
  })
  return estacionamento
}


export async function listarEstacionamentos() {
  const estacionamentos = await prismaClient.estacionamento.findMany({
    include: { endereco: true, vagas: true }
  })
  return estacionamentos
}


export async function buscarEstacionamentoPorId(id) {
  const estacionamento = await prismaClient.estacionamento.findUnique({
    where: { id },
    include: { endereco: true, vagas: true }
  })
  return estacionamento
}


export async function atualizarEstacionamento(id, dados) {
  const estacionamento = await prismaClient.estacionamento.update({
    where: { id },
    data: {
      nome:   dados.nome,
      status: dados.status,
    }
  })
  return estacionamento
}


export async function deletarEstacionamento(id) {
  await prismaClient.estacionamento.delete({
    where: { id }
  })
}