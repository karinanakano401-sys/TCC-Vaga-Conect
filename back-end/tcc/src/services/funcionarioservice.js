import prismaClient from '../prisma/index.js'
import { erroHttp } from '../auth.js'
import { gerarHash, verificarSenha } from '../senha.js'


// A senha (hash) nunca sai nas respostas da API
const SEM_SENHA = { senha: true, senhaAlteradaEm: true }


function semSenha(funcionario) {
  if (!funcionario) return funcionario
  const { senha, senhaAlteradaEm, ...funcionarioSemSenha } = funcionario
  return funcionarioSemSenha
}


export async function criarFuncionario(dados) {
  const funcionario = await prismaClient.funcionario.create({
    data: {
      nome:            dados.nome,
      dataNascimento:  new Date(dados.dataNascimento),
      cpf:             dados.cpf,
      telefone:        dados.telefone,
      email:           dados.email,
      senha:           gerarHash(dados.senha),
      fk_tipofunc:     dados.fk_tipofunc,
      fk_est:          dados.fk_est,
    },
    omit: SEM_SENHA
  })
  return funcionario
}


export async function loginFuncionario(dados) {
  const funcionario = await prismaClient.funcionario.findUnique({
    where: { email: dados.email },
    include: { tipoFunc: true, estacionamento: true }
  })

  const { ok, precisaAtualizar } = funcionario
    ? verificarSenha(dados.senha, funcionario.senha)
    : { ok: false, precisaAtualizar: false }

  if (!ok) {
    throw new Error('Email ou senha inválidos')
  }

  // conta antiga com senha em texto puro: passa a guardar o hash
  if (precisaAtualizar) {
    await prismaClient.funcionario.update({
      where: { id: funcionario.id },
      data:  { senha: gerarHash(dados.senha) }
    })
  }

  return semSenha(funcionario)
}


export async function listarFuncionarios() {
  const funcionarios = await prismaClient.funcionario.findMany({
    include: { tipoFunc: true, estacionamento: true },
    omit: SEM_SENHA
  })
  return funcionarios
}


export async function buscarFuncionarioPorId(id) {
  const funcionario = await prismaClient.funcionario.findUnique({
    where: { id },
    include: { tipoFunc: true, estacionamento: true },
    omit: SEM_SENHA
  })
  return funcionario
}


// senha vazia = manter a atual.
// Se vier senhaAtual (tela "Minha conta"), ela é conferida no servidor antes da troca.
export async function atualizarFuncionario(id, dados) {
  const data = {
    nome:            dados.nome,
    dataNascimento:  new Date(dados.dataNascimento),
    cpf:             dados.cpf,
    telefone:        dados.telefone,
    email:           dados.email,
    fk_tipofunc:     dados.fk_tipofunc,
    fk_est:          dados.fk_est,
  }

  if (dados.senha) {
    if (dados.senhaAtual !== undefined) {
      const atual = await prismaClient.funcionario.findUnique({
        where:  { id },
        select: { senha: true }
      })

      if (!atual || !verificarSenha(dados.senhaAtual, atual.senha).ok) {
        throw erroHttp(400, 'Senha atual não confere.')
      }
    }

    data.senha = gerarHash(dados.senha)
  }

  const funcionario = await prismaClient.funcionario.update({
    where: { id },
    data,
    omit: SEM_SENHA
  })
  return funcionario
}


export async function deletarFuncionario(id) {
  await prismaClient.funcionario.delete({
    where: { id }
  })
}
