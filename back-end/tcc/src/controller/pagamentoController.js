import express from 'express'
import * as pagamentoService from '../services/pagamentoservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const pagamento = await pagamentoService.criarPagamento(req.body)
    res.status(201).json(pagamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const pagamentos = await pagamentoService.listarPagamentos()
    res.status(200).json(pagamentos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const pagamento = await pagamentoService.buscarPagamentoPorId(req.params.id)
    if (!pagamento) return res.status(404).json({ erro: 'Pagamento não encontrado' })
    res.status(200).json(pagamento)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const pagamento = await pagamentoService.atualizarPagamento(req.params.id, req.body)
    res.status(200).json(pagamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await pagamentoService.deletarPagamento(req.params.id)
    res.status(200).json({ mensagem: 'Pagamento deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router