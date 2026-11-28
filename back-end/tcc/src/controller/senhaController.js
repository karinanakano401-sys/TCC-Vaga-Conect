import express from 'express'
import * as recuperacao from '../services/recuperacaosenhaservice.js'
import { responderErro } from '../auth.js'
import { registrarTentativa, ipDe } from '../limitador.js'

const router = express.Router()

const MIN = 60 * 1000

// Pedidos de link: poucos por IP e poucos por e-mail (vale para e-mail cadastrado ou não,
// então o limite também não revela se a conta existe)
const LIMITE_PEDIDO_IP     = { max: 5,  janelaMs: 15 * MIN }
const LIMITE_PEDIDO_EMAIL  = { max: 3,  janelaMs: 60 * MIN }

// Conferir/usar o link: protege contra tentativa de adivinhar tokens
const LIMITE_TOKEN_IP      = { max: 15, janelaMs: 15 * MIN }


function bloquear(res, esperaSeg) {
  res.set('Retry-After', String(esperaSeg))

  const minutos = Math.ceil(esperaSeg / 60)

  return res.status(429).json({
    erro: `Muitas tentativas. Aguarde ${minutos} minuto${minutos > 1 ? 's' : ''} e tente de novo.`
  })
}


// Sempre a mesma resposta, exista ou não conta com o e-mail
router.post('/esqueci', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ erro: 'Digite um e-mail válido.' })
  }

  const porIp = registrarTentativa('esqueci:ip:' + ipDe(req), LIMITE_PEDIDO_IP)
  if (!porIp.permitido) return bloquear(res, porIp.esperaSeg)

  const porEmail = registrarTentativa('esqueci:email:' + email.toLowerCase(), LIMITE_PEDIDO_EMAIL)
  if (!porEmail.permitido) return bloquear(res, porEmail.esperaSeg)

  // processa em segundo plano: o tempo de resposta não revela se o e-mail existe
  recuperacao.solicitarRecuperacao(email).catch((error) => {
    console.error('[recuperação de senha] falha ao processar o pedido:', error.message)
  })

  res.status(200).json({
    mensagem: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Confira também a caixa de spam.'
  })
})


router.post('/validar', async (req, res) => {
  try {
    const limite = registrarTentativa('token:ip:' + ipDe(req), LIMITE_TOKEN_IP)
    if (!limite.permitido) return bloquear(res, limite.esperaSeg)

    const resultado = await recuperacao.validarToken(req.body?.token)

    res.status(200).json(resultado)
  } catch (error) {
    responderErro(res, error)
  }
})


router.post('/redefinir', async (req, res) => {
  try {
    const limite = registrarTentativa('token:ip:' + ipDe(req), LIMITE_TOKEN_IP)
    if (!limite.permitido) return bloquear(res, limite.esperaSeg)

    await recuperacao.redefinirSenha({
      token:          req.body?.token,
      senha:          req.body?.senha,
      confirmarSenha: req.body?.confirmarSenha
    })

    res.status(200).json({ mensagem: 'Senha redefinida com sucesso. Entre com a nova senha.' })
  } catch (error) {
    responderErro(res, error)
  }
})

export default router
