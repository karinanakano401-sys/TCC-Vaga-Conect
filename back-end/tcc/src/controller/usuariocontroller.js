import express from 'express'
import * as usuarioService from '../services/usuarioservice.js'
import { emitirToken } from '../auth.js'
import {
  autenticar,
  soAdmin,
  soOProprio,
  limitarCadastro,
  limitarLogin,
  ehEquipe,
  ehOProprio
} from '../permissoes.js'

const router = express.Router()


// Cadastro público (a pessoa ainda não tem login)
router.post('/', limitarCadastro, async (req, res) => {
  try {
    const usuario = await usuarioService.criarUsuario(req.body)
    res.status(201).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.post('/login', limitarLogin, async (req, res) => {
  try {
    const usuario = await usuarioService.loginUsuario(req.body)
    const token = emitirToken({ id: usuario.id, tipo: 'usuario', perfil: 'cliente', nome: usuario.nome })
    res.status(200).json({ ...usuario, token })
  } catch (error) {
    res.status(401).json({ erro: error.message })
  }
})


// Lista com CPF, e-mail e endereço de todos: só o administrador
router.get('/', autenticar, soAdmin, async (req, res) => {
  try {
    const usuarios = await usuarioService.listarUsuarios()
    res.status(200).json(usuarios)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// O próprio cliente ou a equipe (a equipe já enxerga o cliente nas reservas)
router.get('/:id', autenticar, async (req, res) => {
  try {
    if (!ehEquipe(req.auth) && !ehOProprio(req.auth, req.params.id)) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver os dados de outra pessoa.' })
    }

    const usuario = await usuarioService.buscarUsuarioPorId(req.params.id)
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })
    res.status(200).json(usuario)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Perfil e senha: só o próprio cliente
router.put('/:id', autenticar, soOProprio, async (req, res) => {
  try {
    const usuario = await usuarioService.atualizarUsuario(req.params.id, req.body)
    res.status(200).json(usuario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.put('/:id/avatar', autenticar, soOProprio, async (req, res) => {
  try {
    const avatar = req.body?.avatar ?? null
    const usuario = await usuarioService.atualizarAvatar(req.params.id, avatar)
    res.status(200).json(usuario)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado' })
    res.status(400).json({ erro: error.message })
  }
})


// Excluir uma conta apaga também as reservas, pagamentos e reembolsos dela: só o administrador
router.delete('/:id', autenticar, soAdmin, async (req, res) => {
  try {
    await usuarioService.deletarUsuario(req.params.id)
    res.status(200).json({ mensagem: 'Usuário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
