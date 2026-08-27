import express from 'express'
import * as tipoFuncService from '../services/tipofuncservice.js'

const router = express.Router()


router.post('/', async (req, res) => {
  try {
    const tipoFunc = await tipoFuncService.criarTipoFunc(req.body)
    res.status(201).json(tipoFunc)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const tipoFuncs = await tipoFuncService.listarTipoFuncs()
    res.status(200).json(tipoFuncs)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', async (req, res) => {
  try {
    const tipoFunc = await tipoFuncService.buscarTipoFuncPorId(req.params.id)
    if (!tipoFunc) return res.status(404).json({ erro: 'Tipo de funcionário não encontrado' })
    res.status(200).json(tipoFunc)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', async (req, res) => {
  try {
    const tipoFunc = await tipoFuncService.atualizarTipoFunc(req.params.id, req.body)
    res.status(200).json(tipoFunc)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', async (req, res) => {
  try {
    await tipoFuncService.deletarTipoFunc(req.params.id)
    res.status(200).json({ mensagem: 'Tipo de funcionário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router