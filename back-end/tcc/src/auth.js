import crypto from 'node:crypto'


// Token assinado com HMAC-SHA256 (sem dependência externa).
// Formato: base64url(payload).base64url(assinatura)
//
// O segredo vem de AUTH_SECRET. Se não existir, deriva do DATABASE_URL,
// que é estável entre reinícios e nunca vai para o repositório.

const VALIDADE_MS = 12 * 60 * 60 * 1000


function segredo() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET

  return crypto
    .createHash('sha256')
    .update('vagaconnect:' + (process.env.DATABASE_URL || 'dev-local'))
    .digest('hex')
}


function assinar(texto) {
  return crypto.createHmac('sha256', segredo()).update(texto).digest('base64url')
}


// perfil: 'cliente' | 'admin' | 'funcionario'
export function emitirToken({ id, tipo, perfil, nome }) {
  const payload = {
    sub:    id,
    tipo,
    perfil,
    nome:   nome || '',
    exp:    Date.now() + VALIDADE_MS
  }

  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')

  return corpo + '.' + assinar(corpo)
}


export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null

  const [corpo, assinatura] = token.split('.')
  const esperada = assinar(corpo)

  const a = Buffer.from(assinatura || '')
  const b = Buffer.from(esperada)

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))

    if (!payload.exp || payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}


// Exige um token válido e coloca a identidade em req.auth
export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : ''
  const payload = verificarToken(token)

  if (!payload) {
    return res.status(401).json({ erro: 'Faça login para continuar.' })
  }

  req.auth = payload

  next()
}


export function ehEquipe(auth) {
  return auth?.perfil === 'admin' || auth?.perfil === 'funcionario'
}


// Libera só os perfis informados (ex.: exigirPerfil('admin', 'funcionario'))
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.auth || !perfis.includes(req.auth.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' })
    }

    next()
  }
}


// Erro com status HTTP para os services
export function erroHttp(status, mensagem) {
  const erro = new Error(mensagem)
  erro.status = status
  return erro
}


// Resposta de erro sem vazar texto interno do Prisma/banco.
// Erros com .status vêm das nossas regras e já têm mensagem própria.
export function responderErro(res, error, statusPadrao = 400) {
  if (error?.status) {
    return res.status(error.status).json({
      erro: error.message,
      ...(error.valorCorreto !== undefined ? { valorCorreto: error.valorCorreto } : {}),
      ...(error.exigeCodigoSaida ? { exigeCodigoSaida: true } : {}),
      ...(error.exigeFinalizar ? { exigeFinalizar: true } : {})
    })
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ erro: 'Este registro já existe.' })
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado.' })
  }

  if (error?.code === 'P2003') {
    return res.status(400).json({ erro: 'Referência inválida: o registro relacionado não existe.' })
  }

  const interno = error?.name?.startsWith('PrismaClient') || error?.code?.startsWith?.('P')

  if (interno) {
    console.error('[erro interno]', error.message)
    return res.status(500).json({ erro: 'Não foi possível concluir a operação.' })
  }

  return res.status(statusPadrao).json({ erro: error?.message || 'Erro inesperado.' })
}
