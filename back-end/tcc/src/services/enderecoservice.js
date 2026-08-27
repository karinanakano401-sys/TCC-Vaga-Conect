import prismaClient from '../prisma/index.js'




export async function criarEndereco(dados) {
  const endereco = await prismaClient.endereco.create({
    data: {
      rua:    dados.rua,
      numero: dados.numero,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
      cep:    dados.cep,
    }
  })
  return endereco
}


export async function listarEnderecos() {
  const enderecos = await prismaClient.endereco.findMany()
  return enderecos
}


export async function buscarEnderecoPorId(id) {
  const endereco = await prismaClient.endereco.findUnique({
    where: { id }
  })
  return endereco
}


export async function atualizarEndereco(id, dados) {
  const endereco = await prismaClient.endereco.update({
    where: { id },
    data: {
      rua:    dados.rua,
      numero: dados.numero,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
      cep:    dados.cep,
    }
  })
  return endereco
}


export async function deletarEndereco(id) {
  await prismaClient.endereco.delete({
    where: { id }
  })
}
