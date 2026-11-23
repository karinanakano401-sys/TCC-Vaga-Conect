import express from 'express'
import * as reservaCliService from '../services/reservacliservice.js'
import { autenticar, responderErro } from '../auth.js'

const router = express.Router()


// Reserva + pagamento da taxa numa única operação (valor calculado no servidor)
router.post('/reservar', autenticar, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.reservar(req.body, req.auth)
    res.status(201).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({
      erro: error.message,
      ...(error.valorCorreto !== undefined ? { valorCorreto: error.valorCorreto } : {}),
      ...(error.conflito ? { conflito: error.conflito } : {})
    })
  }
})


router.post('/', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.criarReservaCli(req.body)
    res.status(201).json(reservaCli)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const reservaClis = await reservaCliService.listarReservaClis()
    res.status(200).json(reservaClis)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.post('/:id/codigo-presenca', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.gerarCodigoPresenca(req.params.id)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.post('/:id/confirmar-presenca', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.confirmarPresenca(req.params.id, req.body?.codigo)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.post('/:id/codigo-saida', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.gerarCodigoSaida(req.params.id)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.post('/:id/sair', autenticar, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.sairDaVaga(
      req.params.id,
      req.body?.codigo,
      req.body?.pagamento,
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// Finalizar a utilização depois do fim do tempo contratado (sem reembolso)
router.post('/:id/finalizar', autenticar, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.finalizarUtilizacao(
      req.params.id,
      { codigo: req.body?.codigo, pagamento: req.body?.pagamento },
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


router.post('/:id/confirmar-saida', autenticar, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.confirmarSaida(
      req.params.id,
      req.body?.codigo,
      req.body?.motivo,
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


router.get('/:id', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.buscarReservaCliPorId(req.params.id)
    if (!reservaCli) return res.status(404).json({ erro: 'Reserva de cliente não encontrada' })
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.atualizarReservaCli(req.params.id, req.body)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({
      erro: error.message,
      ...(error.conflito ? { conflito: error.conflito } : {})
    })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await reservaCliService.deletarReservaCli(req.params.id)
    res.status(200).json({ mensagem: 'Reserva de cliente deletada com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router