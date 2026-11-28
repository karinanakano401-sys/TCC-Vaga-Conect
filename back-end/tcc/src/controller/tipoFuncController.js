import express from 'express'
import * as tipoFuncService from '../services/tipofuncservice.js'
import {
  autenticar,
  autenticarSeHouver,
  soAdmin,
  ehAdmin,
  limitarCadastro
} from '../permissoes.js'

const router = express.Router()


// Sem login só o cargo padrão do cadastro de estacionamento ("Administrador"/admin).
// Qualquer outro cargo (ou outro "tipo" de acesso) é criado pelo administrador logado.
router.post('/', limitarCadastro, autenticarSeHouver, async (req, res) => {
  try {
    const ehCargoPadrao = req.body?.nome === 'Administrador' && req.body?.tipo === 'admin'

    if (!ehAdmin(req.auth) && !ehCargoPadrao) {
      return res.status(403).json({ erro: 'Só um administrador logado pode criar outros cargos.' })
    }

    const tipoFunc = await tipoFuncService.criarTipoFunc(req.body)
    res.status(201).json(tipoFunc)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


// Só nomes de cargo (a tela de cadastro usa antes do login)
router.get('/', async (req, res) => {
  try {
    const tipoFuncs = await tipoFuncService.listarTipoFuncs()
    res.status(200).json(tipoFuncs)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', autenticar, async (req, res) => {
  try {
    const tipoFunc = await tipoFuncService.buscarTipoFuncPorId(req.params.id)
    if (!tipoFunc) return res.status(404).json({ erro: 'Tipo de funcionário não encontrado' })
    res.status(200).json(tipoFunc)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', autenticar, soAdmin, async (req, res) => {
  try {
    const tipoFunc = await tipoFuncService.atualizarTipoFunc(req.params.id, req.body)
    res.status(200).json(tipoFunc)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.delete('/:id', autenticar, soAdmin, async (req, res) => {
  try {
    await tipoFuncService.deletarTipoFunc(req.params.id)
    res.status(200).json({ mensagem: 'Tipo de funcionário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
