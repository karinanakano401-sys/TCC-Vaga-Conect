import express from 'express'
import * as vagaService from '../services/vagaservice.js'
import { verificarDisponibilidade, listarDuracoes, listarHorarios } from '../services/agendamentoservice.js'
import { autenticar, soAdmin, soEquipe, ehAdmin } from '../permissoes.js'

const router = express.Router()

// Consultar vagas, horários e durações: qualquer pessoa logada (o cliente escolhe a vaga).
// Cadastrar, editar o cadastro e apagar: administrador. O funcionário só muda o status da vaga.
router.use(autenticar)


router.post('/', soAdmin, async (req, res) => {
  try {
    const vaga = await vagaService.criarVaga(req.body)
    res.status(201).json(vaga)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const vagas = await vagaService.listarVagas()
    res.status(200).json(vagas)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// A vaga está livre para este período? (?inicio=ISO&fim=ISO)
router.get('/:id/disponibilidade', async (req, res) => {
  try {
    const resultado = await verificarDisponibilidade(
      req.params.id,
      req.query.inicio,
      req.query.fim,
      req.query.ignorar || null
    )
    res.status(200).json(resultado)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// Horários de entrada (de 30 em 30 min) do período ?de=ISO&ate=ISO e se a vaga está livre em cada um
router.get('/:id/horarios', async (req, res) => {
  try {
    const resultado = await listarHorarios(req.params.id, req.query.de, req.query.ate, req.query.ignorar || null)
    res.status(200).json(resultado)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// Durações (de 30 em 30 min) que cabem na vaga para quem chega em ?inicio=ISO
router.get('/:id/duracoes', async (req, res) => {
  try {
    const resultado = await listarDuracoes(req.params.id, req.query.inicio, req.query.ignorar || null)
    res.status(200).json(resultado)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const vaga = await vagaService.buscarVagaPorId(req.params.id)
    if (!vaga) return res.status(404).json({ erro: 'Vaga não encontrada' })
    res.status(200).json(vaga)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', soEquipe, async (req, res) => {
  try {
    let dados = req.body

    // funcionário: só o status; número, tipo, preço e estacionamento ficam como estão
    if (!ehAdmin(req.auth)) {
      const atual = await vagaService.buscarVagaPorId(req.params.id)
      if (!atual) return res.status(404).json({ erro: 'Vaga não encontrada' })

      dados = {
        numero: atual.numero,
        tipo:   atual.tipo,
        preco:  atual.preco,
        fk_est: atual.fk_est,
        status: req.body?.status ?? atual.status
      }
    }

    const vaga = await vagaService.atualizarVaga(req.params.id, dados)
    res.status(200).json(vaga)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// Apagar a vaga apaga em cascata as reservas e os pagamentos dela: só o administrador
router.delete('/:id', soAdmin, async (req, res) => {
  try {
    await vagaService.deletarVaga(req.params.id)
    res.status(200).json({ mensagem: 'Vaga deletada com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
