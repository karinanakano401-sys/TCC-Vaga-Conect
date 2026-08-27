import express from 'express'
import * as usuarioService from '../services/usuarioservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const usuario = await usuarioService.criarUsuario(req.body)
    res.status(201).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.post('/login', async (req, res) => {
  try {
    const usuario = await usuarioService.loginUsuario(req.body)
    res.status(200).json(usuario)
  } catch (error) {
    res.status(401).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const usuarios = await usuarioService.listarUsuarios()
    res.status(200).json(usuarios)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const usuario = await usuarioService.buscarUsuarioPorId(req.params.id)
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const usuario = await usuarioService.atualizarUsuario(req.params.id, req.body)
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await usuarioService.deletarUsuario(req.params.id)
    res.status(200).json({ mensagem: 'Usuário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router