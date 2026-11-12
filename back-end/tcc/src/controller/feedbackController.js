import express from 'express'
import * as feedbackService from '../services/feedbackservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const feedback = await feedbackService.criarFeedback(req.body)
    res.status(201).json(feedback)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const feedbacks = await feedbackService.listarFeedbacks({
      cliente:        req.query.cliente,
      estacionamento: req.query.estacionamento
    })
    res.status(200).json(feedbacks)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Categorias de avaliação (rótulo, pergunta e detalhe).
router.get('/categorias', (req, res) => {
  res.status(200).json(feedbackService.listarCategorias())
})


// Médias por estacionamento e por categoria.
router.get('/resumo', async (req, res) => {
  try {
    res.status(200).json(await feedbackService.resumoPorEstacionamento())
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Visitas do usuário que podem ser avaliadas.
router.get('/visitas/:idCliente', async (req, res) => {
  try {
    res.status(200).json(await feedbackService.listarVisitasDoUsuario(req.params.idCliente))
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Avaliações de um estacionamento (versão pública, sem dados sensíveis).
router.get('/estacionamento/:id', async (req, res) => {
  try {
    res.status(200).json(await feedbackService.listarAvaliacoesPublicas(req.params.id))
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const feedback = await feedbackService.buscarFeedbackPorId(req.params.id)
    if (!feedback) return res.status(404).json({ erro: 'Feedback não encontrado' })
    res.status(200).json(feedback)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const feedback = await feedbackService.atualizarFeedback(req.params.id, req.body)
    res.status(200).json(feedback)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await feedbackService.deletarFeedback(req.params.id)
    res.status(200).json({ mensagem: 'Feedback deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
