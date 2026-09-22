import prismaClient from '../prisma/index.js'
import { processarAtrasos } from './atrasoservice.js'


export async function criarVaga(dados) {
  const vaga = await prismaClient.vaga.create({
    data: {
      numero: dados.numero,
      tipo:   dados.tipo,
      status: dados.status,
      preco:  Number(dados.preco),
      fk_est: dados.fk_est,
    }
  })
  return vaga
}


export async function listarVagas() {
  await processarAtrasos()
  const vagas = await prismaClient.vaga.findMany({
    include: { estacionamento: true }
  })
  return vagas
}


export async function buscarVagaPorId(id) {
  const vaga = await prismaClient.vaga.findUnique({
    where: { id },
    include: { estacionamento: true }
  })
  return vaga
}


export async function atualizarVaga(id, dados) {
  const vaga = await prismaClient.vaga.update({
    where: { id },
    data: {
      numero: dados.numero,
      tipo:   dados.tipo,
      status: dados.status,
      preco:  Number(dados.preco),
      fk_est: dados.fk_est,
    }
  })
  return vaga
}


export async function deletarVaga(id) {
  await prismaClient.vaga.delete({
    where: { id }
  })
}