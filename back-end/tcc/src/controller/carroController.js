import express from 'express'
import * as carroService from '../services/carroservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const carro = await carroService.criarCarro(req.body)
    res.status(201).json(carro)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const carros = await carroService.listarCarros()
    res.status(200).json(carros)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const carro = await carroService.buscarCarroPorId(req.params.id)
    if (!carro) return res.status(404).json({ erro: 'Carro não encontrado' })
    res.status(200).json(carro)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const carro = await carroService.atualizarCarro(req.params.id, req.body)
    res.status(200).json(carro)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await carroService.deletarCarro(req.params.id)
    res.status(200).json({ mensagem: 'Carro deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router