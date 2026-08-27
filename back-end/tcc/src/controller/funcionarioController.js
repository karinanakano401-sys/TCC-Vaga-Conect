import express from 'express'
import * as funcionarioService from '../services/funcionarioservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const funcionario = await funcionarioService.criarFuncionario(req.body)
    res.status(201).json(funcionario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.post('/login', async (req, res) => {
  try {
    const funcionario = await funcionarioService.loginFuncionario(req.body)
    res.status(200).json(funcionario)
  } catch (error) {
    res.status(401).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const funcionarios = await funcionarioService.listarFuncionarios()
    res.status(200).json(funcionarios)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const funcionario = await funcionarioService.buscarFuncionarioPorId(req.params.id)
    if (!funcionario) return res.status(404).json({ erro: 'Funcionário não encontrado' })
    res.status(200).json(funcionario)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const funcionario = await funcionarioService.atualizarFuncionario(req.params.id, req.body)
    res.status(200).json(funcionario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await funcionarioService.deletarFuncionario(req.params.id)
    res.status(200).json({ mensagem: 'Funcionário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router