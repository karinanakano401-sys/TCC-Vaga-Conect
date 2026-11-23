// Situação real do cliente em relação à vaga: fonte única da verdade (back-end).
//
// Quem decide se o código de saída é exigido é o estado da OCUPAÇÃO, não o
// status do pagamento. Os sinais usados são:
//   - entradaEm / saidaEm  (registro de entrada e saída da reserva do cliente)
//   - status da reserva    (Ativa = confirmou a presença e está na vaga)
//   - status da vaga       (Ocupada)
//
// Situações:
//   sem_entrada  reserva paga, o cliente ainda não chegou        -> sem código
//   ocupando     entrada registrada e saída ainda não            -> COM código
//   saiu         já deixou a vaga                                -> sem código
//   cancelada    cancelada antes de qualquer entrada             -> sem código

export const STATUS_AGUARDANDO_CHEGADA = ['Reservada', 'Tolerância', 'Atraso']


export function situacaoDaOcupacao(item) {
  const status = item?.reserva?.status
  const vagaOcupada = item?.reserva?.vaga?.status === 'Ocupada'
  const entrou = Boolean(item?.entradaEm)
  const saiu = Boolean(item?.saidaEm)

  // Vaga 'Ocupada' só indica a presença DESTA reserva quando a hora dela já chegou
  // e não há outra reserva dentro da vaga (agendamento futuro ou reserva que espera
  // a saída de outro cliente nunca está "ocupando").
  const horaMs = new Date(item?.hora).getTime()
  const jaChegou = isNaN(horaMs) || horaMs <= Date.now()
  const outraDentro = (item?.reserva?.vaga?.reservas || []).some(
    (r) => r.status === 'Ativa' && r.id !== item?.reserva?.id
  )

  let situacao

  if (saiu || status === 'Concluída') {
    situacao = 'saiu'
  } else if (status === 'Cancelada') {
    // cancelada depois de entrar sempre passa por uma saída; sem entrada, nunca ocupou
    situacao = entrou ? 'saiu' : 'cancelada'
  } else if (status === 'Ativa' || entrou) {
    // reserva Ativa sem entradaEm (ativada antes do registro existir) conta como dentro
    situacao = 'ocupando'
  } else if (STATUS_AGUARDANDO_CHEGADA.includes(status)) {
    // presença confirmada mas o status ainda não acompanhou: a vaga marca a ocupação
    situacao = vagaOcupada && jaChegou && !outraDentro ? 'ocupando' : 'sem_entrada'
  } else {
    situacao = 'cancelada'
  }

  const ocupacaoAtiva = situacao === 'ocupando'

  return {
    situacao,
    ocupacaoAtiva,
    exigeCodigoSaida: ocupacaoAtiva,
    entradaEm: item?.entradaEm || null,
    saidaEm: item?.saidaEm || null
  }
}
