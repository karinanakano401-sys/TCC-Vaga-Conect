import prismaClient from '../prisma/index.js'
import { ehEquipe, erroHttp } from '../auth.js'
import {
  FORMAS_DE_PAGAMENTO,
  CATEGORIAS,
  arredondar,
  somar,
  calcularReserva,
  minutosEntre,
  resumoDeCobranca
} from './cobrancaservice.js'


const incluir = {
  reservaCli: {
    include: {
      usuario: { omit: { senha: true } },
      reserva: { include: { vaga: { include: { estacionamento: true } } } }
    }
  }
}


function intervaloDoMes(mes, ano) {
  return {
    gte: new Date(ano, mes - 1, 1),
    lt:  new Date(ano, mes, 1)
  }
}


function intervaloDeHoje(agora = new Date()) {
  return {
    gte: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()),
    lt:  new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)
  }
}


// ---------------------------------------------------------------------------
// Registrar um pagamento (equipe do pátio)
//
// O valor NUNCA vem do front:
//  - taxa:        calculada pelo preço da vaga e pelo tempo marcado + garantia
//  - tempo_extra: o que está em aberto no momento (tempo extra − já recebido)
// ---------------------------------------------------------------------------

export async function criarPagamento(dados) {
  const tipo = String(dados.tipo || '')

  if (!Object.keys(FORMAS_DE_PAGAMENTO).includes(tipo)) {
    throw erroHttp(400, 'Forma de pagamento inválida. Use pix, cartao ou dinheiro.')
  }

  const categoria = String(dados.categoria || '')

  if (!['taxa', 'tempo_extra'].includes(categoria)) {
    throw erroHttp(400, 'Categoria inválida. Use taxa ou tempo_extra.')
  }

  if (!dados.fk_reserva) throw erroHttp(400, 'Informe a reserva.')

  const registrar = () => prismaClient.$transaction(async (tx) => {
    const item = await tx.reservaCli.findUnique({
      where: { id: dados.fk_reserva },
      include: {
        pagamentos: true,
        reserva: { include: { vaga: true } }
      }
    })

    if (!item) throw erroHttp(404, 'Reserva não encontrada.')

    let valor = 0

    if (categoria === 'taxa') {
      if (item.pagamentos.some((p) => p.categoria === 'taxa')) {
        throw erroHttp(409, 'A taxa desta reserva já foi registrada.')
      }

      const minutos = minutosEntre(item.hora, item.horaSaida)

      if (minutos <= 0) {
        throw erroHttp(400, 'A reserva não tem um período válido para calcular a taxa.')
      }

      valor = calcularReserva(item.reserva?.vaga?.preco, minutos).total
    } else {
      const cobranca = resumoDeCobranca(item)

      if (cobranca.emAberto <= 0) {
        throw erroHttp(409, 'Não há tempo extra em aberto para esta reserva.')
      }

      valor = cobranca.emAberto
    }

    return tx.pagamento.create({
      data: {
        nome:       FORMAS_DE_PAGAMENTO[tipo],
        tipo,
        valor,
        categoria,
        fk_reserva: item.id
      },
      include: incluir
    })
  }, { isolationLevel: 'Serializable' })

  try {
    return await registrar()
  } catch (error) {
    // duas confirmações ao mesmo tempo: a segunda perde
    if (error?.code === 'P2034') {
      throw erroHttp(409, 'Outra operação estava em andamento. Confira a lista e tente de novo.')
    }

    throw error
  }
}


// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listarPagamentos(auth, filtros = {}) {
  const where = {}

  if (!ehEquipe(auth)) {
    where.reservaCli = { fk_idCliente: auth.sub }
  }

  const mes = Number(filtros.mes)
  const ano = Number(filtros.ano)

  if (mes >= 1 && mes <= 12 && ano >= 2000) {
    where.criadoEm = intervaloDoMes(mes, ano)
  }

  if (CATEGORIAS.includes(filtros.categoria)) {
    where.categoria = filtros.categoria
  }

  return prismaClient.pagamento.findMany({
    where,
    include: incluir,
    orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }]
  })
}


export async function buscarPagamentoPorId(id, auth) {
  const pagamento = await prismaClient.pagamento.findUnique({
    where: { id },
    include: incluir
  })

  if (!pagamento) return null

  if (!ehEquipe(auth) && pagamento.reservaCli?.fk_idCliente !== auth.sub) {
    throw erroHttp(403, 'Este pagamento pertence a outra pessoa.')
  }

  return pagamento
}


// ---------------------------------------------------------------------------
// Correção de cadastro: só a forma de pagamento. Valor, reserva e data
// nunca mudam depois de lançados (o histórico financeiro é preservado).
// ---------------------------------------------------------------------------

export async function atualizarPagamento(id, dados) {
  const data = {}

  if (dados.tipo !== undefined) {
    if (!Object.keys(FORMAS_DE_PAGAMENTO).includes(dados.tipo)) {
      throw erroHttp(400, 'Forma de pagamento inválida. Use pix, cartao ou dinheiro.')
    }

    data.tipo = dados.tipo
    data.nome = FORMAS_DE_PAGAMENTO[dados.tipo]
  }

  if (Object.keys(data).length === 0) {
    throw erroHttp(400, 'Só a forma de pagamento pode ser corrigida. O valor não pode ser alterado.')
  }

  return prismaClient.pagamento.update({
    where: { id },
    data,
    include: incluir
  })
}


// ---------------------------------------------------------------------------
// Resumo financeiro calculado no servidor
// ---------------------------------------------------------------------------

async function totalDoPeriodo(intervalo) {
  const [pagamentos, reembolsos] = await Promise.all([
    prismaClient.pagamento.findMany({
      where: { criadoEm: intervalo },
      select: { valor: true, categoria: true, tipo: true }
    }),
    prismaClient.reembolso.findMany({
      where: {
        status: 'Aprovada',
        OR: [
          { respondido: intervalo },
          { respondido: null, criadoEm: intervalo }
        ]
      },
      select: { valorDevolver: true }
    })
  ])

  const bruto = somar(pagamentos.map((p) => p.valor))
  const devolvido = somar(reembolsos.map((r) => r.valorDevolver))

  const porCategoria = {}
  const porForma = {}

  for (const p of pagamentos) {
    porCategoria[p.categoria] = somar([porCategoria[p.categoria] || 0, p.valor])
    porForma[p.tipo] = somar([porForma[p.tipo] || 0, p.valor])
  }

  return {
    bruto,
    devolvido,
    liquido: arredondar(bruto - devolvido),
    quantidade: pagamentos.length,
    reembolsos: reembolsos.length,
    porCategoria,
    porForma
  }
}


export async function resumoFinanceiro(filtros = {}, agora = new Date()) {
  const mes = Number(filtros.mes) >= 1 && Number(filtros.mes) <= 12
    ? Number(filtros.mes)
    : agora.getMonth() + 1

  const ano = Number(filtros.ano) >= 2000 ? Number(filtros.ano) : agora.getFullYear()

  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoAnterior = mes === 1 ? ano - 1 : ano

  const [periodo, anterior, hoje, geral, pendentes] = await Promise.all([
    totalDoPeriodo(intervaloDoMes(mes, ano)),
    totalDoPeriodo(intervaloDoMes(mesAnterior, anoAnterior)),
    totalDoPeriodo(intervaloDeHoje(agora)),
    totalDoPeriodo({ lt: new Date('9999-12-31T00:00:00Z') }),
    prismaClient.reembolso.findMany({
      where: { status: 'Pendente' },
      select: { valorDevolver: true }
    })
  ])

  // variação do líquido; sem base de comparação não inventa percentual
  let crescimento = null

  if (anterior.liquido !== 0) {
    crescimento = Math.round(((periodo.liquido - anterior.liquido) / Math.abs(anterior.liquido)) * 100)
  }

  return {
    mes,
    ano,
    periodo,
    anterior: { mes: mesAnterior, ano: anoAnterior, ...anterior },
    crescimento,
    hoje,
    geral,
    reembolsosPendentes: {
      quantidade: pendentes.length,
      valor: somar(pendentes.map((r) => r.valorDevolver))
    }
  }
}
