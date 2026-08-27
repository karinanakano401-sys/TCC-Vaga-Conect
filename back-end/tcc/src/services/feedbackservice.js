import prismaClient from '../prisma/index.js'


const relacoes = {
  usuario: {
    select: {
      id:    true,
      nome:  true,
      email: true
    }
  }
}


export async function criarFeedback(dados) {
  const feedback = await prismaClient.feedback.create({
    data: {
      nota:         Number(dados.nota),
      assunto:      dados.assunto,
      categoria:    dados.categoria,
      mensagem:     dados.mensagem,
      fk_idCliente: dados.fk_idCliente,
    },
    include: relacoes
  })
  return feedback
}


export async function listarFeedbacks() {
  const feedbacks = await prismaClient.feedback.findMany({
    include: relacoes,
    orderBy: { createdAt: 'desc' }
  })
  return feedbacks
}


export async function buscarFeedbackPorId(id) {
  const feedback = await prismaClient.feedback.findUnique({
    where: { id },
    include: relacoes
  })
  return feedback
}


export async function atualizarFeedback(id, dados) {
  const feedback = await prismaClient.feedback.update({
    where: { id },
    data: {
      nota:         Number(dados.nota),
      assunto:      dados.assunto,
      categoria:    dados.categoria,
      mensagem:     dados.mensagem,
      fk_idCliente: dados.fk_idCliente,
    },
    include: relacoes
  })
  return feedback
}


export async function deletarFeedback(id) {
  await prismaClient.feedback.delete({
    where: { id }
  })
}
