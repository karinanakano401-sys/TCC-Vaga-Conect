import express from 'express'
import * as reservaCliService from '../services/reservacliservice.js'

const router = express.Router()


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
    res.status(400).json({ erro: error.message })
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