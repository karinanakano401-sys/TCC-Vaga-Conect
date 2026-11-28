import prismaClient from './prisma/index.js'
import { autenticar, ehEquipe, exigirPerfil, erroHttp, responderErro } from './auth.js'
import { registrarTentativa, ipDe } from './limitador.js'


// Regras de acesso reaproveitadas pelas rotas.
//
// Perfis (vêm do token de login): 'cliente' | 'funcionario' | 'admin'.
// Equipe = admin + funcionario. Sem token válido a resposta é 401; com token
// mas sem permissão para o recurso é 403.

export const soEquipe = exigirPerfil('admin', 'funcionario')
export const soAdmin = exigirPerfil('admin')
export const soCliente = exigirPerfil('cliente')

export { autenticar, ehEquipe, erroHttp, responderErro }


// Com token válido preenche req.auth; sem token segue como anônimo.
// Token inválido ou vencido continua sendo 401.
export function autenticarSeHouver(req, res, next) {
  const cabecalho = req.headers.authorization || ''

  if (!cabecalho.startsWith('Bearer ')) return next()

  return autenticar(req, res, next)
}


export function ehAdmin(auth) {
  return auth?.perfil === 'admin'
}


// A própria pessoa logada (cliente na tabela Usuario, equipe na tabela Funcionario)
export function ehOProprio(auth, id) {
  return Boolean(auth) && auth.sub === id
}


// Libera o dono do recurso ou a equipe. `buscarDono(req)` devolve o id do dono
// (ou undefined se o recurso não existe -> 404).
export function donoOuEquipe(buscarDono, { soAdminPode = false } = {}) {
  return async (req, res, next) => {
    try {
      const equipeLiberada = soAdminPode ? ehAdmin(req.auth) : ehEquipe(req.auth)

      if (equipeLiberada) return next()

      const dono = await buscarDono(req)

      // undefined = o registro não existe; null = existe, mas não tem dono "cliente"
      if (dono === undefined) {
        return res.status(404).json({ erro: 'Registro não encontrado.' })
      }

      if (req.auth?.perfil === 'cliente' && dono === req.auth.sub) return next()

      return res.status(403).json({ erro: 'Você não tem permissão para acessar este registro.' })
    } catch (error) {
      return responderErro(res, error, 500)
    }
  }
}


// Só a própria pessoa (ex.: cliente editando o próprio perfil)
export function soOProprio(req, res, next) {
  if (ehOProprio(req.auth, req.params.id)) return next()

  return res.status(403).json({ erro: 'Você não tem permissão para alterar dados de outra pessoa.' })
}


// A própria pessoa ou o administrador
export function proprioOuAdmin(req, res, next) {
  if (ehAdmin(req.auth) || ehOProprio(req.auth, req.params.id)) return next()

  return res.status(403).json({ erro: 'Você não tem permissão para acessar os dados de outra pessoa.' })
}


// ---------------------------------------------------------------------------
// Limites contra abuso (em memória; reiniciar o servidor zera os contadores)
// ---------------------------------------------------------------------------

function limitar(nomeDaChave, { max, janelaMs }, mensagem) {
  return (req, res, next) => {
    const r = registrarTentativa(`${nomeDaChave}:${ipDe(req)}`, { max, janelaMs })

    if (!r.permitido) {
      res.set('Retry-After', String(r.esperaSeg))
      return res.status(429).json({ erro: mensagem })
    }

    next()
  }
}


// Cadastro público (cliente, endereço, estacionamento, funcionário)
export const limitarCadastro = limitar(
  'cadastro',
  { max: 60, janelaMs: 60 * 60 * 1000 },
  'Muitos cadastros deste computador em pouco tempo. Tente novamente mais tarde.'
)


// Tentativas de login: por IP e por e-mail (o e-mail evita adivinhar a senha de uma conta)
export function limitarLogin(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200)
  const janelaMs = 15 * 60 * 1000

  const porIp = registrarTentativa(`login-ip:${ipDe(req)}`, { max: 60, janelaMs })
  const porConta = email
    ? registrarTentativa(`login-conta:${email}`, { max: 10, janelaMs })
    : { permitido: true, esperaSeg: 0 }

  if (!porIp.permitido || !porConta.permitido) {
    const espera = Math.max(porIp.esperaSeg, porConta.esperaSeg)
    res.set('Retry-After', String(espera))

    return res.status(429).json({
      erro: `Muitas tentativas de login. Aguarde ${Math.ceil(espera / 60)} minuto(s) e tente novamente.`
    })
  }

  next()
}


// ---------------------------------------------------------------------------
// Consultas usadas pelas regras
// ---------------------------------------------------------------------------

export async function donoDaReservaCli(id) {
  const item = await prismaClient.reservaCli.findUnique({
    where: { id },
    select: { fk_idCliente: true }
  })

  return item?.fk_idCliente
}


export async function donoDoCarro(id) {
  const item = await prismaClient.carro.findUnique({
    where: { id },
    select: { fk_idCliente: true }
  })

  return item?.fk_idCliente
}


export async function donoDoFeedback(id) {
  const item = await prismaClient.feedback.findUnique({
    where: { id },
    select: { fk_idCliente: true }
  })

  return item?.fk_idCliente
}


// Endereço de cliente: dono é o usuário ligado a ele. Endereço de estacionamento
// não tem dono "cliente" (só o administrador mexe).
export async function donoDoEndereco(id) {
  const item = await prismaClient.endereco.findUnique({
    where: { id },
    select: { usuario: { select: { id: true } } }
  })

  if (!item) return undefined

  return item.usuario?.id ?? null
}


export async function enderecoEhOrfao(id) {
  const item = await prismaClient.endereco.findUnique({
    where: { id },
    select: { usuario: { select: { id: true } }, estacionamento: { select: { id: true } } }
  })

  return Boolean(item) && !item.usuario && !item.estacionamento
}


// Quem pode cadastrar um funcionário/administrador:
//  - o administrador logado (qualquer estacionamento, qualquer cargo);
//  - sem login (tela de cadastro): só o PRIMEIRO administrador de um estacionamento
//    que ainda não tem equipe, que é o fim do cadastro de um novo estacionamento.
export async function podeCadastrarFuncionario(auth, dados) {
  if (ehAdmin(auth)) return true

  if (!dados?.fk_tipofunc || !dados?.fk_est) return false

  const [cargo, estacionamento, equipe] = await Promise.all([
    prismaClient.tipoFunc.findUnique({ where: { id: dados.fk_tipofunc }, select: { tipo: true } }),
    prismaClient.estacionamento.findUnique({ where: { id: dados.fk_est }, select: { id: true } }),
    prismaClient.funcionario.count({ where: { fk_est: dados.fk_est } })
  ])

  return cargo?.tipo === 'admin' && Boolean(estacionamento) && equipe === 0
}


// Estacionamento "vazio": sem equipe cadastrada e sem nenhuma reserva nas vagas.
// É o estado de um cadastro que ainda não terminou (ou falhou no meio).
export async function estacionamentoEstaVazio(id) {
  const est = await prismaClient.estacionamento.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!est) return false

  const [equipe, reservas] = await Promise.all([
    prismaClient.funcionario.count({ where: { fk_est: id } }),
    prismaClient.reserva.count({ where: { vaga: { fk_est: id } } })
  ])

  return equipe === 0 && reservas === 0
}
