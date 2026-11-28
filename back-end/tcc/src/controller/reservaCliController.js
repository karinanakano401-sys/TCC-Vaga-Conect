import express from 'express'
import * as reservaCliService from '../services/reservacliservice.js'
import { responderErro } from '../auth.js'
import {
  autenticar,
  soAdmin,
  soEquipe,
  ehEquipe,
  donoOuEquipe,
  donoDaReservaCli
} from '../permissoes.js'

const router = express.Router()

// Tudo aqui exige login. O cliente só enxerga e mexe nas próprias reservas;
// gerar códigos de entrada/saída é do pátio (equipe); apagar é do administrador.
router.use(autenticar)

const donoOuEquipeDaReserva = donoOuEquipe((req) => donoDaReservaCli(req.params.id))


// Reserva + pagamento da taxa numa única operação (valor calculado no servidor)
router.post('/reservar', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.reservar(req.body, req.auth)
    res.status(201).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({
      erro: error.message,
      ...(error.valorCorreto !== undefined ? { valorCorreto: error.valorCorreto } : {}),
      ...(error.conflito ? { conflito: error.conflito } : {})
    })
  }
})


// Criar um vínculo de reserva sem passar pelo pagamento só existe para o administrador
router.post('/', soAdmin, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.criarReservaCli(req.body)
    res.status(201).json(reservaCli)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})


router.get('/', async (req, res) => {
  try {
    const reservaClis = await reservaCliService.listarReservaClis(ehEquipe(req.auth) ? undefined : req.auth.sub)
    res.status(200).json(reservaClis)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


router.post('/:id/codigo-presenca', soEquipe, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.gerarCodigoPresenca(req.params.id)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// O cliente digita o código que o pátio mostrou
router.post('/:id/confirmar-presenca', donoOuEquipeDaReserva, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.confirmarPresenca(req.params.id, req.body?.codigo)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.post('/:id/codigo-saida', soEquipe, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.gerarCodigoSaida(req.params.id)
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


router.post('/:id/sair', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.sairDaVaga(
      req.params.id,
      req.body?.codigo,
      req.body?.pagamento,
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({ erro: error.message })
  }
})


// Finalizar a utilização depois do fim do tempo contratado (sem reembolso)
router.post('/:id/finalizar', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.finalizarUtilizacao(
      req.params.id,
      { codigo: req.body?.codigo, pagamento: req.body?.pagamento },
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


router.post('/:id/confirmar-saida', async (req, res) => {
  try {
    const reservaCli = await reservaCliService.confirmarSaida(
      req.params.id,
      req.body?.codigo,
      req.body?.motivo,
      req.auth
    )
    res.status(200).json(reservaCli)
  } catch (error) {
    responderErro(res, error, 400)
  }
})


router.get('/:id', donoOuEquipeDaReserva, async (req, res) => {
  try {
    const reservaCli = await reservaCliService.buscarReservaCliPorId(req.params.id)
    if (!reservaCli) return res.status(404).json({ erro: 'Reserva de cliente não encontrada' })
    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})


// Equipe: ajusta a reserva. Cliente (dono): só prorroga a saída (até 1 hora por vez).
router.put('/:id', donoOuEquipeDaReserva, async (req, res) => {
  try {
    const reservaCli = ehEquipe(req.auth)
      ? await reservaCliService.atualizarReservaCli(req.params.id, req.body)
      : await reservaCliService.prorrogarComoCliente(req.params.id, req.body)

    res.status(200).json(reservaCli)
  } catch (error) {
    res.status(error.status || 400).json({
      erro: error.message,
      ...(error.conflito ? { conflito: error.conflito } : {})
    })
  }
})


// Apagar a reserva apaga também os pagamentos e reembolsos dela: só o administrador
router.delete('/:id', soAdmin, async (req, res) => {
  try {
    await reservaCliService.deletarReservaCli(req.params.id)
    res.status(200).json({ mensagem: 'Reserva de cliente deletada com sucesso' })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

export default router
