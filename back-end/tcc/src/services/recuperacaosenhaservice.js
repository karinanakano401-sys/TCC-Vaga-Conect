import crypto from 'node:crypto'
import prismaClient from '../prisma/index.js'
import { erroHttp } from '../auth.js'
import { gerarHash, validarSenhaNova } from '../senha.js'
import { enviarEmail, linkRedefinicao, montarEmailRecuperacao, diagnosticoSmtp } from '../email.js'
import { exigirConfigAtiva } from './configemailservice.js'


export const VALIDADE_MIN = 30

const TIPOS = {
  usuario:     () => prismaClient.usuario,
  funcionario: () => prismaClient.funcionario
}


function hashDoToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}


function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim() : ''
}


// Procura o e-mail nas duas tabelas de login (sem diferenciar maiúsculas)
async function buscarContas(email) {
  const filtro = { email: { equals: email, mode: 'insensitive' } }
  const select = { id: true, nome: true, email: true }

  const [usuario, funcionario] = await Promise.all([
    prismaClient.usuario.findFirst({ where: filtro, select }),
    prismaClient.funcionario.findFirst({ where: filtro, select })
  ])

  const contas = []

  if (usuario)     contas.push({ tipo: 'usuario', ...usuario })
  if (funcionario) contas.push({ tipo: 'funcionario', ...funcionario })

  return contas
}


async function enviarParaConta(conta, config) {
  const agora = new Date()

  // pedido novo cancela os anteriores ainda não usados
  await prismaClient.recuperacaoSenha.updateMany({
    where: { tipo: conta.tipo, contaId: conta.id, usadoEm: null },
    data:  { usadoEm: agora }
  })

  const token = crypto.randomBytes(32).toString('base64url')

  const registro = await prismaClient.recuperacaoSenha.create({
    data: {
      tokenHash: hashDoToken(token),
      tipo:      conta.tipo,
      contaId:   conta.id,
      expiraEm:  new Date(agora.getTime() + VALIDADE_MIN * 60 * 1000)
    }
  })

  try {
    const mensagem = montarEmailRecuperacao({
      nome:       conta.nome,
      link:       linkRedefinicao(token, config.urlFront),
      validadeMin: VALIDADE_MIN
    })

    await enviarEmail(config, {
      para:    conta.email,
      assunto: mensagem.assunto,
      texto:   mensagem.texto,
      html:    mensagem.html
    })
  } catch (error) {
    console.error('[recuperação de senha] falha no envio do e-mail:', diagnosticoSmtp(error, config))

    // o link não chegou a ninguém: invalida o pedido
    await prismaClient.recuperacaoSenha.update({
      where: { id: registro.id },
      data:  { usadoEm: new Date() }
    })

    throw error
  }
}


// Inicia a recuperação. Quem chama NÃO deve esperar nem expor o resultado,
// para a resposta ser igual com e-mail cadastrado ou não.
export async function solicitarRecuperacao(emailInformado) {
  const email = normalizarEmail(emailInformado)

  if (!email || email.length > 254) return

  // limpeza oportunista de pedidos antigos
  await prismaClient.recuperacaoSenha.deleteMany({
    where: { expiraEm: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
  })

  const contas = await buscarContas(email)

  if (contas.length === 0) return

  // sem e-mail configurado não há como enviar: avisa no log e não cria pedido à toa
  const config = await exigirConfigAtiva()

  for (const conta of contas) {
    await enviarParaConta(conta, config)
  }
}


async function buscarPedido(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 128) {
    throw erroHttp(400, 'Este link de redefinição é inválido.')
  }

  const pedido = await prismaClient.recuperacaoSenha.findUnique({
    where: { tokenHash: hashDoToken(token) }
  })

  if (!pedido) {
    throw erroHttp(400, 'Este link de redefinição é inválido.')
  }

  if (pedido.usadoEm) {
    throw erroHttp(410, 'Este link já foi utilizado ou substituído por um mais recente. Peça um novo link.')
  }

  if (pedido.expiraEm.getTime() <= Date.now()) {
    throw erroHttp(410, 'Este link expirou. Peça um novo link.')
  }

  return pedido
}


export async function validarToken(token) {
  await buscarPedido(token)

  return { valido: true }
}


export async function redefinirSenha({ token, senha, confirmarSenha }) {
  const pedido = await buscarPedido(token)

  validarSenhaNova(senha, confirmarSenha)

  const tabela = TIPOS[pedido.tipo]?.()

  if (!tabela) throw erroHttp(400, 'Este link de redefinição é inválido.')

  const novoHash = gerarHash(senha)
  const agora = new Date()

  await prismaClient.$transaction(async (tx) => {
    // uso único: só um pedido consegue "pegar" o token
    const uso = await tx.recuperacaoSenha.updateMany({
      where: { id: pedido.id, usadoEm: null, expiraEm: { gt: agora } },
      data:  { usadoEm: agora }
    })

    if (uso.count !== 1) {
      throw erroHttp(410, 'Este link já foi utilizado ou expirou. Peça um novo link.')
    }

    const modelo = pedido.tipo === 'usuario' ? tx.usuario : tx.funcionario

    // senhaAlteradaEm derruba as sessões (tokens de login) anteriores
    await modelo.update({
      where: { id: pedido.contaId },
      data:  { senha: novoHash, senhaAlteradaEm: agora }
    })

    // qualquer outro link pendente dessa conta também deixa de valer
    await tx.recuperacaoSenha.updateMany({
      where: { tipo: pedido.tipo, contaId: pedido.contaId, usadoEm: null },
      data:  { usadoEm: agora }
    })
  })

  return { ok: true }
}
