import prismaClient from '../prisma/index.js'
import { processarAtrasos } from './atrasoservice.js'
import { anexarAgendamentos } from './agendamentoservice.js'


function quantidadeInformada(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  const numero = Math.floor(Number(valor))
  if (!Number.isFinite(numero) || numero < 1) {
    throw new Error('Informe uma quantidade de vagas maior que zero.')
  }
  return numero
}


function precoInformado(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error('Informe um preço válido para as vagas.')
  }
  return numero
}


function numerosLivres(vagas, quanto) {
  const usados = new Set(vagas.map((vaga) => String(vaga.numero)))
  const novos = []
  let candidato = 1
  while (novos.length < quanto) {
    if (!usados.has(String(candidato))) novos.push(String(candidato))
    candidato += 1
  }
  return novos
}


export async function criarEstacionamento(dados) {
  const quantidade = quantidadeInformada(dados.quantidade)
  const preco = precoInformado(dados.preco) ?? 0

  const estacionamento = await prismaClient.estacionamento.create({
    data: {
      nome:          dados.nome,
      status:        dados.status,
      fk_idEndereco: dados.fk_idEndereco,
      vagas: quantidade
        ? {
            create: numerosLivres([], quantidade).map((numero) => ({
              numero,
              tipo:   'Comum',
              status: 'Livre',
              preco
            }))
          }
        : undefined
    },
    include: { endereco: true, vagas: true }
  })
  return estacionamento
}


export async function listarEstacionamentos() {
  await processarAtrasos()
  const estacionamentos = await prismaClient.estacionamento.findMany({
    include: { endereco: true, vagas: true }
  })

  // cada vaga traz seus horários já comprometidos (agendamentos)
  const todas = await anexarAgendamentos(estacionamentos.flatMap((est) => est.vagas))
  const porId = new Map(todas.map((vaga) => [vaga.id, vaga]))

  return estacionamentos.map((est) => ({
    ...est,
    vagas: est.vagas.map((vaga) => porId.get(vaga.id) || vaga)
  }))
}


export async function buscarEstacionamentoPorId(id) {
  const estacionamento = await prismaClient.estacionamento.findUnique({
    where: { id },
    include: { endereco: true, vagas: true }
  })

  if (!estacionamento) return estacionamento

  return {
    ...estacionamento,
    vagas: await anexarAgendamentos(estacionamento.vagas)
  }
}


export async function atualizarEstacionamento(id, dados) {
  const quantidade = quantidadeInformada(dados.quantidade)
  const preco = precoInformado(dados.preco)

  const estacionamento = await prismaClient.$transaction(async (tx) => {
    await tx.estacionamento.update({
      where: { id },
      data: {
        nome:   dados.nome,
        status: dados.status,
      }
    })

    const vagas = await tx.vaga.findMany({
      where: { fk_est: id },
      include: { reservas: true }
    })

    if (preco !== null && vagas.length) {
      await tx.vaga.updateMany({
        where: { fk_est: id },
        data: { preco }
      })
    }

    if (quantidade !== null && quantidade > vagas.length) {
      const precoNova = preco !== null ? preco : Number(vagas[0]?.preco || 0)
      await tx.vaga.createMany({
        data: numerosLivres(vagas, quantidade - vagas.length).map((numero) => ({
          numero,
          tipo:   'Comum',
          status: 'Livre',
          preco:  precoNova,
          fk_est: id
        }))
      })
    }

    if (quantidade !== null && quantidade < vagas.length) {
      const remover = vagas.length - quantidade
      const livres = vagas
        .filter((vaga) => vaga.status === 'Livre' && vaga.reservas.length === 0)
        .sort((a, b) => Number(b.numero) - Number(a.numero))

      if (livres.length < remover) {
        throw new Error('Não é possível reduzir: há vagas ocupadas ou com reserva.')
      }

      await tx.vaga.deleteMany({
        where: { id: { in: livres.slice(0, remover).map((vaga) => vaga.id) } }
      })
    }

    return tx.estacionamento.findUnique({
      where: { id },
      include: { endereco: true, vagas: true }
    })
  })

  return estacionamento
}


export async function deletarEstacionamento(id) {
  await prismaClient.estacionamento.delete({
    where: { id }
  })
}