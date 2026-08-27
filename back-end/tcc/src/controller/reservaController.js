import express from 'express'
import * as reservaService from '../services/reservaservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const reserva = await reservaService.criarReserva(req.body)
    res.status(201).json(reserva)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const reservas = await reservaService.listarReservas()
    res.status(200).json(reservas)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const reserva = await reservaService.buscarReservaPorId(req.params.id)
    if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada' })
    res.status(200).json(reserva)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const reserva = await reservaService.atualizarReserva(req.params.id, req.body)
    res.status(200).json(reserva)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await reservaService.deletarReserva(req.params.id)
    res.status(200).json({ mensagem: 'Reserva deletada com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router