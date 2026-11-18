import express from 'express'
import * as reembolsoService from '../services/reembolsoservice.js'
import { autenticar, exigirPerfil, responderErro } from '../auth.js'

const router = express.Router()

// Toda a área financeira exige login
router.use(autenticar)


// Cliente pede o dele; admin pode estornar a taxa inteira (estornoTotal).
// Os valores são calculados no servidor.
router.post('/', async (req, res) => {
  try {
    const reembolso = await reembolsoService.criarReembolso(req.body, req.auth)
    res.status(201).json(reembolso)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


// Equipe vê todos; cliente vê só os seus. Filtro opcional: status
router.get('/', async (req, res) => {
  try {
    const reembolsos = await reembolsoService.listarReembolsos(req.auth, req.query)
    res.status(200).json(reembolsos)
  } catch (error) {
    responderErro(res, error, 500)
  }
})


router.get('/:id', async (req, res) => {
  try {
    const reembolso = await reembolsoService.buscarReembolsoPorId(req.params.id, req.auth)
    if (!reembolso) return res.status(404).json({ erro: 'Reembolso não encontrado' })
    res.status(200).json(reembolso)
  } catch (error) {
    responderErro(res, error, 500)
  }
})


// Decisão da equipe (Aprovada/Recusada), uma única vez por pedido
router.put('/:id', exigirPerfil('admin', 'funcionario'), async (req, res) => {
  try {
    const reembolso = await reembolsoService.atualizarReembolso(req.params.id, req.body, req.auth)
    res.status(200).json(reembolso)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


// Reembolso registrado não se apaga: o histórico financeiro é preservado.
router.delete('/:id', (req, res) => {
  res.status(405).json({
    erro: 'Reembolsos não podem ser excluídos. Eles ficam no histórico financeiro.'
  })
})

export default router
