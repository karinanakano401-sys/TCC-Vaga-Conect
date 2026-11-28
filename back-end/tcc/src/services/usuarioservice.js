import prismaClient from '../prisma/index.js'
import { gerarHash, verificarSenha } from '../senha.js'


function semSenha(usuario) {
  if (!usuario) return usuario
  const { senha, senhaAlteradaEm, ...usuarioSemSenha } = usuario
  return usuarioSemSenha
}


export async function criarUsuario(dados) {
  const usuario = await prismaClient.usuario.create({
    data: {
      nome:            dados.nome,
      dataNascimento:  new Date(dados.dataNascimento),
      cpf:             dados.cpf,
      email:           dados.email,
      senha:           gerarHash(dados.senha),
      fk_idEndereco:   dados.fk_idEndereco,
    }
  })
  return semSenha(usuario)
}


export async function loginUsuario(dados) {
  const usuario = await prismaClient.usuario.findUnique({
    where: { email: dados.email }
  })

  const { ok, precisaAtualizar } = usuario
    ? verificarSenha(dados.senha, usuario.senha)
    : { ok: false, precisaAtualizar: false }

  if (!ok) {
    throw new Error('Email ou senha inválidos')
  }

  // conta antiga com senha em texto puro: passa a guardar o hash
  if (precisaAtualizar) {
    await prismaClient.usuario.update({
      where: { id: usuario.id },
      data:  { senha: gerarHash(dados.senha) }
    })
  }

  return semSenha(usuario)
}


export async function listarUsuarios() {
  const usuarios = await prismaClient.usuario.findMany({
    include: { endereco: true, reservas: true },
    omit: { senha: true, senhaAlteradaEm: true }
  })
  return usuarios
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
  if (dados.senha) data.senha = gerarHash(dados.senha)

  const usuario = await prismaClient.usuario.update({
    where: { id },
    data,
    include: { endereco: true }
  })
  return semSenha(usuario)
}


// Avatar é opcional: guarda só o código do personagem ("f1" a "f10", "m1" a "m10").
// null remove o avatar. O desenho do personagem fica no front (Base/JS/avatar.js).
const AVATAR_VALIDO = /^[fm](10|[1-9])$/

export async function atualizarAvatar(id, avatar) {
  if (avatar !== null && !(typeof avatar === 'string' && AVATAR_VALIDO.test(avatar))) {
    throw new Error('Avatar inválido')
  }

  const usuario = await prismaClient.usuario.update({
    where: { id },
    data: { avatar },
    include: { endereco: true }
  })
  return semSenha(usuario)
}


export async function deletarUsuario(id) {
  await prismaClient.usuario.delete({
    where: { id }
  })
}