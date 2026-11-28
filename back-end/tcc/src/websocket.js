import { WebSocketServer } from 'ws'
import prismaClient from './prisma/index.js'
import { verificarToken } from './auth.js'


const salas = new Map()


function sairSala(socket) {
  const id = socket.reservaCliId
  if (!id || !salas.has(id)) return
  salas.get(id).delete(socket)
  if (salas.get(id).size === 0) salas.delete(id)
  socket.reservaCliId = null
}


// Os avisos carregam os códigos de entrada e saída, então só entra na sala da reserva
// quem tem login válido e é o cliente dono dela ou a equipe do pátio.
async function podeEntrar(token, reservaCliId) {
  const auth = verificarToken(token)

  if (!auth) return false

  if (auth.perfil === 'admin' || auth.perfil === 'funcionario') return true

  if (auth.perfil !== 'cliente') return false

  const reserva = await prismaClient.reservaCli.findUnique({
    where:  { id: reservaCliId },
    select: { fk_idCliente: true }
  })

  return reserva?.fk_idCliente === auth.sub
}


export function anexarWebSocket(servidorHttp) {
  const wss = new WebSocketServer({ server: servidorHttp, path: '/ws', maxPayload: 4 * 1024 })

  wss.on('connection', (socket) => {
    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw))
        if (msg.tipo !== 'entrar' || !msg.reservaCliId) return

        const reservaCliId = String(msg.reservaCliId)

        if (!(await podeEntrar(msg.token, reservaCliId))) {
          socket.send(JSON.stringify({ tipo: 'acesso-negado' }))
          return
        }

        sairSala(socket)
        socket.reservaCliId = reservaCliId
        if (!salas.has(reservaCliId)) {
          salas.set(reservaCliId, new Set())
        }
        salas.get(reservaCliId).add(socket)
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
