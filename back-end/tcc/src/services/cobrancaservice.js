// Regras de cobrança do VagaConnect: fonte única da verdade (back-end).
//
// - O preço da vaga é R$/hora; o valor por minuto é preco / 60.
// - A reserva é paga antecipada pelo tempo marcado + garantia fixa.
// - Cancelar ou sair antes devolve os minutos não usados (a garantia não volta).
// - Passou do horário de saída + tolerância, cobra o tempo extra por minuto.
//
// O dinheiro é guardado em Float; toda soma é feita em centavos inteiros
// e arredondada a 2 casas, para não acumular erro de ponto flutuante.

export const GARANTIA = 25
export const TOLERANCIA_SAIDA_MS = 10 * 60 * 1000
export const STATUS_EM_ANDAMENTO = ['Reservada', 'Tolerância', 'Atraso', 'Ativa']

export const FORMAS_DE_PAGAMENTO = {
  pix:      'PIX',
  cartao:   'Cartão de Crédito',
  dinheiro: 'Dinheiro'
}

export const CATEGORIAS = ['taxa', 'tempo_extra', 'ajuste']


export function paraCentavos(valor) {
  return Math.round(Number(valor || 0) * 100)
}


export function deCentavos(centavos) {
  return Math.round(centavos) / 100
}


export function arredondar(valor) {
  return deCentavos(paraCentavos(valor))
}


export function somar(valores) {
  return deCentavos(valores.reduce((soma, v) => soma + paraCentavos(v), 0))
}


export function minutosEntre(inicio, fim) {
  const a = new Date(inicio)
  const b = new Date(fim)

  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0

  return Math.ceil((b.getTime() - a.getTime()) / 60000)
}


export function valorDosMinutos(precoHora, minutos) {
  return arredondar(Number(minutos || 0) * Number(precoHora || 0) / 60)
}


// Valor cobrado ao reservar
export function calcularReserva(precoHora, minutos) {
  const minutosSeguros = Math.max(1, Math.round(Number(minutos || 0)))
  const valorVaga = valorDosMinutos(precoHora, minutosSeguros)

  return {
    minutos:   minutosSeguros,
    valorVaga,
    garantia:  GARANTIA,
    total:     arredondar(valorVaga + GARANTIA)
  }
}


export function totalPago(item, categoria) {
  const lista = (item?.pagamentos || []).filter(
    (p) => !categoria || p.categoria === categoria
  )

  return somar(lista.map((p) => p.valor))
}


// Quanto volta ao cliente se a reserva for cancelada agora
export function calcularEstorno(item, agora = new Date()) {
  const status = item.reserva?.status
  const precoHora = Number(item.reserva?.vaga?.preco || 0)
  const pago = totalPago(item)
  const credito = Math.max(0, arredondar(pago - GARANTIA))

  let minutosUsados = 0

  if (status === 'Ativa') {
    const entrada = new Date(item.hora)

    if (!isNaN(entrada.getTime()) && agora > entrada) {
      minutosUsados = Math.ceil((agora.getTime() - entrada.getTime()) / 60000)
    }
  }

  const valorUsado = valorDosMinutos(precoHora, minutosUsados)

  return {
    minutosUsados,
    valorUsado,
    pago,
    garantia:  GARANTIA,
    credito,
    reembolso: Math.max(0, arredondar(credito - valorUsado))
  }
}


// Tempo extra depois do horário de saída + tolerância
export function valorTempoExtra(item, agora = new Date()) {
  const saida = new Date(item?.horaSaida)
  const precoHora = Number(item?.reserva?.vaga?.preco || 0)

  if (isNaN(saida.getTime())) return { minutos: 0, valor: 0 }

  const inicioCobranca = saida.getTime() + TOLERANCIA_SAIDA_MS

  if (agora.getTime() <= inicioCobranca) return { minutos: 0, valor: 0 }

  const minutos = Math.ceil((agora.getTime() - inicioCobranca) / 60000)

  return {
    minutos,
    valor: valorDosMinutos(precoHora, minutos)
  }
}


// Situação de cobrança de uma reserva, calculada no servidor.
// O tempo extra só existe enquanto o carro está no pátio (status Ativa):
// na saída o horaSaida é regravado e o extra já foi cobrado.
export function resumoDeCobranca(item, agora = new Date()) {
  const ativa = item?.reserva?.status === 'Ativa'
  const extra = ativa ? valorTempoExtra(item, agora) : { minutos: 0, valor: 0 }
  const extraPago = totalPago(item, 'tempo_extra')
  const emAberto = Math.max(0, arredondar(extra.valor - extraPago))

  return {
    garantia:      GARANTIA,
    pago:          totalPago(item),
    taxaPaga:      totalPago(item, 'taxa'),
    extraMinutos:  extra.minutos,
    extraValor:    extra.valor,
    extraPago,
    emAberto,
    toleranciaMin: TOLERANCIA_SAIDA_MS / 60000
  }
}
