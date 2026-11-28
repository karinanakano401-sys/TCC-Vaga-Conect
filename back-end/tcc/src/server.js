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
import senhaRoutes from './controller/senhaController.js'
import configuracaoEmailRoutes from './controller/configuracaoEmailController.js'
import { anexarWebSocket } from './websocket.js'

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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
app.use('/senha', senhaRoutes)
app.use('/configuracao/email', configuracaoEmailRoutes)

// Rota que não existe e erros fora das rotas (JSON malformado, corpo grande demais)
// sempre respondem em JSON, sem página de erro nem detalhes internos
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' })
})

app.use((erro, req, res, next) => {
  if (erro?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Os dados enviados são grandes demais.' })
  }

  if (erro?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Os dados enviados não são um JSON válido.' })
  }

  console.error('[erro não tratado]', erro?.message)
  res.status(500).json({ erro: 'Não foi possível concluir a operação.' })
})

const servidor = http.createServer(app)
anexarWebSocket(servidor)

// A porta padrão continua 3333 (é a que o front-end usa); PORT existe para rodar
// uma segunda instância de testes sem derrubar a principal.
const porta = Number(process.env.PORT) || 3333

servidor.listen(porta, () => console.log(`Servidor rodando na porta ${porta}`))
