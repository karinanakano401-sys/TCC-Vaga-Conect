import express from 'express'
import * as estacionamentoService from '../services/estacionamentoservice.js'
import {
  autenticar,
  autenticarSeHouver,
  soAdmin,
  ehAdmin,
  limitarCadastro,
  estacionamentoEstaVazio
} from '../permissoes.js'

const router = express.Router()


// Cadastro de um novo estacionamento (junto com o primeiro administrador): sem login
router.post('/', limitarCadastro, async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.criarEstacionamento(req.body)
    res.status(201).json(estacionamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


// Quem está logado (cliente escolhe onde estacionar; equipe gerencia)
router.get('/', autenticar, async (req, res) => {
  try {
    const estacionamentos = await estacionamentoService.listarEstacionamentos()
    res.status(200).json(estacionamentos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', autenticar, async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.buscarEstacionamentoPorId(req.params.id)
    if (!estacionamento) return res.status(404).json({ erro: 'Estacionamento não encontrado' })
    res.status(200).json(estacionamento)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', autenticar, soAdmin, async (req, res) => {
  try {
    const estacionamento = await estacionamentoService.atualizarEstacionamento(req.params.id, req.body)
    res.status(200).json(estacionamento)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


// Excluir apaga as vagas e, em cascata, as reservas e pagamentos delas: só o administrador.
// Sem login só vale para estacionamento vazio (desfazer de um cadastro que falhou).
router.delete('/:id', autenticarSeHouver, async (req, res) => {
  try {
    if (!ehAdmin(req.auth) && !(await estacionamentoEstaVazio(req.params.id))) {
      return res.status(req.auth ? 403 : 401).json({
        erro: 'Você não tem permissão para apagar este estacionamento.'
      })
    }

    await estacionamentoService.deletarEstacionamento(req.params.id)
    res.status(200).json({ mensagem: 'Estacionamento deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
