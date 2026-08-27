import express from 'express'
import * as vagaService from '../services/vagaservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const vaga = await vagaService.criarVaga(req.body)
    res.status(201).json(vaga)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const vagas = await vagaService.listarVagas()
    res.status(200).json(vagas)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const vaga = await vagaService.buscarVagaPorId(req.params.id)
    if (!vaga) return res.status(404).json({ erro: 'Vaga não encontrada' })
    res.status(200).json(vaga)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const vaga = await vagaService.atualizarVaga(req.params.id, req.body)
    res.status(200).json(vaga)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await vagaService.deletarVaga(req.params.id)
    res.status(200).json({ mensagem: 'Vaga deletada com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router