import nodemailer from 'nodemailer'


// Envio de e-mail por SMTP.
//
// Aqui só existe o "como enviar". A configuração (servidor, usuário, senha cifrada)
// é guardada no banco e gerenciada pelo administrador em Configurações;
// quem a carrega e entrega pronta é services/configemailservice.js.
//
// Nenhuma função daqui escreve a senha SMTP em log ou em mensagem de erro.

const LIMITE_TEMPO_MS = 10000


export function criarTransporte(config) {
  return nodemailer.createTransport({
    host:   config.host,
    port:   config.porta,
    secure: config.seguro,
    auth:   config.usuario || config.senha ? { user: config.usuario, pass: config.senha } : undefined,
    connectionTimeout: LIMITE_TEMPO_MS,
    greetingTimeout:   LIMITE_TEMPO_MS,
    socketTimeout:     15000
  })
}


function remetenteDe(config) {
  // aspas e quebras de linha fora do nome: evita injeção de cabeçalho
  const nome = String(config.nomeRemetente || 'VagaConnect').replace(/["\r\n<>]/g, '').trim() || 'VagaConnect'

  return { name: nome, address: config.emailRemetente }
}


// Confere se dá para conectar e autenticar no servidor (não envia nada)
export async function verificarConexao(config) {
  const transporte = criarTransporte(config)

  try {
    await transporte.verify()
  } finally {
    transporte.close()
  }
}


export async function enviarEmail(config, { para, assunto, texto, html }) {
  const transporte = criarTransporte(config)

  try {
    return await transporte.sendMail({ from: remetenteDe(config), to: para, subject: assunto, text: texto, html })
  } finally {
    transporte.close()
  }
}


// Resumo seguro de um erro de SMTP: só campos técnicos, nunca credenciais.
export function diagnosticoSmtp(error, config) {
  return [
    config?.host ? `servidor=${config.host}:${config.porta}` : null,
    config?.usuario ? `usuario=${config.usuario}` : null,
    error?.code ? `codigo=${error.code}` : null,
    error?.responseCode ? `resposta=${error.responseCode}` : null,
    error?.command ? `comando=${error.command}` : null,
    error?.response ? `servidor_disse="${String(error.response).split('\n')[0].slice(0, 160)}"` : null
  ].filter(Boolean).join(' ')
}


// Tradução do erro técnico para algo que o administrador entenda e consiga corrigir
export function mensagemDeErroSmtp(error, config) {
  const codigo = error?.code
  const servidor = config ? `${config.host}:${config.porta}` : 'o servidor de e-mail'

  if (codigo === 'EAUTH' || error?.responseCode === 535 || error?.responseCode === 534) {
    return 'O servidor recusou o usuário ou a senha. No Gmail, use uma senha de app (não a senha da conta) e confirme que a verificação em 2 etapas está ativa.'
  }

  if (codigo === 'EDNS' || codigo === 'ENOTFOUND') {
    return `Não encontramos o servidor "${config?.host}". Confira o endereço do servidor SMTP.`
  }

  if (codigo === 'ECONNREFUSED') {
    return `Conexão recusada em ${servidor}. Confira o servidor e a porta.`
  }

  if (codigo === 'ETIMEDOUT' || codigo === 'ESOCKETTIMEDOUT' || /timeout|timed out/i.test(error?.message || '')) {
    return `Tempo esgotado ao conectar em ${servidor}. O servidor pode estar fora do ar ou a porta estar bloqueada pela rede.`
  }

  if (codigo === 'ETLS' || /ssl|tls|wrong version|certificate/i.test(error?.message || '')) {
    return 'Falha na conexão segura. Confira a porta e a opção de SSL/TLS: porta 465 usa conexão segura ligada; porta 587 usa desligada (STARTTLS).'
  }

  if (codigo === 'EENVELOPE') {
    return 'O servidor recusou o endereço de e-mail informado. Confira o remetente e o destinatário.'
  }

  if (codigo === 'ECONNECTION' || codigo === 'ESOCKET') {
    return `Não foi possível conectar em ${servidor}. Confira o servidor, a porta e a sua conexão com a internet.`
  }

  return 'Não foi possível validar a conexão com o servidor de e-mail. Confira os dados informados.'
}


function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}


// Link da tela de redefinição (front-end) com o token
export function linkRedefinicao(token, urlFront) {
  const base = String(urlFront || '').replace(/\/+$/, '')

  return `${base}/Base/HTML/RedefinirSenha.html?token=${encodeURIComponent(token)}`
}


export function linkLogin(urlFront) {
  return `${String(urlFront || '').replace(/\/+$/, '')}/Base/HTML/${encodeURIComponent('OpçãoLogin.html')}`
}


function moldura({ conteudo }) {
  return `<!DOCTYPE html>
<html lang="pt-br">
<body style="margin:0;padding:0;background:#031426;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031426;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#061a30;border:1px solid #173552;border-radius:14px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
          <tr>
            <td align="center" style="padding:28px 30px 8px;">
              <div style="font-size:30px;font-weight:700;letter-spacing:.5px;color:#ffffff;">Vaga<span style="color:#60a5fa;">Connect</span></div>
              <div style="margin-top:4px;font-size:12px;color:#8fa5b9;">Sistema Inteligente de Estacionamento</div>
            </td>
          </tr>
${conteudo}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}


export function montarEmailRecuperacao({ nome, link, validadeMin }) {
  const primeiroNome = String(nome || '').trim().split(/\s+/)[0]
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'
  const linkSeguro = escapar(link)

  const texto = [
    saudacao,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no VagaConnect.',
    'Para criar uma nova senha, acesse o link abaixo:',
    '',
    link,
    '',
    `Por segurança, o link vale por ${validadeMin} minutos e só pode ser usado uma vez.`,
    '',
    'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
    '',
    'VagaConnect · Sistema Inteligente de Estacionamento'
  ].join('\n')

  const html = moldura({ conteudo: `          <tr>
            <td style="padding:20px 30px 0;">
              <div style="font-size:18px;font-weight:700;color:#dbeafe;">${escapar(saudacao)}</div>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">
                Recebemos um pedido para redefinir a senha da sua conta no VagaConnect.
                Clique no botão abaixo para criar uma nova senha.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 30px;">
              <a href="${linkSeguro}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:7px;">Redefinir minha senha</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px;">
              <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8fa5b9;">
                Por segurança, este link vale por <b style="color:#dbeafe;">${validadeMin} minutos</b> e só pode ser usado uma vez.
              </p>
              <p style="margin:12px 0 0;font-size:12.5px;line-height:1.6;color:#8fa5b9;">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                <a href="${linkSeguro}" style="color:#60a5fa;word-break:break-all;">${linkSeguro}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px 28px;">
              <div style="border-top:1px solid #173552;padding-top:16px;font-size:12.5px;line-height:1.6;color:#8fa5b9;">
                Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma e nada foi alterado.
              </div>
            </td>
          </tr>` })

  return { assunto: 'Redefinição de senha · VagaConnect', texto, html }
}


export function montarEmailTeste({ link }) {
  const linkSeguro = escapar(link)

  const texto = [
    'Este é um e-mail de teste do VagaConnect.',
    '',
    'Se você está lendo esta mensagem, o envio de e-mails está funcionando.',
    'O endereço abaixo é o do sistema que será usado nos links de recuperação de senha. Abra-o para conferir se está correto:',
    '',
    link,
    '',
    'VagaConnect · Sistema Inteligente de Estacionamento'
  ].join('\n')

  const html = moldura({ conteudo: `          <tr>
            <td style="padding:20px 30px 0;">
              <div style="font-size:18px;font-weight:700;color:#dbeafe;">E-mail de teste</div>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">
                Se você está lendo esta mensagem, o envio de e-mails do VagaConnect está funcionando.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 30px;">
              <a href="${linkSeguro}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:7px;">Abrir o VagaConnect</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 28px;">
              <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8fa5b9;">
                Este botão usa o endereço do sistema configurado para os links de recuperação de senha. Se ele não abrir a tela de login, corrija o endereço em Configurações.
              </p>
            </td>
          </tr>` })

  return { assunto: 'Teste de e-mail · VagaConnect', texto, html }
}
