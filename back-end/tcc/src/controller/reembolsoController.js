import express from 'express'
import * as reembolsoService from '../services/reembolsoservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const reembolso = await reembolsoService.criarReembolso(req.body)
    res.status(201).json(reembolso)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const reembolsos = await reembolsoService.listarReembolsos()
    res.status(200).json(reembolsos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const reembolso = await reembolsoService.buscarReembolsoPorId(req.params.id)
    if (!reembolso) return res.status(404).json({ erro: 'Reembolso não encontrado' })
    res.status(200).json(reembolso)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const reembolso = await reembolsoService.atualizarReembolso(req.params.id, req.body)
    res.status(200).json(reembolso)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await reembolsoService.deletarReembolso(req.params.id)
    res.status(200).json({ mensagem: 'Reembolso deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
