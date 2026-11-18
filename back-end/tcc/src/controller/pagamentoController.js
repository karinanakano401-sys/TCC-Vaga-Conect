import express from 'express'
import * as pagamentoService from '../services/pagamentoservice.js'
import { autenticar, exigirPerfil, responderErro } from '../auth.js'

const router = express.Router()

// Toda a área financeira exige login
router.use(autenticar)


// Registro de pagamento no pátio (equipe). O valor é calculado no servidor.
router.post('/', exigirPerfil('admin', 'funcionario'), async (req, res) => {
  try {
    const pagamento = await pagamentoService.criarPagamento(req.body)
    res.status(201).json(pagamento)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


// Totais do período calculados no servidor (faturamento, reembolsos, líquido)
router.get('/resumo', exigirPerfil('admin', 'funcionario'), async (req, res) => {
  try {
    const resumo = await pagamentoService.resumoFinanceiro(req.query)
    res.status(200).json(resumo)
  } catch (error) {
    responderErro(res, error, 500)
  }
})


// Equipe vê tudo; cliente vê só os seus. Filtros opcionais: mes, ano, categoria
router.get('/', async (req, res) => {
  try {
    const pagamentos = await pagamentoService.listarPagamentos(req.auth, req.query)
    res.status(200).json(pagamentos)
  } catch (error) {
    responderErro(res, error, 500)
  }
})


router.get('/:id', async (req, res) => {
  try {
    const pagamento = await pagamentoService.buscarPagamentoPorId(req.params.id, req.auth)
    if (!pagamento) return res.status(404).json({ erro: 'Pagamento não encontrado' })
    res.status(200).json(pagamento)
  } catch (error) {
    responderErro(res, error, 500)
  }
})


// Só corrige a forma de pagamento (admin). Valor e reserva não mudam.
router.put('/:id', exigirPerfil('admin'), async (req, res) => {
  try {
    const pagamento = await pagamentoService.atualizarPagamento(req.params.id, req.body)
    res.status(200).json(pagamento)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


// Pagamento lançado não se apaga: o histórico financeiro é preservado.
router.delete('/:id', (req, res) => {
  res.status(405).json({
    erro: 'Pagamentos não podem ser excluídos. Para devolver dinheiro, use o reembolso.'
  })
})

export default router
