/* =====================================================
   VagaConnect · cobrança por minuto

   O preço cadastrado da vaga continua sendo R$/hora.
   Exemplo: R$ 15,00/hora → R$ 0,25/minuto.

   Na reserva o cliente antecipa o tempo marcado.
   No cancelamento (ou na saída antecipada) volta o
   valor dos minutos que ele não utilizou. A garantia
   de reserva não entra nessa conta.
===================================================== */

(function (root) {
    "use strict";

    var GARANTIA = 25;

    function arredondar(valor) {
        return Math.round(Number(valor || 0) * 100) / 100;
    }

    function mostrarPreco(valor) {
        return arredondar(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function mostrarDuracao(minutos) {
        minutos = Math.max(0, Number(minutos || 0));
        if (minutos < 60) return minutos + " min";
        var h = Math.floor(minutos / 60);
        var m = minutos % 60;
        return m === 0 ? h + "h" : h + "h " + String(m).padStart(2, "0") + "min";
    }

    function precoPorMinuto(precoHora) {
        return arredondar(Number(precoHora || 0) / 60);
    }

    function valorDosMinutos(precoHora, minutos) {
        return arredondar(Number(minutos || 0) * Number(precoHora || 0) / 60);
    }

    function textoTarifa(precoHora) {
        return mostrarPreco(precoHora) + "/hora · " + mostrarPreco(precoPorMinuto(precoHora)) + "/min";
    }

    function minutosEntre(inicio, fim) {
        var a = new Date(inicio);
        var b = new Date(fim);
        if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0;
        return Math.ceil((b.getTime() - a.getTime()) / 60000);
    }

    function totalPago(item) {
        if (!item || !item.pagamentos) return 0;
        return arredondar(item.pagamentos.reduce(function (soma, pagamento) {
            return soma + Number(pagamento.valor || 0);
        }, 0));
    }

    function creditoVaga(pago) {
        return Math.max(0, arredondar(Number(pago || 0) - GARANTIA));
    }

    function minutosUsados(item, agora) {
        agora = agora ? new Date(agora) : new Date();
        var status = item && item.reserva ? item.reserva.status : "";
        var entrada = new Date(item && item.hora);
        if (isNaN(entrada.getTime())) return 0;
        if (aguardandoChegada(status)) return 0;

        var fim;
        if (status === "Ativa") {
            fim = agora;
        } else if (item.horaSaida) {
            fim = new Date(item.horaSaida);
        } else {
            fim = agora;
        }

        if (isNaN(fim.getTime()) || fim <= entrada) return 0;
        return Math.ceil((fim.getTime() - entrada.getTime()) / 60000);
    }

    function calcularReserva(precoHora, minutos) {
        var minutosSeguros = Math.max(1, Number(minutos || 0));
        var valorVaga = valorDosMinutos(precoHora, minutosSeguros);
        return {
            precoHora: Number(precoHora || 0),
            precoMinuto: precoPorMinuto(precoHora),
            minutos: minutosSeguros,
            valorVaga: valorVaga,
            garantia: GARANTIA,
            total: arredondar(valorVaga + GARANTIA)
        };
    }

    function calcularUso(item, agora) {
        var precoHora = Number(item && item.reserva && item.reserva.vaga ? item.reserva.vaga.preco : 0);
        var usados = minutosUsados(item, agora);
        var valorUsado = valorDosMinutos(precoHora, usados);
        var pago = totalPago(item);
        var credito = creditoVaga(pago);
        return {
            precoHora: precoHora,
            precoMinuto: precoPorMinuto(precoHora),
            minutosUsados: usados,
            valorUsado: valorUsado,
            garantia: GARANTIA,
            pago: pago,
            creditoVaga: credito,
            aPagar: Math.max(0, arredondar(valorUsado - credito)),
            reembolso: Math.max(0, arredondar(credito - valorUsado)),
            ativa: statusAtiva(item)
        };
    }

    var STATUS_AGUARDANDO = ["Reservada", "Tolerância", "Atraso"];
    var TOLERANCIA_MS = 10 * 60 * 1000;
    var ATRASO_MS = 20 * 60 * 1000;

    function aguardandoChegada(status) {
        return STATUS_AGUARDANDO.indexOf(status) !== -1;
    }

    function statusAtiva(item) {
        return !!(item && item.reserva && item.reserva.status === "Ativa");
    }

    function faseChegada(item, agora) {
        agora = agora ? new Date(agora) : new Date();
        var status = item && item.reserva ? item.reserva.status : "";
        if (!aguardandoChegada(status)) return null;

        var chegada = new Date(item && item.hora);
        if (isNaN(chegada.getTime())) return null;

        var fimTolerancia = new Date(chegada.getTime() + TOLERANCIA_MS);
        var fimAtraso = new Date(chegada.getTime() + TOLERANCIA_MS + ATRASO_MS);

        if (agora < chegada) {
            return { fase: "Reservada", ate: chegada };
        }
        if (agora < fimTolerancia) {
            return { fase: "Tolerância", ate: fimTolerancia };
        }
        if (agora < fimAtraso) {
            return { fase: "Atraso", ate: fimAtraso };
        }
        return { fase: "Cancelada", ate: null };
    }

    root.Cobranca = {
        GARANTIA: GARANTIA,
        STATUS_AGUARDANDO: STATUS_AGUARDANDO,
        TOLERANCIA_MS: TOLERANCIA_MS,
        ATRASO_MS: ATRASO_MS,
        aguardandoChegada: aguardandoChegada,
        faseChegada: faseChegada,
        arredondar: arredondar,
        mostrarPreco: mostrarPreco,
        mostrarDuracao: mostrarDuracao,
        precoPorMinuto: precoPorMinuto,
        valorDosMinutos: valorDosMinutos,
        textoTarifa: textoTarifa,
        minutosEntre: minutosEntre,
        totalPago: totalPago,
        creditoVaga: creditoVaga,
        minutosUsados: minutosUsados,
        calcularReserva: calcularReserva,
        calcularUso: calcularUso
    };
})(typeof window !== "undefined" ? window : globalThis);
