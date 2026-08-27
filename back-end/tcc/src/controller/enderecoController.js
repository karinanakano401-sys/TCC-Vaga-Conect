import express from 'express'
import * as enderecoService from '../services/enderecoservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const endereco = await enderecoService.criarEndereco(req.body)
    res.status(201).json(endereco)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const enderecos = await enderecoService.listarEnderecos()
    res.status(200).json(enderecos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const endereco = await enderecoService.buscarEnderecoPorId(req.params.id)
    if (!endereco) return res.status(404).json({ erro: 'Endereço não encontrado' })
    res.status(200).json(endereco)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const endereco = await enderecoService.atualizarEndereco(req.params.id, req.body)
    res.status(200).json(endereco)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await enderecoService.deletarEndereco(req.params.id)
    res.status(200).json({ mensagem: 'Endereço deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router