import prismaClient from '../prisma/index.js'


export async function criarUsuario(dados) {
  const usuario = await prismaClient.usuario.create({
    data: {
      nome:            dados.nome,
      dataNascimento:  new Date(dados.dataNascimento),
      cpf:             dados.cpf,
      email:           dados.email,
      senha:           dados.senha,
      fk_idEndereco:   dados.fk_idEndereco,
    }
  })
  return usuario
}


export async function loginUsuario(dados) {
  const usuario = await prismaClient.usuario.findUnique({
    where: { email: dados.email }
  })

  if (!usuario || usuario.senha !== dados.senha) {
    throw new Error('Email ou senha inválidos')
  }

  const { senha, ...usuarioSemSenha } = usuario
  return usuarioSemSenha
}


export async function listarUsuarios() {
  const usuarios = await prismaClient.usuario.findMany({
    include: { endereco: true, reservas: true }
  })
  return usuarios
}


function semSenha(usuario) {
  if (!usuario) return usuario
  const { senha, ...usuarioSemSenha } = usuario
  return usuarioSemSenha
}


export async function buscarUsuarioPorId(id) {
  const usuario = await prismaClient.usuario.findUnique({
    where: { id },
    include: { endereco: true }
  })
  return semSenha(usuario)
}


export async function atualizarUsuario(id, dados) {
  const data = {
    nome: dados.nome,
    dataNascimento: new Date(dados.dataNascimento),
  }

  if (dados.cpf) data.cpf = dados.cpf
  if (dados.email) data.email = dados.email
  if (dados.senha) data.senha = dados.senha

  const usuario = await prismaClient.usuario.update({
    where: { id },
    data,
    include: { endereco: true }
  })
  return semSenha(usuario)
}


export async function deletarUsuario(id) {
  await prismaClient.usuario.delete({
    where: { id }
  })
}