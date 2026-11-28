import express from 'express'
import * as enderecoService from '../services/enderecoservice.js'
import {
  autenticar,
  autenticarSeHouver,
  soAdmin,
  ehAdmin,
  donoOuEquipe,
  donoDoEndereco,
  enderecoEhOrfao,
  limitarCadastro
} from '../permissoes.js'

const router = express.Router()

// Endereço de cliente: o próprio cliente. Endereço de estacionamento: o administrador.
const donoOuEquipeLeitura = donoOuEquipe((req) => donoDoEndereco(req.params.id))
const donoOuAdmin = donoOuEquipe((req) => donoDoEndereco(req.params.id), { soAdminPode: true })


// Primeiro passo do cadastro (cliente ou novo estacionamento): ainda não há login
router.post('/', limitarCadastro, async (req, res) => {
  try {
    const endereco = await enderecoService.criarEndereco(req.body)
    res.status(201).json(endereco)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', autenticar, soAdmin, async (req, res) => {
  try {
    const enderecos = await enderecoService.listarEnderecos()
    res.status(200).json(enderecos)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.get('/:id', autenticar, donoOuEquipeLeitura, async (req, res) => {
  try {
    const endereco = await enderecoService.buscarEnderecoPorId(req.params.id)
    if (!endereco) return res.status(404).json({ erro: 'Endereço não encontrado' })
    res.status(200).json(endereco)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.put('/:id', autenticar, donoOuAdmin, async (req, res) => {
  try {
    const endereco = await enderecoService.atualizarEndereco(req.params.id, req.body)
    res.status(200).json(endereco)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


// O administrador apaga qualquer um. Sem login só vale para endereço sem dono
// (é o desfazer de um cadastro que falhou no meio).
router.delete('/:id', autenticarSeHouver, async (req, res) => {
  try {
    if (!ehAdmin(req.auth) && !(await enderecoEhOrfao(req.params.id))) {
      return res.status(req.auth ? 403 : 401).json({
        erro: 'Você não tem permissão para apagar este endereço.'
      })
    }

    await enderecoService.deletarEndereco(req.params.id)
    res.status(200).json({ mensagem: 'Endereço deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
