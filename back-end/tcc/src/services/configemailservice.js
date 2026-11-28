import 'dotenv/config'
import prismaClient from '../prisma/index.js'
import { cifrar, decifrar } from '../cripto.js'
import { erroHttp } from '../auth.js'
import {
  verificarConexao,
  enviarEmail,
  diagnosticoSmtp,
  mensagemDeErroSmtp,
  montarEmailTeste,
  linkLogin
} from '../email.js'


// Configuração do envio de e-mail (SMTP), guardada no banco e gerenciada pelo
// administrador. A senha é cifrada ao gravar e nunca volta para o front-end,
// para a resposta da API nem para os logs.

const ID = 'smtp'

const REGEX_HOST = /^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/
const REGEX_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/


function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}


// Valida e normaliza o que veio do formulário.
// Senha em branco só reaproveita a salva se o servidor e o usuário não mudaram:
// senão a senha antiga seria enviada para outro servidor sem o admin digitá-la.
async function normalizar(dados = {}) {
  const host = texto(dados.host).toLowerCase()
  const porta = Number(dados.porta)
  const usuario = texto(dados.usuario)
  const emailRemetente = texto(dados.emailRemetente)
  const nomeRemetente = texto(dados.nomeRemetente).replace(/[\u0000-\u001f"<>]/g, '') || 'VagaConnect'

  if (!host || !REGEX_HOST.test(host)) {
    throw erroHttp(400, 'Informe o servidor SMTP (ex.: smtp.gmail.com).')
  }

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw erroHttp(400, 'A porta precisa ser um número entre 1 e 65535.')
  }

  if (typeof dados.seguro !== 'boolean') {
    throw erroHttp(400, 'Informe se a conexão usa SSL/TLS.')
  }

  if (!usuario || usuario.length > 254 || /[\u0000-\u001f]/.test(usuario)) {
    throw erroHttp(400, 'Informe o usuário do servidor de e-mail.')
  }

  if (!emailRemetente || emailRemetente.length > 254 || !REGEX_EMAIL.test(emailRemetente)) {
    throw erroHttp(400, 'Informe um e-mail de remetente válido.')
  }

  if (nomeRemetente.length > 60) {
    throw erroHttp(400, 'O nome do remetente pode ter no máximo 60 caracteres.')
  }

  let urlFront

  try {
    const url = new URL(texto(dados.urlFront))

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('url')
    }

    urlFront = (url.origin + url.pathname).replace(/\/+$/, '')
  } catch {
    throw erroHttp(400, 'Informe o endereço do sistema completo, como http://127.0.0.1:5500/front-end (sem parâmetros).')
  }

  let senha = typeof dados.senha === 'string' ? dados.senha : ''

  if (senha.length > 512) {
    throw erroHttp(400, 'A senha é longa demais.')
  }

  if (!senha) {
    const salva = await prismaClient.configEmail.findUnique({ where: { id: ID } })

    if (salva && salva.host === host && salva.usuario.toLowerCase() === usuario.toLowerCase()) {
      senha = lerSenha(salva)
    } else {
      throw erroHttp(400, salva
        ? 'Você mudou o servidor ou o usuário: digite a senha novamente.'
        : 'Informe a senha do servidor de e-mail.')
    }
  }

  return { host, porta, seguro: dados.seguro, usuario, senha, emailRemetente, nomeRemetente, urlFront }
}


function lerSenha(registro) {
  try {
    return decifrar(registro.senhaCifrada)
  } catch {
    console.error('[email] não foi possível decifrar a senha SMTP salva (a chave CONFIG_SECRET mudou?)')
    throw erroHttp(500, 'A senha salva não pôde ser lida. Digite a senha e salve a configuração novamente.')
  }
}


// Tenta conectar e autenticar. Falhou: erro 422 com mensagem útil; o detalhe técnico vai para o log.
async function validarConexao(config) {
  try {
    await verificarConexao(config)
  } catch (error) {
    console.error('[email] falha ao validar a conexão SMTP:', diagnosticoSmtp(error, config))
    throw erroHttp(422, mensagemDeErroSmtp(error, config))
  }
}


// Configuração em uso para enviar e-mails (com a senha), ou null se não houver.
// Prioridade: banco (tela de Configurações). O .env só vale enquanto o banco estiver vazio.
export async function obterConfigAtiva() {
  const salva = await prismaClient.configEmail.findUnique({ where: { id: ID } })

  if (salva) {
    return {
      origem:         'banco',
      host:           salva.host,
      porta:          salva.porta,
      seguro:         salva.seguro,
      usuario:        salva.usuario,
      senha:          lerSenha(salva),
      emailRemetente: salva.emailRemetente,
      nomeRemetente:  salva.nomeRemetente,
      urlFront:       salva.urlFront
    }
  }

  const env = process.env

  if (env.SMTP_HOST || (env.SMTP_USER && env.SMTP_PASS)) {
    const porta = Number(env.SMTP_PORT) || 465

    return {
      origem:         'env',
      host:           env.SMTP_HOST || 'smtp.gmail.com',
      porta,
      seguro:         env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : porta === 465,
      usuario:        env.SMTP_USER || '',
      senha:          env.SMTP_PASS || '',
      emailRemetente: REGEX_EMAIL.test(env.SMTP_USER || '') ? env.SMTP_USER : 'no-reply@vagaconnect.local',
      nomeRemetente:  'VagaConnect',
      urlFront:       (env.FRONTEND_URL || '').replace(/\/+$/, '')
    }
  }

  return null
}


// Para o envio de e-mails do sistema: sem configuração completa não há envio
export async function exigirConfigAtiva() {
  const config = await obterConfigAtiva()

  if (!config) {
    throw new Error('Envio de e-mail não configurado (Administrador > Configurações > E-mail)')
  }

  if (!config.urlFront) {
    throw new Error('Endereço do sistema (urlFront) não configurado para os links de e-mail')
  }

  return config
}


// Visão da configuração para a tela: NUNCA inclui a senha
export async function descreverConfig() {
  const salva = await prismaClient.configEmail.findUnique({ where: { id: ID } })

  if (salva) {
    return {
      configurado:    true,
      origem:         'banco',
      host:           salva.host,
      porta:          salva.porta,
      seguro:         salva.seguro,
      usuario:        salva.usuario,
      emailRemetente: salva.emailRemetente,
      nomeRemetente:  salva.nomeRemetente,
      urlFront:       salva.urlFront,
      senhaDefinida:  true,
      verificadoEm:   salva.verificadoEm,
      atualizadoEm:   salva.atualizadoEm
    }
  }

  const env = await obterConfigAtiva()

  if (env) {
    return {
      configurado:    true,
      origem:         'env',
      host:           env.host,
      porta:          env.porta,
      seguro:         env.seguro,
      usuario:        env.usuario,
      emailRemetente: env.emailRemetente,
      nomeRemetente:  env.nomeRemetente,
      urlFront:       env.urlFront,
      senhaDefinida:  Boolean(env.senha),
      verificadoEm:   null,
      atualizadoEm:   null
    }
  }

  return { configurado: false, origem: null, senhaDefinida: false }
}


// Valida a conexão com os dados informados, sem gravar nada
export async function testarConexao(dados) {
  const config = await normalizar(dados)

  await validarConexao(config)

  return { ok: true }
}


// Só grava depois de a conexão com o servidor ter sido validada
export async function salvarConfig(dados, atualizadoPor) {
  const config = await normalizar(dados)

  await validarConexao(config)

  const gravado = {
    host:           config.host,
    porta:          config.porta,
    seguro:         config.seguro,
    usuario:        config.usuario,
    senhaCifrada:   cifrar(config.senha),
    emailRemetente: config.emailRemetente,
    nomeRemetente:  config.nomeRemetente,
    urlFront:       config.urlFront,
    verificadoEm:   new Date(),
    atualizadoPor:  atualizadoPor || null
  }

  await prismaClient.configEmail.upsert({
    where:  { id: ID },
    create: { id: ID, ...gravado },
    update: gravado
  })

  return descreverConfig()
}


export async function enviarEmailDeTeste(para) {
  const config = await obterConfigAtiva()

  if (!config) {
    throw erroHttp(409, 'Salve a configuração de e-mail antes de enviar um teste.')
  }

  if (!config.urlFront) {
    throw erroHttp(409, 'Informe o endereço do sistema na configuração de e-mail.')
  }

  const mensagem = montarEmailTeste({ link: linkLogin(config.urlFront) })

  try {
    await enviarEmail(config, { para, assunto: mensagem.assunto, texto: mensagem.texto, html: mensagem.html })
  } catch (error) {
    console.error('[email] falha ao enviar e-mail de teste:', diagnosticoSmtp(error, config))
    throw erroHttp(502, mensagemDeErroSmtp(error, config))
  }

  return { ok: true }
}
