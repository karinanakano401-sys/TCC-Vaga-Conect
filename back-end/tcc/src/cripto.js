import 'dotenv/config'
import crypto from 'node:crypto'


// Cifra reversível (AES-256-GCM) para segredos que o sistema precisa ler de
// volta, como a senha do SMTP. Senhas de login NÃO usam isto: elas têm hash (senha.js).
//
// A chave vem de CONFIG_SECRET (.env). Sem ela, deriva do AUTH_SECRET e, por
// último, do DATABASE_URL, que fica fora do banco.
//
// Formato guardado: v1:<iv>:<tag>:<texto cifrado>, tudo em base64.
// Trocar a chave torna a senha guardada ilegível: é preciso salvar a configuração de novo.

const VERSAO = 'v1'


function chave() {
  const base = process.env.CONFIG_SECRET
    || process.env.AUTH_SECRET
    || 'vagaconnect-config:' + (process.env.DATABASE_URL || 'dev-local')

  return crypto.createHash('sha256').update(base).digest()
}


export function cifrar(texto) {
  const iv = crypto.randomBytes(12)
  const cifra = crypto.createCipheriv('aes-256-gcm', chave(), iv)
  const dados = Buffer.concat([cifra.update(String(texto), 'utf8'), cifra.final()])

  return [VERSAO, iv.toString('base64'), cifra.getAuthTag().toString('base64'), dados.toString('base64')].join(':')
}


export function decifrar(guardado) {
  const [versao, iv, tag, dados] = String(guardado).split(':')

  if (versao !== VERSAO || !iv || !tag || !dados) {
    throw new Error('Formato de segredo desconhecido')
  }

  const decifra = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'))

  decifra.setAuthTag(Buffer.from(tag, 'base64'))

  return Buffer.concat([decifra.update(Buffer.from(dados, 'base64')), decifra.final()]).toString('utf8')
}
