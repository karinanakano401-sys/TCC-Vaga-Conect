import prismaClient from '../prisma/index.js'


// Critérios de avaliação. Cada um vira uma "categoria" com nota (1 a 5) e comentário opcional.
export const CATEGORIAS = [
  {
    chave:    'geral',
    rotulo:   'Experiência geral',
    pergunta: 'Como foi a sua experiência geral neste estacionamento?',
    detalhe:  'Uma visão de conjunto: o que você sentiu do início ao fim da visita.'
  },
  {
    chave:    'disponibilidade',
    rotulo:   'Disponibilidade de vagas',
    pergunta: 'Havia vagas disponíveis e a vaga reservada estava livre?',
    detalhe:  'Facilidade para estacionar, vaga livre na chegada e vagas adequadas ao seu veículo.'
  },
  {
    chave:    'precos',
    rotulo:   'Preços e pagamentos',
    pergunta: 'O preço foi justo e transparente?',
    detalhe:  'Valor cobrado, clareza da tarifa, taxas extras e forma de pagamento.'
  },
  {
    chave:    'seguranca',
    rotulo:   'Segurança',
    pergunta: 'Você se sentiu seguro ao deixar o seu veículo aqui?',
    detalhe:  'Iluminação, vigilância, câmeras e controle de entrada e saída.'
  },
  {
    chave:    'estrutura',
    rotulo:   'Limpeza e conservação',
    pergunta: 'O estacionamento estava limpo e bem conservado?',
    detalhe:  'Piso, sinalização, iluminação, limpeza e estado geral da estrutura.'
  },
  {
    chave:    'acesso',
    rotulo:   'Localização e acessibilidade',
    pergunta: 'Foi fácil chegar, entrar, circular e sair?',
    detalhe:  'Localização, acesso, fluxo interno e adequação para PCD, idosos e carros elétricos.'
  },
  {
    chave:    'atendimento',
    rotulo:   'Atendimento da equipe',
    pergunta: 'A equipe foi atenciosa e profissional?',
    detalhe:  'Cordialidade, agilidade e ajuda na entrada, na saída e em dúvidas.'
  },
  {
    chave:    'informacoes',
    rotulo:   'Precisão das informações',
    pergunta: 'As condições reais batiam com o que a plataforma mostrava?',
    detalhe:  'Endereço, tipo de vaga, preço e disponibilidade informados no aplicativo.'
  }
]

const CHAVES = new Set(CATEGORIAS.map(c => c.chave))
const LIMITE_COMENTARIO = 500

// Só dá para avaliar um estacionamento que o usuário realmente usou.
const STATUS_AVALIAVEL = ['Ativa', 'Concluída']

const incluirEndereco = {
  endereco: { select: { rua: true, numero: true, bairro: true, cidade: true, estado: true } }
}

const relacoes = {
  usuario: {
    select: {
      id:    true,
      nome:  true,
      email: true
    }
  },
  estacionamento: {
    select: { id: true, nome: true, ...incluirEndereco }
  },
  reservaCli: {
    select: {
      id:        true,
      hora:      true,
      horaSaida: true,
      reserva: {
        select: { vaga: { select: { numero: true, tipo: true } } }
      }
    }
  },
  notas: true
}


function validarNotas(lista) {
  if (!Array.isArray(lista)) throw new Error('Avalie pelo menos uma categoria.')

  const vistas = new Set()
  const notas  = []

  for (const item of lista) {
    const comentario = String(item?.comentario ?? '').trim()
    const semNota    = item?.nota === undefined || item?.nota === null || item?.nota === ''

    // Categoria pulada: sem nota e sem comentário.
    if (semNota && !comentario) continue

    const categoria = CATEGORIAS.find(c => c.chave === item?.categoria)
    if (!categoria) throw new Error('Categoria de avaliação inválida.')
    if (vistas.has(categoria.chave)) throw new Error(`A categoria "${categoria.rotulo}" foi enviada mais de uma vez.`)

    const nota = Number(item.nota)
    if (semNota || !Number.isInteger(nota) || nota < 1 || nota > 5) {
      throw new Error(`Dê uma nota de 1 a 5 para "${categoria.rotulo}".`)
    }
    if (comentario.length > LIMITE_COMENTARIO) {
      throw new Error(`O comentário de "${categoria.rotulo}" passa de ${LIMITE_COMENTARIO} caracteres.`)
    }

    vistas.add(categoria.chave)
    notas.push({ categoria: categoria.chave, nota, comentario })
  }

  if (notas.length === 0) throw new Error('Avalie pelo menos uma categoria.')
  return notas
}

// A nota geral do feedback é a da "Experiência geral"; se ela foi pulada, vale a média das demais.
function calcularNotaGeral(notas) {
  const geral = notas.find(n => n.categoria === 'geral')
  if (geral) return geral.nota
  return Math.round(notas.reduce((soma, n) => soma + n.nota, 0) / notas.length)
}

function calcularMensagem(notas) {
  const geral = notas.find(n => n.categoria === 'geral' && n.comentario)
  return (geral ?? notas.find(n => n.comentario))?.comentario ?? ''
}


export function listarCategorias() {
  return CATEGORIAS
}


export async function criarFeedback(dados) {
  if (!dados?.fk_idCliente) throw new Error('Usuário não identificado.')
  if (!dados?.fk_reservacli) throw new Error('Escolha a visita que você quer avaliar.')

  const notas = validarNotas(dados.notas)

  const visita = await prismaClient.reservaCli.findUnique({
    where: { id: dados.fk_reservacli },
    include: {
      feedback: { select: { id: true } },
      reserva: { include: { vaga: { include: { estacionamento: true } } } }
    }
  })

  if (!visita) throw new Error('Visita não encontrada.')
  if (visita.fk_idCliente !== dados.fk_idCliente) throw new Error('Esta visita não pertence à sua conta.')
  if (!STATUS_AVALIAVEL.includes(visita.reserva?.status)) {
    throw new Error('Você só pode avaliar estacionamentos que já utilizou.')
  }
  if (visita.feedback) throw new Error('Você já avaliou esta visita.')

  const estacionamento = visita.reserva.vaga.estacionamento

  try {
    return await prismaClient.feedback.create({
      data: {
        nota:          calcularNotaGeral(notas),
        assunto:       `Avaliação · ${estacionamento.nome}`,
        categoria:     'Avaliação do estacionamento',
        mensagem:      calcularMensagem(notas),
        fk_idCliente:  dados.fk_idCliente,
        fk_est:        estacionamento.id,
        fk_reservacli: visita.id,
        notas:         { create: notas }
      },
      include: relacoes
    })
  } catch (error) {
    if (error.code === 'P2002') throw new Error('Você já avaliou esta visita.')
    throw error
  }
}


export async function listarFeedbacks({ cliente, estacionamento } = {}) {
  const where = {}
  if (cliente)        where.fk_idCliente = cliente
  if (estacionamento) where.fk_est       = estacionamento

  return prismaClient.feedback.findMany({
    where,
    include: relacoes,
    orderBy: { createdAt: 'desc' }
  })
}


// Visitas do usuário que podem ser avaliadas (já entrou no estacionamento), da mais recente para a mais antiga.
export async function listarVisitasDoUsuario(idCliente) {
  const visitas = await prismaClient.reservaCli.findMany({
    where: {
      fk_idCliente: idCliente,
      reserva: { status: { in: STATUS_AVALIAVEL } }
    },
    include: {
      feedback: { select: { id: true } },
      reserva: {
        include: {
          vaga: { include: { estacionamento: { include: incluirEndereco } } }
        }
      }
    },
    orderBy: { hora: 'desc' }
  })

  return visitas.map(v => ({
    id:        v.id,
    hora:      v.hora,
    horaSaida: v.horaSaida,
    status:    v.reserva.status,
    avaliada:  Boolean(v.feedback),
    vaga: {
      numero: v.reserva.vaga.numero,
      tipo:   v.reserva.vaga.tipo
    },
    estacionamento: {
      id:       v.reserva.vaga.estacionamento.id,
      nome:     v.reserva.vaga.estacionamento.nome,
      endereco: v.reserva.vaga.estacionamento.endereco
    }
  }))
}


function mediaDe(valores) {
  if (!valores.length) return null
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
}

// Médias por estacionamento e por categoria (usado na tela dos usuários e no painel do admin).
export async function resumoPorEstacionamento() {
  const feedbacks = await prismaClient.feedback.findMany({
    where: { fk_est: { not: null } },
    include: {
      notas: true,
      estacionamento: { select: { id: true, nome: true, ...incluirEndereco } }
    }
  })

  const mapa = new Map()

  for (const f of feedbacks) {
    if (!f.estacionamento) continue
    if (!mapa.has(f.fk_est)) mapa.set(f.fk_est, { estacionamento: f.estacionamento, gerais: [], porCategoria: {} })

    const grupo = mapa.get(f.fk_est)
    grupo.gerais.push(f.nota)
    for (const n of f.notas) {
      (grupo.porCategoria[n.categoria] ??= []).push(n.nota)
    }
  }

  return [...mapa.values()]
    .map(({ estacionamento, gerais, porCategoria }) => ({
      id:         estacionamento.id,
      nome:       estacionamento.nome,
      endereco:   estacionamento.endereco,
      avaliacoes: gerais.length,
      media:      mediaDe(gerais),
      categorias: Object.fromEntries(
        CATEGORIAS
          .filter(c => porCategoria[c.chave])
          .map(c => [c.chave, { media: mediaDe(porCategoria[c.chave]), total: porCategoria[c.chave].length }])
      )
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}


// Avaliações de um estacionamento para outros usuários: sem e-mail, só o primeiro nome.
export async function listarAvaliacoesPublicas(idEstacionamento) {
  const feedbacks = await prismaClient.feedback.findMany({
    where: { fk_est: idEstacionamento },
    include: {
      notas:   true,
      usuario: { select: { nome: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return feedbacks.map(f => ({
    id:        f.id,
    createdAt: f.createdAt,
    nota:      f.nota,
    nome:      (f.usuario?.nome ?? 'Usuário').trim().split(/\s+/)[0],
    notas:     f.notas.map(n => ({ categoria: n.categoria, nota: n.nota, comentario: n.comentario }))
  }))
}


export async function buscarFeedbackPorId(id) {
  return prismaClient.feedback.findUnique({
    where: { id },
    include: relacoes
  })
}


// Substitui as notas de uma avaliação já enviada.
export async function atualizarFeedback(id, dados) {
  const existente = await prismaClient.feedback.findUnique({ where: { id } })
  if (!existente) throw new Error('Feedback não encontrado')

  const notas = validarNotas(dados?.notas)

  await prismaClient.$transaction([
    prismaClient.notaFeedback.deleteMany({ where: { fk_feedback: id } }),
    prismaClient.feedback.update({
      where: { id },
      data: {
        nota:     calcularNotaGeral(notas),
        mensagem: calcularMensagem(notas),
        notas:    { create: notas }
      }
    })
  ])

  return buscarFeedbackPorId(id)
}


export async function deletarFeedback(id) {
  await prismaClient.feedback.delete({
    where: { id }
  })
}
