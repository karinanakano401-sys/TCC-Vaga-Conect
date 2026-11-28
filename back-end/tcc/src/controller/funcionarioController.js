import express from 'express'
import * as funcionarioService from '../services/funcionarioservice.js'
import { emitirToken } from '../auth.js'
import {
  autenticar,
  autenticarSeHouver,
  soAdmin,
  proprioOuAdmin,
  ehAdmin,
  limitarCadastro,
  limitarLogin,
  podeCadastrarFuncionario
} from '../permissoes.js'

const router = express.Router()


// Cadastro: o administrador cadastra quem quiser; sem login só vale o primeiro
// administrador de um estacionamento novo (ver podeCadastrarFuncionario)
router.post('/', limitarCadastro, autenticarSeHouver, async (req, res) => {
  try {
    if (!(await podeCadastrarFuncionario(req.auth, req.body))) {
      return res.status(403).json({
        erro: 'Só um administrador logado pode cadastrar funcionários em um estacionamento que já tem equipe.'
      })
    }

    const funcionario = await funcionarioService.criarFuncionario(req.body)
    res.status(201).json(funcionario)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.post('/login', limitarLogin, async (req, res) => {
  try {
    const funcionario = await funcionarioService.loginFuncionario(req.body)
    const token = emitirToken({
      id:     funcionario.id,
      tipo:   'funcionario',
      perfil: funcionario.tipoFunc?.tipo === 'admin' ? 'admin' : 'funcionario',
      nome:   funcionario.nome
    })
    res.status(200).json({ ...funcionario, token })
  } catch (error) {
    res.status(401).json({ erro: error.message })
  }
})


router.get('/', autenticar, soAdmin, async (req, res) => {
  try {
    const funcionarios = await funcionarioService.listarFuncionarios()
    res.status(200).json(funcionarios)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', autenticar, proprioOuAdmin, async (req, res) => {
  try {
    const funcionario = await funcionarioService.buscarFuncionarioPorId(req.params.id)
    if (!funcionario) return res.status(404).json({ erro: 'Funcionário não encontrado' })
    res.status(200).json(funcionario)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// O administrador edita qualquer cadastro. O funcionário só edita o próprio e
// nunca muda o próprio cargo nem o estacionamento (isso é do administrador).
router.put('/:id', autenticar, proprioOuAdmin, async (req, res) => {
  try {
    const dados = { ...req.body }

    if (!ehAdmin(req.auth)) {
      delete dados.fk_tipofunc
      delete dados.fk_est
    }

    const funcionario = await funcionarioService.atualizarFuncionario(req.params.id, dados)
    res.status(200).json(funcionario)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.delete('/:id', autenticar, soAdmin, async (req, res) => {
  try {
    await funcionarioService.deletarFuncionario(req.params.id)
    res.status(200).json({ mensagem: 'Funcionário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
