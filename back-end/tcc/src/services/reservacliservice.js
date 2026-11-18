import prismaClient from '../prisma/index.js'
import { processarAtrasos, STATUS_AGUARDANDO } from './atrasoservice.js'
import { situacaoDaOcupacao, STATUS_AGUARDANDO_CHEGADA } from './ocupacaoservice.js'
import { avisarPresenca } from '../websocket.js'
import { ehEquipe, erroHttp } from '../auth.js'
import {
  STATUS_EM_ANDAMENTO,
  FORMAS_DE_PAGAMENTO,
  calcularReserva,
  calcularEstorno,
  resumoDeCobranca,
  minutosEntre,
  arredondar
} from './cobrancaservice.js'


const relacoes = {
  usuario:    { omit: { senha: true } },
  carro:      true,
  pagamentos: true,
  reserva:    { include: { vaga: { include: { estacionamento: true } } } }
}


export async function criarReservaCli(dados) {
  const reservaCli = await prismaClient.reservaCli.create({
    data: {
      data:         dados.data ? new Date(dados.data) : undefined,
      hora:         dados.hora ? new Date(dados.hora) : undefined,
      horaSaida:    dados.horaSaida ? new Date(dados.horaSaida) : null,
      fk_idCliente: dados.fk_idCliente,
      fk_idReserva: dados.fk_idReserva,
      fk_idCarro:   dados.fk_idCarro || null,
    },
    include: relacoes
  })
  return reservaCli
}


// Acrescenta a situação de cobrança calculada no servidor (campo novo, aditivo)
function comCobranca(item) {
  if (!item) return item
  return {
    ...item,
    cobranca: resumoDeCobranca(item),
    ocupacao: situacaoDaOcupacao(item)
  }
}


export async function listarReservaClis() {
  await processarAtrasos()
  const reservaClis = await prismaClient.reservaCli.findMany({
    include: relacoes
  })
  return reservaClis.map(comCobranca)
}


export async function buscarReservaCliPorId(id) {
  await processarAtrasos()
  const reservaCli = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })
  return comCobranca(reservaCli)
}


export async function atualizarReservaCli(id, dados) {
  const reservaCli = await prismaClient.reservaCli.update({
    where: { id },
    data: {
      data:         dados.data ? new Date(dados.data) : undefined,
      hora:         dados.hora ? new Date(dados.hora) : undefined,
      horaSaida:    dados.horaSaida ? new Date(dados.horaSaida) : undefined,
      fk_idCliente: dados.fk_idCliente,
      fk_idReserva: dados.fk_idReserva,
      fk_idCarro:   dados.fk_idCarro,
    },
    include: relacoes
  })
  return reservaCli
}


export async function deletarReservaCli(id) {
  await prismaClient.reservaCli.delete({
    where: { id }
  })
}


async function codigoLivre() {
  for (let i = 0; i < 20; i++) {
    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    const existe = await prismaClient.reservaCli.findFirst({
      where: {
        OR: [
          { codigoPresenca: codigo },
          { codigoSaida: codigo }
        ]
      }
    })
    if (!existe) return codigo
  }
  return String(Date.now()).slice(-6)
}


export async function gerarCodigoPresenca(id) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_AGUARDANDO.includes(item.reserva?.status)) {
    throw new Error('Só é possível gerar código para reserva aguardando chegada.')
  }

  const atualizado = await prismaClient.reservaCli.update({
    where: { id },
    data: { codigoPresenca: await codigoLivre() },
    include: relacoes
  })

  avisarPresenca(id, {
    tipo: 'codigo-gerado',
    codigo: atualizado.codigoPresenca
  })

  return atualizado
}


export async function confirmarPresenca(id, codigoDigitado) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!STATUS_AGUARDANDO.includes(item.reserva?.status)) {
    throw new Error('Esta reserva não está aguardando confirmação de presença.')
  }

  if (!item.codigoPresenca) {
    throw new Error('O pátio ainda não gerou o código de entrada.')
  }

  const codigo = String(codigoDigitado || '').replace(/\s/g, '')

  if (codigo !== item.codigoPresenca) {
    throw new Error('Código inválido.')
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.reserva.update({
      where: { id: item.fk_idReserva },
      data: { status: 'Ativa' }
    })

    if (item.reserva?.vaga?.id) {
      await tx.vaga.update({
        where: { id: item.reserva.vaga.id },
        data: { status: 'Ocupada' }
      })
    }

    await tx.reservaCli.update({
      where: { id },
      data: { codigoPresenca: null, entradaEm: new Date() }
    })
  })

  avisarPresenca(id, { tipo: 'presenca-confirmada' })

  return prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })
}


const STATUS_SAIDA = STATUS_EM_ANDAMENTO


// Só o dono da reserva ou a equipe do pátio mexem no dinheiro dela
function conferirAcesso(item, auth) {
  if (!auth) throw erroHttp(401, 'Faça login para continuar.')

  if (!ehEquipe(auth) && item.fk_idCliente !== auth.sub) {
    throw erroHttp(403, 'Esta reserva pertence a outra pessoa.')
  }
}


export async function gerarCodigoSaida(id) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  if (!situacaoDaOcupacao(item).exigeCodigoSaida) {
    throw erroHttp(409, 'Só existe código de saída para quem está ocupando a vaga. Esta reserva não tem entrada registrada ativa.')
  }

  const atualizado = await prismaClient.reservaCli.update({
    where: { id },
    data: { codigoSaida: await codigoLivre() },
    include: relacoes
  })

  avisarPresenca(id, {
    tipo: 'codigo-saida-gerado',
    codigo: atualizado.codigoSaida
  })

  return atualizado
}


// Erro que avisa o front que, para este caso, o código de saída é obrigatório
function erroCodigoSaida(mensagem) {
  const erro = erroHttp(400, mensagem)
  erro.exigeCodigoSaida = true
  return erro
}


// Cancela a reserva em andamento e abre o pedido de reembolso, tudo numa transação.
//
// O código de saída depende da ocupação REAL (ocupacaoservice.js):
//   - ocupando    -> exige o código gerado pelo pátio, grava saidaEm e libera a vaga
//   - sem entrada -> não exige código: nunca houve ocupação para encerrar
// Quem entrar com status que já mudou (corrida) leva 409 e nada é gravado.
export async function cancelarComReembolso(id, { codigo, motivo, auth } = {}) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  conferirAcesso(item, auth)

  if (!STATUS_SAIDA.includes(item.reserva?.status)) {
    throw erroHttp(409, 'Esta reserva não pode mais ser cancelada com reembolso.')
  }

  const ocupacao = situacaoDaOcupacao(item)

  if (ocupacao.exigeCodigoSaida) {
    const digitado = String(codigo || '').replace(/\s/g, '')

    if (!digitado) {
      throw erroCodigoSaida('Você está ocupando uma vaga. Para pedir o reembolso é preciso sair do estacionamento: informe o código de saída passado pelo pátio.')
    }

    if (!item.codigoSaida) {
      throw erroCodigoSaida('O pátio ainda não gerou o código de saída. Procure um funcionário para sair da vaga.')
    }

    if (digitado !== item.codigoSaida) {
      throw erroCodigoSaida('Código de saída inválido.')
    }
  }

  const conta = calcularEstorno(item)
  const agora = new Date()

  const reembolso = await prismaClient.$transaction(async (tx) => {
    // só uma chamada vence: evita cancelar e estornar duas vezes.
    // Sem entrada só cancela enquanto ninguém entrou; ocupando, só quem ainda está dentro.
    const virou = await tx.reserva.updateMany({
      where: {
        id: item.fk_idReserva,
        status: ocupacao.ocupacaoAtiva ? { in: STATUS_SAIDA } : { in: STATUS_AGUARDANDO_CHEGADA }
      },
      data: { status: 'Cancelada' }
    })

    if (virou.count === 0) {
      throw erroHttp(409, 'A situação desta reserva mudou. Atualize a página e tente de novo.')
    }

    if (item.reserva?.vaga?.id) {
      await tx.vaga.update({
        where: { id: item.reserva.vaga.id },
        data: { status: 'Livre' }
      })
    }

    await tx.reservaCli.update({
      where: { id },
      data: {
        codigoSaida: null,
        codigoPresenca: null,
        // só quem estava dentro tem saída; quem nunca entrou mantém o horário planejado
        ...(ocupacao.ocupacaoAtiva ? { horaSaida: agora, saidaEm: agora } : {})
      }
    })

    const jaTem = await tx.reembolso.findFirst({
      where: { fk_reservacli: id, status: { in: ['Pendente', 'Aprovada'] } }
    })

    if (jaTem || !item.fk_idCliente) return jaTem

    return tx.reembolso.create({
      data: {
        valorPago:     conta.pago,
        valorDevolver: conta.reembolso,
        minutosUsados: conta.minutosUsados,
        valorUsado:    conta.valorUsado,
        motivo:        motivo || (ocupacao.ocupacaoAtiva
          ? 'Cancelamento antecipado com código de saída'
          : 'Cancelamento antes da entrada'),
        status:        'Pendente',
        observacao:    ocupacao.ocupacaoAtiva
          ? 'Confirmado com o código de saída do pátio.'
          : 'Cancelado antes da entrada: não houve ocupação, por isso não foi pedido código de saída.',
        fk_reservacli: id,
        fk_idCliente:  item.fk_idCliente
      }
    })
  }, { maxWait: 10000, timeout: 15000 }).catch((erro) => {
    // pedidos simultâneos: quem perde a disputa recebe um aviso claro, não um erro do banco
    if (['P2028', 'P2034', 'P2002'].includes(erro?.code)) {
      throw erroHttp(409, 'Esta reserva já está sendo encerrada. Atualize a página para ver o resultado.')
    }

    throw erro
  })

  avisarPresenca(id, { tipo: 'saida-confirmada' })

  const atualizado = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  return {
    ...comCobranca(atualizado),
    estorno: conta,
    exigiuCodigoSaida: ocupacao.exigeCodigoSaida,
    reembolso
  }
}


export async function confirmarSaida(id, codigoDigitado, motivo, auth) {
  const { reembolso, ...resposta } = await cancelarComReembolso(id, {
    codigo: codigoDigitado,
    motivo,
    auth
  })

  return resposta
}


export async function sairDaVaga(id, codigoDigitado, pagamento, auth) {
  await processarAtrasos()

  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  if (!item) {
    const erro = new Error('Reserva de cliente não encontrada')
    erro.status = 404
    throw erro
  }

  conferirAcesso(item, auth)

  if (item.reserva?.status !== 'Ativa') {
    throw new Error('Só é possível sair de uma vaga que está ativa.')
  }

  if (!item.codigoSaida) {
    throw new Error('O pátio ainda não gerou o código de saída.')
  }

  const codigo = String(codigoDigitado || '').replace(/\s/g, '')

  if (codigo !== item.codigoSaida) {
    throw new Error('Código de saída inválido.')
  }

  // valor em aberto = tempo extra devido − o que a equipe já recebeu antes da saída
  const cobranca = resumoDeCobranca(item)
  const extra = {
    minutos: cobranca.extraMinutos,
    valor:   cobranca.emAberto
  }
  const tipo = pagamento?.tipo

  if (extra.valor > 0 && !Object.keys(FORMAS_DE_PAGAMENTO).includes(tipo)) {
    const erro = new Error('Informe como vai pagar o tempo extra.')
    erro.status = 400
    throw erro
  }

  await prismaClient.$transaction(async (tx) => {
    // só uma chamada vence: evita sair e cobrar duas vezes
    const virou = await tx.reserva.updateMany({
      where: { id: item.fk_idReserva, status: 'Ativa' },
      data: { status: 'Concluída' }
    })

    if (virou.count === 0) {
      throw erroHttp(409, 'Esta reserva já foi encerrada.')
    }

    if (item.reserva?.vaga?.id) {
      await tx.vaga.update({
        where: { id: item.reserva.vaga.id },
        data: { status: 'Livre' }
      })
    }

    await tx.reservaCli.update({
      where: { id },
      data: {
        codigoSaida: null,
        codigoPresenca: null,
        horaSaida: new Date(),
        saidaEm: new Date()
      }
    })

    if (extra.valor > 0) {
      await tx.pagamento.create({
        data: {
          nome:       FORMAS_DE_PAGAMENTO[tipo],
          tipo,
          valor:      extra.valor,
          categoria:  'tempo_extra',
          fk_reserva: id
        }
      })
    }
  })

  avisarPresenca(id, { tipo: 'saida-confirmada' })

  const atualizado = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  return { ...atualizado, extra }
}

// Reserva + vínculo com o cliente + pagamento da taxa + vaga ocupada,
// tudo numa única transação. O valor é calculado aqui, nunca pelo front.
export async function reservar(dados, auth) {
  if (!auth || auth.perfil !== 'cliente') {
    throw erroHttp(403, 'Só o cliente logado pode reservar uma vaga.')
  }

  const forma = dados.formaPagamento

  if (!['pix', 'cartao'].includes(forma)) {
    throw erroHttp(400, 'Escolha PIX ou cartão para pagar a reserva.')
  }

  if (!dados.fk_vaga) throw erroHttp(400, 'Informe a vaga.')

  const hora = new Date(dados.hora)
  const horaSaida = new Date(dados.horaSaida)

  if (isNaN(hora.getTime()) || isNaN(horaSaida.getTime())) {
    throw erroHttp(400, 'Informe o horário de chegada e de saída.')
  }

  const minutos = minutosEntre(hora, horaSaida)

  if (minutos <= 0) {
    throw erroHttp(400, 'A saída precisa ser depois da chegada.')
  }

  if (hora.getTime() < Date.now() - 10 * 60 * 1000) {
    throw erroHttp(400, 'O horário de chegada já passou.')
  }

  const aberta = await prismaClient.reservaCli.findFirst({
    where: {
      fk_idCliente: auth.sub,
      reserva: { status: { in: STATUS_EM_ANDAMENTO } }
    },
    include: { reserva: true }
  })

  if (aberta) {
    throw erroHttp(
      409,
      aberta.reserva.status === 'Ativa'
        ? 'Você já tem uma vaga ativa. Encerre o uso atual para reservar outra.'
        : 'Você já tem uma reserva aguardando sua chegada. Confirme a presença no pátio para reservar outra vaga.'
    )
  }

  if (dados.fk_idCarro) {
    const carro = await prismaClient.carro.findUnique({ where: { id: dados.fk_idCarro } })

    if (!carro || carro.fk_idCliente !== auth.sub) {
      throw erroHttp(400, 'Veículo inválido para este cliente.')
    }
  }

  const criada = await prismaClient.$transaction(async (tx) => {
    const vaga = await tx.vaga.findUnique({ where: { id: dados.fk_vaga } })

    if (!vaga) throw erroHttp(404, 'Vaga não encontrada.')

    const conta = calcularReserva(vaga.preco, minutos)

    if (dados.valorEsperado !== undefined && dados.valorEsperado !== null) {
      const esperado = arredondar(dados.valorEsperado)

      if (Math.abs(esperado - conta.total) > 0.009) {
        const erro = erroHttp(409, 'O valor da reserva mudou. Confira o total e tente de novo.')
        erro.valorCorreto = conta.total
        throw erro
      }
    }

    // trava a vaga: só uma pessoa leva uma vaga livre
    const pegou = await tx.vaga.updateMany({
      where: { id: vaga.id, status: 'Livre' },
      data: { status: 'Reservada' }
    })

    if (pegou.count === 0) {
      throw erroHttp(409, 'Esta vaga não está mais disponível.')
    }

    const reserva = await tx.reserva.create({
      data: { status: 'Reservada', fk_vaga: vaga.id }
    })

    const reservaCli = await tx.reservaCli.create({
      data: {
        data:         dados.data ? new Date(dados.data) : hora,
        hora,
        horaSaida,
        fk_idCliente: auth.sub,
        fk_idReserva: reserva.id,
        fk_idCarro:   dados.fk_idCarro || null
      }
    })

    await tx.pagamento.create({
      data: {
        nome:       FORMAS_DE_PAGAMENTO[forma],
        tipo:       forma,
        valor:      conta.total,
        categoria:  'taxa',
        fk_reserva: reservaCli.id
      }
    })

    return { id: reservaCli.id, conta }
  })

  const completa = await prismaClient.reservaCli.findUnique({
    where: { id: criada.id },
    include: relacoes
  })

  return { ...comCobranca(completa), conta: criada.conta }
}
