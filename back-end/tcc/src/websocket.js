import { WebSocketServer } from 'ws'


const salas = new Map()


function sairSala(socket) {
  const id = socket.reservaCliId
  if (!id || !salas.has(id)) return
  salas.get(id).delete(socket)
  if (salas.get(id).size === 0) salas.delete(id)
  socket.reservaCliId = null
}


export function anexarWebSocket(servidorHttp) {
  const wss = new WebSocketServer({ server: servidorHttp, path: '/ws' })

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw))
        if (msg.tipo !== 'entrar' || !msg.reservaCliId) return
        sairSala(socket)
        socket.reservaCliId = String(msg.reservaCliId)
        if (!salas.has(socket.reservaCliId)) {
          salas.set(socket.reservaCliId, new Set())
        }
        salas.get(socket.reservaCliId).add(socket)
      } catch (error) {
        console.error('WebSocket: mensagem inválida', error.message)
      }
    })

    socket.on('close', () => sairSala(socket))
  })
}


export function avisarPresenca(reservaCliId, payload) {
  const grupo = salas.get(reservaCliId)
  if (!grupo) return

  const texto = JSON.stringify({
    reservaCliId,
    ...payload
  })

  for (const socket of grupo) {
    if (socket.readyState === 1) socket.send(texto)
  }
}
