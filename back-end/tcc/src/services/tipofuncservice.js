import prismaClient from '../prisma/index.js'




export async function criarTipoFunc(dados) {
  const tipoFunc = await prismaClient.tipoFunc.create({
    data: {
      nome: dados.nome,
      tipo: dados.tipo,
    }
  })
  return tipoFunc
}


export async function listarTipoFuncs() {
  const tipoFuncs = await prismaClient.tipoFunc.findMany()
  return tipoFuncs
}


export async function buscarTipoFuncPorId(id) {
  const tipoFunc = await prismaClient.tipoFunc.findUnique({
    where: { id }
  })
  return tipoFunc
}


export async function atualizarTipoFunc(id, dados) {
  const tipoFunc = await prismaClient.tipoFunc.update({
    where: { id },
    data: {
      nome: dados.nome,
      tipo: dados.tipo,
    }
  })
  return tipoFunc
}


export async function deletarTipoFunc(id) {
  await prismaClient.tipoFunc.delete({
    where: { id }
  })
}