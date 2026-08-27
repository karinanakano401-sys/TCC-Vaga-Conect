import prismaClient from '../prisma/index.js'




export async function criarPagamento(dados) {
  const pagamento = await prismaClient.pagamento.create({
    data: {
      nome:       dados.nome,
      tipo:       dados.tipo,
      valor:      dados.valor,
      fk_reserva: dados.fk_reserva,
    }
  })
  return pagamento
}


export async function listarPagamentos() {
  const pagamentos = await prismaClient.pagamento.findMany({
    include: {
      reservaCli: {
        include: {
          usuario: true,
          reserva: { include: { vaga: { include: { estacionamento: true } } } }
        }
      }
    },
    orderBy: { id: 'desc' }
  })
  return pagamentos
}


export async function buscarPagamentoPorId(id) {
  const pagamento = await prismaClient.pagamento.findUnique({
    where: { id }
  })
  return pagamento
}


export async function atualizarPagamento(id, dados) {
  const pagamento = await prismaClient.pagamento.update({
    where: { id },
    data: {
      nome:       dados.nome,
      tipo:       dados.tipo,
      valor:      dados.valor,
      fk_reserva: dados.fk_reserva,
    }
  })
  return pagamento
}


export async function deletarPagamento(id) {
  await prismaClient.pagamento.delete({
    where: { id }
  })
}