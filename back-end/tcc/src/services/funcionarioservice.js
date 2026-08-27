import prismaClient from '../prisma/index.js'


export async function criarFuncionario(dados) {
  const funcionario = await prismaClient.funcionario.create({
    data: {
      nome:            dados.nome,
      dataNascimento:  new Date(dados.dataNascimento),
      cpf:             dados.cpf,
      telefone:        dados.telefone,
      email:           dados.email,
      senha:           dados.senha,
      fk_tipofunc:     dados.fk_tipofunc,
      fk_est:          dados.fk_est,
    }
  })
  return funcionario
}


export async function loginFuncionario(dados) {
  const funcionario = await prismaClient.funcionario.findUnique({
    where: { email: dados.email },
    include: { tipoFunc: true, estacionamento: true }
  })

  if (!funcionario || funcionario.senha !== dados.senha) {
    throw new Error('Email ou senha inválidos')
  }

  const { senha, ...funcionarioSemSenha } = funcionario
  return funcionarioSemSenha
}


export async function listarFuncionarios() {
  const funcionarios = await prismaClient.funcionario.findMany({
    include: { tipoFunc: true, estacionamento: true }
  })
  return funcionarios
}


export async function buscarFuncionarioPorId(id) {
  const funcionario = await prismaClient.funcionario.findUnique({
    where: { id },
    include: { tipoFunc: true, estacionamento: true }
  })
  return funcionario
}


export async function atualizarFuncionario(id, dados) {
  const funcionario = await prismaClient.funcionario.update({
    where: { id },
    data: {
      nome:            dados.nome,
      dataNascimento:  new Date(dados.dataNascimento),
      cpf:             dados.cpf,
      telefone:        dados.telefone,
      email:           dados.email,
      senha:           dados.senha,
      fk_tipofunc:     dados.fk_tipofunc,
      fk_est:          dados.fk_est,
    }
  })
  return funcionario
}


export async function deletarFuncionario(id) {
  await prismaClient.funcionario.delete({
    where: { id }
  })
}