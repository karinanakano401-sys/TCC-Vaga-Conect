import prismaClient from '../prisma/index.js'
import { ehEquipe, erroHttp } from '../auth.js'
import {
  STATUS_EM_ANDAMENTO,
  calcularEstorno,
  totalPago
} from './cobrancaservice.js'
import { situacaoDaOcupacao } from './ocupacaoservice.js'
import { cancelarComReembolso } from './reservacliservice.js'


const relacoes = {
  usuario: {
    select: {
      id:     true,
      nome:   true,
      email:  true,
      avatar: true
    }
  },
  reservaCli: {
    include: {
      reserva: { include: { vaga: { include: { estacionamento: true } } } },
      carro:   true
    }
  }
}


const STATUS_ATIVOS = ['Pendente', 'Aprovada']


function texto(valor, limite) {
  return String(valor || '').trim().slice(0, limite)
}


// ---------------------------------------------------------------------------
// Pedir reembolso
//
// Todos os valores são calculados aqui, a partir do que foi pago e do tempo
// realmente usado. O que o front enviar nesses campos é ignorado.
//
//  - cliente (ou equipe, sem estornoTotal): devolve os minutos não usados,
//    exige reserva em andamento; fica Pendente até a equipe decidir.
//    Quem está OCUPANDO a vaga não pede reembolso por aqui: precisa sair com o
//    código de saída (POST /reservacli/:id/confirmar-saida). Quem ainda não
//    entrou cancela e pede o reembolso sem código, na mesma transação.
//  - admin com estornoTotal: estorna a taxa inteira de qualquer reserva,
//    com motivo obrigatório; já nasce Aprovado.
// ---------------------------------------------------------------------------

export async function criarReembolso(dados, auth) {
  if (!dados.fk_reservacli) throw erroHttp(400, 'Informe a reserva.')

  const item = await prismaClient.reservaCli.findUnique({
    where: { id: dados.fk_reservacli },
    include: {
      pagamentos: true,
      reserva: { include: { vaga: true } }
    }
  })

  if (!item) throw erroHttp(404, 'Reserva não encontrada.')

  const equipe = ehEquipe(auth)

  if (!equipe && item.fk_idCliente !== auth.sub) {
    throw erroHttp(403, 'Você só pode pedir reembolso das suas próprias reservas.')
  }

  const estornoTotal = dados.estornoTotal === true

  if (estornoTotal && auth.perfil !== 'admin') {
    throw erroHttp(403, 'Só o administrador pode estornar a taxa inteira.')
  }

  const motivo = texto(dados.motivo, 500)

  let dadosDoPedido

  if (estornoTotal) {
    if (motivo.length < 5) {
      throw erroHttp(400, 'Informe o motivo do estorno (mínimo de 5 caracteres).')
    }

    const taxa = totalPago(item, 'taxa')

    if (taxa <= 0) throw erroHttp(400, 'Esta reserva não tem taxa paga para estornar.')

    dadosDoPedido = {
      valorPago:     totalPago(item),
      valorDevolver: taxa,
      minutosUsados: 0,
      valorUsado:    0,
      motivo,
      status:        'Aprovada',
      observacao:    'Estorno total da taxa pela administração.',
      decididoPor:   auth.nome || 'Administrador',
      respondido:    new Date()
    }
  } else {
    // cliente (ou equipe sem estornoTotal): reembolso dos minutos não usados
    if (!STATUS_EM_ANDAMENTO.includes(item.reserva?.status)) {
      throw erroHttp(409, 'O reembolso dos minutos não usados vale só para reservas em andamento.')
    }

    const conta = calcularEstorno(item)

    if (conta.reembolso <= 0) {
      throw erroHttp(400, 'Não há valor a reembolsar nesta reserva.')
    }

    const ocupacao = situacaoDaOcupacao(item)

    if (ocupacao.exigeCodigoSaida) {
      const erro = erroHttp(409, 'Você está ocupando uma vaga. Para pedir o reembolso é preciso sair do estacionamento com o código de saída informado pelo pátio.')
      erro.exigeCodigoSaida = true
      throw erro
    }

    const jaPediu = await prismaClient.reembolso.findFirst({
      where: { fk_reservacli: item.id, status: { in: STATUS_ATIVOS } }
    })

    if (jaPediu) {
      throw erroHttp(409, 'Esta reserva já tem um reembolso pendente ou aprovado.')
    }

    // sem entrada: não há ocupação nem código de saída. Cancela a reserva,
    // libera a vaga e abre o pedido de uma vez, para não sobrar reserva viva.
    const cancelada = await cancelarComReembolso(item.id, { motivo, auth })

    if (!cancelada.reembolso) {
      throw erroHttp(409, 'Esta reserva já tem um reembolso pendente ou aprovado.')
    }

    return prismaClient.reembolso.findUnique({
      where: { id: cancelada.reembolso.id },
      include: relacoes
    })
  }

  const jaTem = await prismaClient.reembolso.findFirst({
    where: { fk_reservacli: item.id, status: { in: STATUS_ATIVOS } }
  })

  if (jaTem) {
    throw erroHttp(409, 'Esta reserva já tem um reembolso pendente ou aprovado.')
  }

  // o índice único do banco barra a corrida entre dois pedidos simultâneos
  return prismaClient.reembolso.create({
    data: {
      ...dadosDoPedido,
      fk_reservacli: item.id,
      fk_idCliente:  item.fk_idCliente
    },
    include: relacoes
  })
}


// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listarReembolsos(auth, filtros = {}) {
  const where = {}

  if (!ehEquipe(auth)) where.fk_idCliente = auth.sub

  if (['Pendente', 'Aprovada', 'Recusada'].includes(filtros.status)) {
    where.status = filtros.status
  }

  return prismaClient.reembolso.findMany({
    where,
    include: relacoes,
    orderBy: { criadoEm: 'desc' }
  })
}


export async function buscarReembolsoPorId(id, auth) {
  const reembolso = await prismaClient.reembolso.findUnique({
    where: { id },
    include: relacoes
  })

  if (!reembolso) return null

  if (!ehEquipe(auth) && reembolso.fk_idCliente !== auth.sub) {
    throw erroHttp(403, 'Este reembolso pertence a outra pessoa.')
  }

  return reembolso
}


// ---------------------------------------------------------------------------
// Decisão da equipe. Só decide pedido Pendente, uma única vez.
// Valores, reserva e cliente nunca mudam. Quem decidiu vem do login.
// ---------------------------------------------------------------------------

export async function atualizarReembolso(id, dados, auth) {
  const atual = await prismaClient.reembolso.findUnique({ where: { id } })

  if (!atual) throw erroHttp(404, 'Reembolso não encontrado.')

  if (atual.status !== 'Pendente') {
    throw erroHttp(409, 'Este pedido já foi decidido e não pode ser alterado.')
  }

  if (!['Aprovada', 'Recusada'].includes(dados.status)) {
    throw erroHttp(400, 'Decisão inválida. Use Aprovada ou Recusada.')
  }

  const decidiu = await prismaClient.reembolso.updateMany({
    where: { id, status: 'Pendente' },
    data: {
      status:      dados.status,
      observacao:  texto(dados.observacao, 500),
      decididoPor: auth.nome || (auth.perfil === 'admin' ? 'Administrador' : 'Funcionário'),
      respondido:  new Date()
    }
  })

  if (decidiu.count === 0) {
    throw erroHttp(409, 'Este pedido já foi decidido por outra pessoa.')
  }

  return prismaClient.reembolso.findUnique({ where: { id }, include: relacoes })
}
