import crypto from 'node:crypto'
import { erroHttp } from './auth.js'


// Hash de senha com scrypt (nativo do Node, sem dependência externa).
// Formato guardado no banco: scrypt$<salt em base64>$<hash em base64>
//
// Contas antigas ainda têm a senha em texto puro. Elas continuam entrando:
// verificarSenha() aceita os dois formatos e avisa quando o hash precisa
// ser regravado (precisaAtualizar), o que o login faz na hora.

const PREFIXO = 'scrypt'
const TAMANHO_HASH = 64

export const SENHA_MIN = 6
export const SENHA_MAX = 128


export function gerarHash(senha) {
  if (typeof senha !== 'string' || !senha) {
    throw erroHttp(400, 'Senha obrigatória.')
  }

  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(senha, salt, TAMANHO_HASH)

  return [PREFIXO, salt.toString('base64'), hash.toString('base64')].join('$')
}


function iguais(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))

  return x.length === y.length && crypto.timingSafeEqual(x, y)
}


// Retorna { ok, precisaAtualizar }
export function verificarSenha(senhaDigitada, senhaGuardada) {
  if (typeof senhaDigitada !== 'string' || typeof senhaGuardada !== 'string') {
    return { ok: false, precisaAtualizar: false }
  }

  if (senhaGuardada.startsWith(PREFIXO + '$')) {
    const [, saltB64, hashB64] = senhaGuardada.split('$')

    if (!saltB64 || !hashB64) return { ok: false, precisaAtualizar: false }

    const esperado = Buffer.from(hashB64, 'base64')
    const calculado = crypto.scryptSync(senhaDigitada, Buffer.from(saltB64, 'base64'), esperado.length)

    return { ok: crypto.timingSafeEqual(esperado, calculado), precisaAtualizar: false }
  }

  // formato antigo: texto puro
  const ok = iguais(senhaDigitada, senhaGuardada)

  return { ok, precisaAtualizar: ok }
}


// Regra única de senha nova usada na recuperação:
// mesmo mínimo que a tela "Minha conta" do funcionário já exigia.
export function validarSenhaNova(senha, confirmacao) {
  if (typeof senha !== 'string' || !senha) {
    throw erroHttp(400, 'Digite a nova senha.')
  }

  if (senha.length < SENHA_MIN) {
    throw erroHttp(400, `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`)
  }

  if (senha.length > SENHA_MAX) {
    throw erroHttp(400, `A senha pode ter no máximo ${SENHA_MAX} caracteres.`)
  }

  if (confirmacao !== undefined && senha !== confirmacao) {
    throw erroHttp(400, 'As senhas não coincidem.')
  }
}
