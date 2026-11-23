import prismaClient from '../prisma/index.js'
import { processarAtrasos } from './atrasoservice.js'
import { erroHttp } from '../auth.js'
import { anexarAgendamentos, quemSegura } from './agendamentoservice.js'


export async function criarVaga(dados) {
  const vaga = await prismaClient.vaga.create({
    data: {
      numero: dados.numero,
      tipo:   dados.tipo,
      status: dados.status,
      preco:  Number(dados.preco),
      fk_est: dados.fk_est,
    }
  })
  return vaga
}


// Cada vaga traz `agendamentos`: os horários já comprometidos (início/fim),
// para a tela mostrar "livre agora, reservada a partir de ...".
export async function listarVagas() {
  await processarAtrasos()
  const vagas = await prismaClient.vaga.findMany({
    include: { estacionamento: true }
  })
  return anexarAgendamentos(vagas)
}


export async function buscarVagaPorId(id) {
  const vaga = await prismaClient.vaga.findUnique({
    where: { id },
    include: { estacionamento: true }
  })

  if (!vaga) return vaga

  const [comAgendamentos] = await anexarAgendamentos([vaga])
  return comAgendamentos
}


export async function atualizarVaga(id, dados) {
  // Liberar a vaga só vale se nenhuma reserva em andamento estiver com ela.
  // Cancelar um agendamento futuro (ou a reserva de outra pessoa) não libera
  // a vaga de quem está usando agora.
  if (dados.status === 'Livre') {
    const atual = await prismaClient.vaga.findUnique({ where: { id } })

    if (atual && atual.status !== 'Livre') {
      const dona = await quemSegura(prismaClient, id)

      if (dona) {
        throw erroHttp(409, 'Esta vaga está com uma reserva em andamento. Encerre ou cancele essa reserva antes de liberar a vaga.')
      }
    }
  }

  const vaga = await prismaClient.vaga.update({
    where: { id },
    data: {
      numero: dados.numero,
      tipo:   dados.tipo,
      status: dados.status,
      preco:  Number(dados.preco),
      fk_est: dados.fk_est,
    }
  })
  return vaga
}


export async function deletarVaga(id) {
  await prismaClient.vaga.delete({
    where: { id }
  })
}
