import express from 'express'
import http from 'http'
import usuarioRoutes from './controller/usuariocontroller.js'
import funcionarioRoutes from './controller/funcionarioController.js'
import carroRoutes from './controller/carroController.js'
import enderecoRoutes from './controller/enderecoController.js'
import estacionamentoRoutes from './controller/estacionamentoController.js'
import feedbackRoutes from './controller/feedbackController.js'
import reservaCliRoutes from './controller/reservaCliController.js'
import reservaRoutes from './controller/reservaController.js'
import tipoFuncRoutes from './controller/tipoFuncController.js'
import vagaRoutes from './controller/vagaController.js'
import pagamentoRoutes from './controller/pagamentoController.js'
import reembolsoRoutes from './controller/reembolsoController.js'
import { anexarWebSocket } from './websocket.js'

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use('/usuario', usuarioRoutes)
app.use('/funcionario', funcionarioRoutes)
app.use('/carro', carroRoutes)
app.use('/endereco', enderecoRoutes)
app.use('/estacionamento', estacionamentoRoutes)
app.use('/feedback', feedbackRoutes)
app.use('/reservacli', reservaCliRoutes)
app.use('/reserva', reservaRoutes)
app.use('/tipofunc', tipoFuncRoutes)
app.use('/vaga', vagaRoutes)
app.use('/pagamento', pagamentoRoutes)
app.use('/reembolso', reembolsoRoutes)

const servidor = http.createServer(app)
anexarWebSocket(servidor)

servidor.listen(3333, () => console.log('Servidor rodando na porta 3333'))
