import prismaClient from '../prisma/index.js'
import { processarAtrasos, STATUS_AGUARDANDO } from './atrasoservice.js'
import { situacaoDaOcupacao, STATUS_AGUARDANDO_CHEGADA } from './ocupacaoservice.js'
import { avisarPresenca } from '../websocket.js'
import { ehEquipe, erroHttp } from '../auth.js'
import {
  ativarAgendamentos,
  buscarConflito,
  erroConflito,
  liberarVaga,
  vagaEhDestaReserva,
  validarDuracao,
  validarHorarioEntrada,
  DURACAO_MAXIMA_MIN
} from './agendamentoservice.js'
import {
  STATUS_EM_ANDAMENTO,
  FORMAS_DE_PAGAMENTO,
  calcularReserva,
  calcularEstorno,
  resumoDeCobranca,
  faseDoPrazo,
  arredondar
} from './cobrancaservice.js'


const relacoes = {
  usuario:    { omit: { senha: true } },
  carro:      true,
  pagamentos: true,
  reserva:    { include: { vaga: { include: {
    estacionamento: true,
    // quem está dentro da vaga agora (para não confundir agendamento com ocupação)
    reservas: { where: { status: 'Ativa' }, select: { id: true, status: true } }
  } } } }
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


// Acrescenta a situação de cobrança calculada no servidor (campos novos, aditivos).
// prazo + servidorAgora dizem ao front em que fase do tempo contratado a reserva
// está, pelo relógio do servidor (o front só acompanha, quem decide é o backend).
function comCobranca(item) {
  if (!item) return item
  const agora = new Date()
  const ocupacao = situacaoDaOcupacao(item)

  // agendada = reserva futura (a vaga ainda não é dela);
  // aguardandoVaga = a hora chegou, mas outro cliente ainda está na vaga
  const aguardando = STATUS_AGUARDANDO.includes(item.reserva?.status)
  const chegou = new Date(item.hora).getTime() <= agora.getTime()
  const outraDentro = (item.reserva?.vaga?.reservas || []).some(
    (r) => r.status === 'Ativa' && r.id !== item.reserva?.id
  )

  const { reservas: _dentro, ...vagaLimpa } = item.reserva?.vaga || {}

  return {
    ...item,
    reserva: item.reserva ? { ...item.reserva, vaga: item.reserva.vaga ? vagaLimpa : item.reserva.vaga } : item.reserva,
    cobranca: resumoDeCobranca(item, agora),
    ocupacao,
    prazo: faseDoPrazo(item, agora),
    agendamento: {
      agendada: aguardando && !chegou,
      aguardandoVaga: aguardando && chegou && outraDentro,
      iniciaEm: new Date(item.hora).toISOString()
    },
    servidorAgora: agora.toISOString()
  }
}


// Tempo contratado terminou: não há mais cancelamento com reembolso,
// só a finalização da utilização.
export function erroPrazoVencido() {
  const erro = erroHttp(409, 'O tempo contratado desta reserva terminou. Não é mais possível pedir reembolso: finalize a utilização.')
  erro.exigeFinalizar = true
  return erro
}


// idCliente opcional: a equipe lista todas; o cliente só as dele
export async function listarReservaClis(idCliente) {
  await processarAtrasos()
  const reservaClis = await prismaClient.reservaCli.findMany({
    where: idCliente ? { fk_idCliente: idCliente } : undefined,
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
  const dadosDaAtualizacao = {
    data:         dados.data ? new Date(dados.data) : undefined,
    hora:         dados.hora ? new Date(dados.hora) : undefined,
    horaSaida:    dados.horaSaida ? new Date(dados.horaSaida) : undefined,
    fk_idCliente: dados.fk_idCliente,
    fk_idReserva: dados.fk_idReserva,
    fk_idCarro:   dados.fk_idCarro,
  }

  // sem mudança de período não há o que conferir na agenda da vaga
  if (!dados.hora && !dados.horaSaida) {
    return prismaClient.reservaCli.update({
      where: { id },
      data: dadosDaAtualizacao,
      include: relacoes
    })
  }

  // mudar o período (ex.: prorrogação) não pode invadir a janela de outra reserva da
  // mesma vaga; confere e grava na mesma transação, com a vaga travada
  await prismaClient.$transaction(async (tx) => {
    const atual = await tx.reservaCli.findUnique({
      where: { id },
      include: { reserva: true }
    })

    if (!atual) throw erroHttp(404, 'Reserva de cliente não encontrada')

    const vagaId = atual.reserva.fk_vaga

    await tx.$queryRaw`SELECT id FROM "Vaga" WHERE id = ${vagaId} FOR UPDATE`

    const inicio = new Date(dados.hora || atual.hora)
    const fim = new Date(dados.horaSaida || atual.horaSaida)

    if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
      // limite de 24 h de ocupação: prorrogar não pode passar disso
      // (reservas antigas já maiores só não podem crescer mais)
      const novaDuracao = fim.getTime() - inicio.getTime()
      const duracaoAtual = new Date(atual.horaSaida).getTime() - new Date(atual.hora).getTime()

      if (novaDuracao > DURACAO_MAXIMA_MIN * 60000 && novaDuracao > duracaoAtual) {
        throw erroHttp(400, 'O tempo máximo de utilização de uma reserva é de 24 horas.')
      }

      const base = { vagaId, ignorarReservaCliId: id }

      let conflito = await buscarConflito(tx, { ...base, inicio, fim })

      if (conflito) {
        // Reservas criadas antes da margem de 24 h podem já estar "coladas" em outra.
        // Isso não impede a prorrogação, mas ela nunca pode invadir o horário real
        // (nem a tolerância) da outra reserva.
        const antes = await buscarConflito(tx, { ...base, inicio: atual.hora, fim: atual.horaSaida })

        if (antes && antes.reservaCliId === conflito.reservaCliId) {
          conflito = await buscarConflito(tx, { ...base, inicio, fim, margemMs: 0 })
        }
      }

      if (conflito) throw erroConflito(conflito)
    }

    await tx.reservaCli.update({ where: { id }, data: dadosDaAtualizacao })
  })

  return prismaClient.reservaCli.findUnique({ where: { id }, include: relacoes })
}


// Prorrogação feita pelo próprio cliente: só a hora de saída, para depois da atual,
// em até 1 hora por vez, numa reserva em andamento. Nada mais da reserva muda
// (cliente, vaga, veículo e entrada ficam como estão); o conflito com outras
// reservas e o limite de 24 h são conferidos em atualizarReservaCli.
export async function prorrogarComoCliente(id, dados) {
  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: { reserva: true }
  })

  if (!item) throw erroHttp(404, 'Reserva de cliente não encontrada')

  if (!STATUS_EM_ANDAMENTO.includes(item.reserva?.status)) {
    throw erroHttp(409, 'Só é possível prorrogar uma reserva em andamento.')
  }

  const nova = new Date(dados?.horaSaida)
  const atual = new Date(item.horaSaida)

  if (!dados?.horaSaida || isNaN(nova.getTime()) || isNaN(atual.getTime())) {
    throw erroHttp(400, 'Informe a nova hora de saída.')
  }

  if (nova.getTime() <= atual.getTime()) {
    throw erroHttp(400, 'A nova saída precisa ser depois da saída atual.')
  }

  if (nova.getTime() - atual.getTime() > 60 * 60000 + 1000) {
    throw erroHttp(400, 'Cada prorrogação pode acrescentar no máximo 1 hora.')
  }

  return atualizarReservaCli(id, { horaSaida: nova.toISOString() })
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


// A entrada só existe a partir da hora marcada (agendamento futuro não ocupa
// a vaga) e com a vaga livre para esta reserva (sem outro cliente dentro).
function conferirChegada(item) {
  const hora = new Date(item.hora)

  if (!isNaN(hora.getTime()) && hora.getTime() > Date.now()) {
    const quando = hora.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

    throw erroHttp(409, `Esta reserva está agendada para ${quando}. A entrada só pode ser confirmada a partir do horário contratado.`)
  }

  const outraDentro = (item.reserva?.vaga?.reservas || []).some(
    (r) => r.status === 'Ativa' && r.id !== item.reserva?.id
  )

  if (outraDentro) {
    throw erroHttp(409, 'A vaga ainda está com outro cliente. Aguarde o pátio liberá-la para confirmar a entrada.')
  }
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

  conferirChegada(item)

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

  conferirChegada(item)

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

  // o servidor é quem decide: depois do fim do tempo contratado só existe finalizar
  if (faseDoPrazo(item).vencido) {
    throw erroPrazoVencido()
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
    // agendamento futuro não segura a vaga: só libera se ela era mesmo desta reserva
    const eraDona = await vagaEhDestaReserva(tx, item.reserva?.vaga?.id, id)

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

    if (eraDona) {
      await liberarVaga(tx, item.reserva.vaga.id)
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

  // a vaga ficou livre: se há alguém esperando a hora, ela já passa a Reservada
  await ativarAgendamentos()

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

  // a vaga ficou livre: se há alguém esperando a hora, ela já passa a Reservada
  await ativarAgendamentos()

  avisarPresenca(id, { tipo: 'saida-confirmada' })

  const atualizado = await prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  return { ...atualizado, extra }
}


// Finalização da utilização, depois do fim do tempo contratado.
//
//  - dentro do prazo      -> 409: para sair antes existe o cancelamento
//  - ocupando a vaga      -> exige o código de saída (sairDaVaga valida o código,
//                            grava saidaEm, libera a vaga e só cobra tempo extra
//                            DEPOIS da tolerância de 10 min; dentro dela é R$ 0)
//  - nunca entrou         -> sem código: encerra a reserva e libera a vaga, sem
//                            cobrança e sem reembolso
//  - já saiu / já finalizada -> sem código e sem repetir nada (idempotente)
//
// Quem encerra primeiro vence (updateMany condicional): nunca finaliza duas vezes.
export async function finalizarUtilizacao(id, { codigo, pagamento } = {}, auth) {
  await processarAtrasos()

  const buscar = () => prismaClient.reservaCli.findUnique({
    where: { id },
    include: relacoes
  })

  const item = await buscar()

  if (!item) throw erroHttp(404, 'Reserva de cliente não encontrada')

  conferirAcesso(item, auth)

  const status = item.reserva?.status

  const jaFinalizada = (atual) => ({
    ...comCobranca(atual),
    finalizada: true,
    jaFinalizada: true,
    exigiuCodigoSaida: false
  })

  if (status === 'Concluída') return jaFinalizada(item)

  if (status === 'Cancelada') {
    throw erroHttp(409, 'Esta reserva foi cancelada e não pode ser finalizada.')
  }

  if (!STATUS_EM_ANDAMENTO.includes(status)) {
    throw erroHttp(409, 'Esta reserva não está em andamento.')
  }

  if (!faseDoPrazo(item).vencido) {
    throw erroHttp(409, 'O tempo contratado ainda não terminou. Para sair antes, use o cancelamento.')
  }

  const ocupacao = situacaoDaOcupacao(item)

  // dentro da vaga: o código de saída é obrigatório
  if (ocupacao.exigeCodigoSaida) {
    if (status !== 'Ativa') {
      throw erroHttp(409, 'A situação desta reserva mudou. Atualize a página e tente de novo.')
    }

    if (!String(codigo || '').replace(/\s/g, '')) {
      throw erroCodigoSaida('Você está ocupando uma vaga. Informe o código de saída passado pelo pátio para finalizar.')
    }

    const saida = await sairDaVaga(id, codigo, pagamento, auth)

    return { ...saida, finalizada: true, jaFinalizada: false, exigiuCodigoSaida: true }
  }

  // sem ocupação ativa (nunca entrou, ou a saída já foi registrada): sem código
  const vagaId = item.reserva?.vaga?.id

  const encerrou = await prismaClient.$transaction(async (tx) => {
    // libera conforme o estado real: só mexe na vaga se ela estava com esta reserva
    const eraDona = await vagaEhDestaReserva(tx, vagaId, id)

    const virou = await tx.reserva.updateMany({
      where: { id: item.fk_idReserva, status: { in: STATUS_EM_ANDAMENTO } },
      data: { status: 'Concluída' }
    })

    if (virou.count === 0) return false

    if (eraDona) {
      await liberarVaga(tx, vagaId)
    }

    // nenhum pagamento nem reembolso é criado aqui; entradaEm/saidaEm/horaSaida ficam como estão
    await tx.reservaCli.update({
      where: { id },
      data: { codigoSaida: null, codigoPresenca: null }
    })

    return true
  }, { maxWait: 10000, timeout: 15000 })

  const atual = await buscar()

  // perdeu a corrida: se a outra chamada concluiu, responde como já finalizada
  if (!encerrou) {
    if (atual?.reserva?.status === 'Concluída') return jaFinalizada(atual)

    throw erroHttp(409, 'A situação desta reserva mudou. Atualize a página e tente de novo.')
  }

  await ativarAgendamentos()

  avisarPresenca(id, { tipo: 'saida-confirmada' })

  return {
    ...comCobranca(atual),
    finalizada: true,
    jaFinalizada: false,
    exigiuCodigoSaida: false
  }
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

  // O horário de entrada é obrigatório e vem em intervalos de 30 min (08:00, 08:30...)
  const hora = validarHorarioEntrada(dados.hora)

  // A duração é obrigatória e vem em intervalos de 30 min (de 30 min a 24 h).
  // A saída é sempre calculada aqui: início + duração.
  const minutos = validarDuracao(dados.duracaoMinutos)
  const horaSaida = new Date(hora.getTime() + minutos * 60000)

  // se a tela mandar também a saída, ela precisa bater com a duração (anti-adulteração)
  if (dados.horaSaida !== undefined && dados.horaSaida !== null && dados.horaSaida !== '') {
    const informada = new Date(dados.horaSaida).getTime()

    if (isNaN(informada) || Math.abs(informada - horaSaida.getTime()) > 1000) {
      throw erroHttp(400, 'O horário de saída não confere com o tempo de utilização escolhido.')
    }
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
    // trava a linha da vaga: pedidos simultâneos para a mesma vaga entram um de cada vez,
    // então a checagem de conflito abaixo vale para todos
    await tx.$queryRaw`SELECT id FROM "Vaga" WHERE id = ${dados.fk_vaga} FOR UPDATE`

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

    // duas reservas nunca ocupam a mesma vaga ao mesmo tempo
    const agoraReserva = new Date()

    const conflito = await buscarConflito(tx, {
      vagaId: vaga.id,
      inicio: hora,
      fim: horaSaida,
      agora: agoraReserva
    })

    if (conflito) throw erroConflito(conflito)

    // Agendamento futuro NÃO bloqueia a vaga: ela só passa a 'Reservada' quando a
    // hora marcada chega (ativarAgendamentos). Reserva para agora trava a vaga já.
    if (hora.getTime() <= agoraReserva.getTime()) {
      const pegou = await tx.vaga.updateMany({
        where: { id: vaga.id, status: 'Livre' },
        data: { status: 'Reservada' }
      })

      if (pegou.count === 0) {
        throw erroHttp(409, 'Esta vaga não está mais disponível.')
      }
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
