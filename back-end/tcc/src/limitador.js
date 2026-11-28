// Limite de requisições em memória (sem dependência externa).
//
// Cada "balde" guarda os instantes das últimas tentativas por chave
// (ex.: IP ou e-mail). Passou do máximo dentro da janela: bloqueia
// até a tentativa mais antiga sair da janela.
//
// Fica em memória do processo: reiniciar o servidor zera os contadores.

const baldes = new Map()


function limpar(agora) {
  for (const [chave, item] of baldes) {
    if (item.expira < agora) baldes.delete(chave)
  }
}

setInterval(() => limpar(Date.now()), 5 * 60 * 1000).unref()


// Registra uma tentativa. Retorna { permitido, esperaSeg }
export function registrarTentativa(chave, { max, janelaMs }) {
  const agora = Date.now()
  const item = baldes.get(chave) || { tentativas: [], expira: 0 }

  item.tentativas = item.tentativas.filter(t => agora - t < janelaMs)

  if (item.tentativas.length >= max) {
    const esperaMs = janelaMs - (agora - item.tentativas[0])

    item.expira = agora + esperaMs
    baldes.set(chave, item)

    return { permitido: false, esperaSeg: Math.max(1, Math.ceil(esperaMs / 1000)) }
  }

  item.tentativas.push(agora)
  item.expira = agora + janelaMs
  baldes.set(chave, item)

  return { permitido: true, esperaSeg: 0 }
}


// IP do cliente (respeita X-Forwarded-For só se o servidor estiver atrás de proxy configurado)
export function ipDe(req) {
  return req.ip || req.socket?.remoteAddress || 'desconhecido'
}
