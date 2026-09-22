(function (root) {
    "use strict";

    var API = "http://localhost:3333";
    var WS = "ws://localhost:3333/ws";
    var AGUARDANDO = ["Reservada", "Tolerância", "Atraso"];

    function aguardandoChegada(status) {
        return AGUARDANDO.indexOf(status) !== -1;
    }

    async function gerarCodigo(id) {
        var resposta = await fetch(API + "/reservacli/" + id + "/codigo-presenca", {
            method: "POST"
        });
        var dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível gerar o código.");
        }
        return dados;
    }

    async function confirmar(id, codigo) {
        var resposta = await fetch(API + "/reservacli/" + id + "/confirmar-presenca", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo })
        });
        var dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível confirmar a presença.");
        }
        return dados;
    }

    function esperar(id, aoConfirmar, opcoes) {
        var socket = null;
        var poll = null;
        var encerrado = false;
        opcoes = opcoes || {};
        var evento = opcoes.evento || "presenca-confirmada";
        var statusOk = opcoes.status || "Ativa";

        function limparPoll() {
            if (poll) clearInterval(poll);
            poll = null;
        }

        function avisar() {
            if (encerrado) return;
            encerrado = true;
            limparPoll();
            if (socket && socket.readyState === 1) socket.close();
            if (typeof aoConfirmar === "function") aoConfirmar();
        }

        async function checarApi() {
            try {
                var resposta = await fetch(API + "/reservacli/" + id);
                var item = await resposta.json();
                if (resposta.ok && item.reserva && item.reserva.status === statusOk) {
                    avisar();
                }
            } catch (error) {}
        }

        function iniciarPoll() {
            if (poll || encerrado) return;
            poll = setInterval(checarApi, 2500);
            checarApi();
        }

        try {
            socket = new WebSocket(WS);
            socket.onopen = function () {
                socket.send(JSON.stringify({
                    tipo: "entrar",
                    reservaCliId: id
                }));
            };
            socket.onmessage = function (ev) {
                try {
                    var msg = JSON.parse(ev.data);
                    if (msg.tipo === evento && String(msg.reservaCliId) === String(id)) {
                        avisar();
                    }
                } catch (error) {}
            };
            socket.onerror = iniciarPoll;
            socket.onclose = function () {
                if (!encerrado) iniciarPoll();
            };
        } catch (error) {
            iniciarPoll();
        }

        iniciarPoll();

        return {
            fechar: function () {
                encerrado = true;
                limparPoll();
                if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
                    socket.close();
                }
            }
        };
    }

    function texto(valor) {
        return String(valor == null ? "" : valor);
    }

    function fecharFundo(fundo, espera) {
        if (espera) espera.fechar();
        fundo.classList.remove("on");
        setTimeout(function () {
            if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
        }, 200);
    }

    function abrirFundo(html) {
        var fundo = document.createElement("div");
        fundo.className = "vc-presenca-fundo";
        fundo.innerHTML = html;
        document.body.appendChild(fundo);
        requestAnimationFrame(function () {
            fundo.classList.add("on");
        });
        return fundo;
    }

    function digitos(codigo) {
        return texto(codigo || "------").split("").map(function (d) {
            return "<span>" + d + "</span>";
        }).join("");
    }

    function modalPatio(opcoes) {
        opcoes = opcoes || {};
        var item = opcoes.item || {};
        var id = item.id;
        if (!id) return;

        var nome = (item.usuario && item.usuario.nome) || "Cliente";
        var vaga = item.reserva && item.reserva.vaga ? "Vaga " + item.reserva.vaga.numero : "Vaga";
        var espera = null;

        var fundo = abrirFundo(
            '<div class="vc-presenca-modal" role="dialog" aria-modal="true">' +
                '<button type="button" class="vc-presenca-fechar" aria-label="Fechar">×</button>' +
                '<div class="vc-presenca-icone"><i class="fa-solid fa-key"></i></div>' +
                "<h3>Cliente chegou</h3>" +
                '<p class="vc-presenca-sub">Passe o código abaixo para o cliente confirmar no app.</p>' +
                '<p class="vc-presenca-meta"></p>' +
                '<div class="vc-presenca-digitos">' + digitos("------") + "</div>" +
                '<div class="vc-presenca-espera"><i class="fa-solid fa-circle"></i><span>Gerando código…</span></div>' +
                '<p class="vc-presenca-erro"></p>' +
                '<div class="vc-presenca-acoes">' +
                    '<button type="button" class="vc-presenca-secundario">Gerar novo código</button>' +
                "</div>" +
            "</div>"
        );

        fundo.querySelector(".vc-presenca-meta").textContent = nome + " · " + vaga;

        var caixaDigitos = fundo.querySelector(".vc-presenca-digitos");
        var esperaEl = fundo.querySelector(".vc-presenca-espera span");
        var erroEl = fundo.querySelector(".vc-presenca-erro");
        var icone = fundo.querySelector(".vc-presenca-icone");

        function mostrarCodigo(codigo) {
            caixaDigitos.innerHTML = digitos(codigo);
            esperaEl.textContent = "Aguardando o cliente confirmar…";
        }

        function ligarEspera() {
            if (espera) espera.fechar();
            espera = esperar(id, function () {
                icone.classList.add("ok");
                icone.innerHTML = '<i class="fa-solid fa-check"></i>';
                fundo.querySelector("h3").textContent = "Presença confirmada";
                fundo.querySelector(".vc-presenca-sub").textContent = "A vaga está ocupada.";
                fundo.querySelector(".vc-presenca-espera").style.display = "none";
                fundo.querySelector(".vc-presenca-acoes").style.display = "none";
                setTimeout(function () {
                    fecharFundo(fundo, espera);
                    if (typeof opcoes.aoConfirmar === "function") opcoes.aoConfirmar();
                }, 1400);
            });
        }

        async function emitir(forcarNovo) {
            erroEl.textContent = "";
            esperaEl.textContent = "Gerando código…";
            try {
                var atual = item;
                if (forcarNovo || !item.codigoPresenca) {
                    atual = await gerarCodigo(id);
                    item.codigoPresenca = atual.codigoPresenca;
                }
                mostrarCodigo(item.codigoPresenca);
                ligarEspera();
            } catch (error) {
                erroEl.textContent = error.message || "Não foi possível gerar o código.";
            }
        }

        fundo.querySelector(".vc-presenca-fechar").addEventListener("click", function () {
            fecharFundo(fundo, espera);
            if (typeof opcoes.aoFechar === "function") opcoes.aoFechar();
        });

        fundo.querySelector(".vc-presenca-secundario").addEventListener("click", function () {
            emitir(true);
        });

        emitir(false);
    }

    function modalCliente(opcoes) {
        opcoes = opcoes || {};
        var id = opcoes.id;
        if (!id) return;

        var fundo = abrirFundo(
            '<div class="vc-presenca-modal" role="dialog" aria-modal="true">' +
                '<button type="button" class="vc-presenca-fechar" aria-label="Fechar">×</button>' +
                '<div class="vc-presenca-icone"><i class="fa-solid fa-circle-check"></i></div>' +
                "<h3>Confirmar presença</h3>" +
                '<p class="vc-presenca-sub">Digite o código de 6 dígitos informado pelo funcionário do pátio.</p>' +
                '<input class="vc-presenca-campo" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="off">' +
                '<p class="vc-presenca-erro"></p>' +
                '<div class="vc-presenca-acoes">' +
                    '<button type="button" class="vc-presenca-principal">Confirmar presença</button>' +
                "</div>" +
            "</div>"
        );

        var campo = fundo.querySelector(".vc-presenca-campo");
        var erroEl = fundo.querySelector(".vc-presenca-erro");
        var botao = fundo.querySelector(".vc-presenca-principal");
        var icone = fundo.querySelector(".vc-presenca-icone");

        campo.focus();

        fundo.querySelector(".vc-presenca-fechar").addEventListener("click", function () {
            fecharFundo(fundo);
        });

        async function enviar() {
            var codigo = campo.value.replace(/\s/g, "");
            if (!codigo) {
                erroEl.textContent = "Digite o código informado no pátio.";
                campo.focus();
                return;
            }
            botao.disabled = true;
            erroEl.textContent = "";
            try {
                await confirmar(id, codigo);
                icone.classList.add("ok");
                icone.innerHTML = '<i class="fa-solid fa-check"></i>';
                fundo.querySelector("h3").textContent = "Presença confirmada";
                fundo.querySelector(".vc-presenca-sub").textContent = "Sua vaga está ativa.";
                campo.style.display = "none";
                botao.style.display = "none";
                setTimeout(function () {
                    fecharFundo(fundo);
                    if (typeof opcoes.aoConfirmar === "function") opcoes.aoConfirmar();
                }, 1200);
            } catch (error) {
                erroEl.textContent = error.message || "Não foi possível confirmar.";
                botao.disabled = false;
                campo.focus();
            }
        }

        botao.addEventListener("click", enviar);
        campo.addEventListener("keydown", function (evento) {
            if (evento.key === "Enter") enviar();
        });
    }

    async function gerarCodigoSaida(id) {
        var resposta = await fetch(API + "/reservacli/" + id + "/codigo-saida", {
            method: "POST"
        });
        var dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível gerar o código de saída.");
        }
        return dados;
    }

    async function confirmarSaida(id, codigo, motivo) {
        var resposta = await fetch(API + "/reservacli/" + id + "/confirmar-saida", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo, motivo: motivo || "" })
        });
        var dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível confirmar a saída.");
        }
        return dados;
    }

    function podeEstornar(status) {
        return ["Reservada", "Tolerância", "Atraso", "Ativa"].indexOf(status) !== -1;
    }

    function modalPatioSaida(opcoes) {
        opcoes = opcoes || {};
        var item = opcoes.item || {};
        var id = item.id;
        if (!id) return;

        var nome = (item.usuario && item.usuario.nome) || "Cliente";
        var vaga = item.reserva && item.reserva.vaga ? "Vaga " + item.reserva.vaga.numero : "Vaga";
        var espera = null;

        var fundo = abrirFundo(
            '<div class="vc-presenca-modal" role="dialog" aria-modal="true">' +
                '<button type="button" class="vc-presenca-fechar" aria-label="Fechar">×</button>' +
                '<div class="vc-presenca-icone"><i class="fa-solid fa-arrow-right-from-bracket"></i></div>' +
                "<h3>Código de saída</h3>" +
                '<p class="vc-presenca-sub">Passe o código abaixo para o cliente confirmar o estorno no app.</p>' +
                '<p class="vc-presenca-meta"></p>' +
                '<div class="vc-presenca-digitos">' + digitos("------") + "</div>" +
                '<div class="vc-presenca-espera"><i class="fa-solid fa-circle"></i><span>Gerando código…</span></div>' +
                '<p class="vc-presenca-erro"></p>' +
                '<div class="vc-presenca-acoes">' +
                    '<button type="button" class="vc-presenca-secundario">Gerar novo código</button>' +
                "</div>" +
            "</div>"
        );

        fundo.querySelector(".vc-presenca-meta").textContent = nome + " · " + vaga;

        var caixaDigitos = fundo.querySelector(".vc-presenca-digitos");
        var esperaEl = fundo.querySelector(".vc-presenca-espera span");
        var erroEl = fundo.querySelector(".vc-presenca-erro");
        var icone = fundo.querySelector(".vc-presenca-icone");

        function mostrarCodigo(codigo) {
            caixaDigitos.innerHTML = digitos(codigo);
            esperaEl.textContent = "Aguardando o cliente confirmar o estorno…";
        }

        function ligarEspera() {
            if (espera) espera.fechar();
            espera = esperar(id, function () {
                icone.classList.add("ok");
                icone.innerHTML = '<i class="fa-solid fa-check"></i>';
                fundo.querySelector("h3").textContent = "Estorno confirmado";
                fundo.querySelector(".vc-presenca-sub").textContent = "O cliente confirmou a saída. A reserva foi cancelada e o reembolso foi registrado.";
                fundo.querySelector(".vc-presenca-espera").style.display = "none";
                fundo.querySelector(".vc-presenca-acoes").style.display = "none";
                setTimeout(function () {
                    fecharFundo(fundo, espera);
                    if (typeof opcoes.aoConfirmar === "function") opcoes.aoConfirmar();
                }, 1400);
            }, { evento: "saida-confirmada", status: "Cancelada" });
        }

        async function emitir(forcarNovo) {
            erroEl.textContent = "";
            esperaEl.textContent = "Gerando código…";
            try {
                if (forcarNovo || !item.codigoSaida) {
                    var atual = await gerarCodigoSaida(id);
                    item.codigoSaida = atual.codigoSaida;
                }
                mostrarCodigo(item.codigoSaida);
                ligarEspera();
            } catch (error) {
                erroEl.textContent = error.message || "Não foi possível gerar o código de saída.";
            }
        }

        fundo.querySelector(".vc-presenca-fechar").addEventListener("click", function () {
            fecharFundo(fundo, espera);
            if (typeof opcoes.aoFechar === "function") opcoes.aoFechar();
        });

        fundo.querySelector(".vc-presenca-secundario").addEventListener("click", function () {
            emitir(true);
        });

        emitir(false);
    }

    function modalClienteSaida(opcoes) {
        opcoes = opcoes || {};
        var id = opcoes.id;
        if (!id) return;

        var fundo = abrirFundo(
            '<div class="vc-presenca-modal" role="dialog" aria-modal="true">' +
                '<button type="button" class="vc-presenca-fechar" aria-label="Fechar">×</button>' +
                '<div class="vc-presenca-icone"><i class="fa-solid fa-arrow-right-from-bracket"></i></div>' +
                "<h3>Código de saída</h3>" +
                '<p class="vc-presenca-sub">Digite o código de 6 dígitos informado pelo funcionário para confirmar o estorno.</p>' +
                '<input class="vc-presenca-campo" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="off">' +
                '<p class="vc-presenca-erro"></p>' +
                '<div class="vc-presenca-acoes">' +
                    '<button type="button" class="vc-presenca-principal">Confirmar estorno</button>' +
                "</div>" +
            "</div>"
        );

        var campo = fundo.querySelector(".vc-presenca-campo");
        var erroEl = fundo.querySelector(".vc-presenca-erro");
        var botao = fundo.querySelector(".vc-presenca-principal");
        var icone = fundo.querySelector(".vc-presenca-icone");

        campo.focus();

        fundo.querySelector(".vc-presenca-fechar").addEventListener("click", function () {
            fecharFundo(fundo);
            if (typeof opcoes.aoFechar === "function") opcoes.aoFechar();
        });

        async function enviar() {
            var codigo = campo.value.replace(/\s/g, "");
            if (!codigo) {
                erroEl.textContent = "Digite o código de saída informado no pátio.";
                campo.focus();
                return;
            }
            botao.disabled = true;
            erroEl.textContent = "";
            try {
                var retorno = await confirmarSaida(id, codigo, opcoes.motivo);
                icone.classList.add("ok");
                icone.innerHTML = '<i class="fa-solid fa-check"></i>';
                fundo.querySelector("h3").textContent = "Estorno confirmado";
                fundo.querySelector(".vc-presenca-sub").textContent = "A reserva foi cancelada. O pedido de reembolso foi enviado ao pátio.";
                campo.style.display = "none";
                botao.style.display = "none";
                setTimeout(function () {
                    fecharFundo(fundo);
                    if (typeof opcoes.aoConfirmar === "function") opcoes.aoConfirmar(retorno);
                }, 1200);
            } catch (error) {
                erroEl.textContent = error.message || "Não foi possível confirmar o estorno.";
                botao.disabled = false;
                campo.focus();
            }
        }

        botao.addEventListener("click", enviar);
        campo.addEventListener("keydown", function (eventoTecla) {
            if (eventoTecla.key === "Enter") enviar();
        });
    }

    root.Presenca = {
        API: API,
        aguardandoChegada: aguardandoChegada,
        podeEstornar: podeEstornar,
        gerarCodigo: gerarCodigo,
        confirmar: confirmar,
        gerarCodigoSaida: gerarCodigoSaida,
        confirmarSaida: confirmarSaida,
        esperar: esperar,
        modalPatio: modalPatio,
        modalCliente: modalCliente,
        modalPatioSaida: modalPatioSaida,
        modalClienteSaida: modalClienteSaida
    };
})(typeof window !== "undefined" ? window : globalThis);
