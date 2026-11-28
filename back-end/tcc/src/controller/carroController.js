import express from 'express'
import * as carroService from '../services/carroservice.js'
import { autenticar, donoOuEquipe, donoDoCarro, ehEquipe } from '../permissoes.js'

const router = express.Router()

// Veículos pertencem ao cliente: ele só vê e mexe nos próprios; a equipe enxerga todos.
router.use(autenticar)

const dono = donoOuEquipe((req) => donoDoCarro(req.params.id))


router.post('/', async (req, res) => {
  try {
    const dados = ehEquipe(req.auth)
      ? req.body
      : { ...req.body, fk_idCliente: req.auth.sub }

    const carro = await carroService.criarCarro(dados)
    res.status(201).json(carro)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const carros = await carroService.listarCarros(ehEquipe(req.auth) ? undefined : req.auth.sub)
    res.status(200).json(carros)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', dono, async (req, res) => {
  try {
    const carro = await carroService.buscarCarroPorId(req.params.id)
    if (!carro) return res.status(404).json({ erro: 'Carro não encontrado' })
    res.status(200).json(carro)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', dono, async (req, res) => {
  try {
    // o cliente não passa o carro para outra pessoa
    const dados = ehEquipe(req.auth)
      ? req.body
      : { ...req.body, fk_idCliente: req.auth.sub }

    const carro = await carroService.atualizarCarro(req.params.id, dados)
    res.status(200).json(carro)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', dono, async (req, res) => {
  try {
    await carroService.deletarCarro(req.params.id)
    res.status(200).json({ mensagem: 'Carro deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
