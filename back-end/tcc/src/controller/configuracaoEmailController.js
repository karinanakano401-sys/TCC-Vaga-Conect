import express from 'express'
import prismaClient from '../prisma/index.js'
import * as configEmail from '../services/configemailservice.js'
import { autenticar, exigirPerfil, responderErro, erroHttp } from '../auth.js'
import { registrarTentativa } from '../limitador.js'

const router = express.Router()

// Só o administrador vê ou altera a configuração de e-mail
router.use(autenticar, exigirPerfil('admin'))

const MIN = 60 * 1000

// Cada validação abre uma conexão com um servidor externo: limite por administrador
const LIMITE_VALIDACAO = { max: 20, janelaMs: 15 * MIN }
const LIMITE_TESTE     = { max: 5,  janelaMs: 15 * MIN }

const REGEX_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/


function limitar(req, nome, limite) {
  const resultado = registrarTentativa(`${nome}:${req.auth.sub}`, limite)

  if (!resultado.permitido) {
    const minutos = Math.ceil(resultado.esperaSeg / 60)
    const erro = erroHttp(429, `Muitas tentativas. Aguarde ${minutos} minuto${minutos > 1 ? 's' : ''} e tente de novo.`)

    throw erro
  }
}


router.get('/', async (req, res) => {
  try {
    res.status(200).json(await configEmail.descreverConfig())
  } catch (error) {
    responderErro(res, error, 500)
  }
})


router.post('/testar', async (req, res) => {
  try {
    limitar(req, 'email-validar', LIMITE_VALIDACAO)

    await configEmail.testarConexao(req.body)

    res.status(200).json({ ok: true, mensagem: 'Conexão com o servidor de e-mail validada.' })
  } catch (error) {
    responderErro(res, error)
  }
})


router.put('/', async (req, res) => {
  try {
    limitar(req, 'email-validar', LIMITE_VALIDACAO)

    const config = await configEmail.salvarConfig(req.body, req.auth.sub)

    res.status(200).json(config)
  } catch (error) {
    responderErro(res, error)
  }
})


router.post('/enviar-teste', async (req, res) => {
  try {
    limitar(req, 'email-teste', LIMITE_TESTE)

    let para = typeof req.body?.para === 'string' ? req.body.para.trim() : ''

    if (!para) {
      const admin = await prismaClient.funcionario.findUnique({
        where:  { id: req.auth.sub },
        select: { email: true }
      })

      para = admin?.email || ''
    }

    if (!REGEX_EMAIL.test(para) || para.length > 254) {
      throw erroHttp(400, 'Informe um e-mail válido para receber o teste.')
    }

    await configEmail.enviarEmailDeTeste(para)

    res.status(200).json({ ok: true, mensagem: `E-mail de teste enviado para ${para}.` })
  } catch (error) {
    responderErro(res, error)
  }
})

export default router
