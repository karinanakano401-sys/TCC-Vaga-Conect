import express from 'express'
import * as estacionamentoService from '../services/estacionamentoservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.criarEstacionamento(req.body)
    res.status(201).json(estacionamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const estacionamentos = await estacionamentoService.listarEstacionamentos()
    res.status(200).json(estacionamentos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.buscarEstacionamentoPorId(req.params.id)
    if (!estacionamento) return res.status(404).json({ erro: 'Estacionamento não encontrado' })
    res.status(200).json(estacionamento)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.atualizarEstacionamento(req.params.id, req.body)
    res.status(200).json(estacionamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await estacionamentoService.deletarEstacionamento(req.params.id)
    res.status(200).json({ mensagem: 'Estacionamento deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router