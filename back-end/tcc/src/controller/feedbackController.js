import express from 'express'
import * as feedbackService from '../services/feedbackservice.js'
import {
  autenticar,
  soCliente,
  ehEquipe,
  ehAdmin,
  ehOProprio,
  donoOuEquipe,
  donoDoFeedback
} from '../permissoes.js'

const router = express.Router()

// Avaliações são sempre de uma pessoa logada: o cliente avalia as próprias visitas;
// a equipe só lê (o administrador também pode apagar).
router.use(autenticar)

const donoOuEquipeLeitura = donoOuEquipe((req) => donoDoFeedback(req.params.id))
const donoOuAdmin = donoOuEquipe((req) => donoDoFeedback(req.params.id), { soAdminPode: true })


router.post('/', soCliente, async (req, res) => {
  try {
    // quem avalia é quem está logado, nunca o que vier no corpo
    const feedback = await feedbackService.criarFeedback({ ...req.body, fk_idCliente: req.auth.sub })
    res.status(201).json(feedback)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    // o cliente só enxerga as próprias avaliações (com e-mail e dados completos)
    const cliente = ehEquipe(req.auth) ? req.query.cliente : req.auth.sub

    const feedbacks = await feedbackService.listarFeedbacks({
      cliente,
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
    if (!ehEquipe(req.auth) && !ehOProprio(req.auth, req.params.idCliente)) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver as visitas de outra pessoa.' })
    }

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


router.get('/:id', donoOuEquipeLeitura, async (req, res) => {
  try {
    const feedback = await feedbackService.buscarFeedbackPorId(req.params.id)
    if (!feedback) return res.status(404).json({ erro: 'Feedback não encontrado' })
    res.status(200).json(feedback)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Só quem escreveu a avaliação pode alterá-la
router.put('/:id', soCliente, donoOuAdmin, async (req, res) => {
  try {
    const feedback = await feedbackService.atualizarFeedback(req.params.id, req.body)
    res.status(200).json(feedback)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


// Quem escreveu ou o administrador (moderação)
router.delete('/:id', async (req, res, next) => {
  try {
    if (ehAdmin(req.auth)) return next()

    const dono = await donoDoFeedback(req.params.id)

    if (dono === undefined) return res.status(404).json({ erro: 'Feedback não encontrado' })
    if (req.auth.perfil === 'cliente' && dono === req.auth.sub) return next()

    return res.status(403).json({ erro: 'Você não tem permissão para apagar esta avaliação.' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
}, async (req, res) => {
  try {
    await feedbackService.deletarFeedback(req.params.id)
    res.status(200).json({ mensagem: 'Feedback deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
