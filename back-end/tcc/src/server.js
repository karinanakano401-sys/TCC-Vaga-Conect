import express from 'express'
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

const server = express()
server.use(express.json())

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

server.use('/usuario', usuarioRoutes)
server.use('/funcionario', funcionarioRoutes)
server.use('/carro', carroRoutes)
server.use('/endereco', enderecoRoutes)
server.use('/estacionamento', estacionamentoRoutes)
server.use('/feedback', feedbackRoutes)
server.use('/reservacli', reservaCliRoutes)
server.use('/reserva', reservaRoutes)
server.use('/tipofunc', tipoFuncRoutes)
server.use('/vaga', vagaRoutes)
server.use('/pagamento', pagamentoRoutes)

server.listen(3333, () => console.log('Servidor rodando na porta 3333'))