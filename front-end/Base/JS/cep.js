/* =====================================================
   VagaConnect · busca de CEP (ViaCEP)

   Consulta https://viacep.com.br e preenche rua,
   bairro, cidade e UF. O número continua manual.
===================================================== */

(function (root) {
    "use strict";

    function soNumeros(valor) {
        return String(valor || "").replace(/\D/g, "").slice(0, 8);
    }

    function formatar(valor) {
        var n = soNumeros(valor);
        if (n.length <= 5) return n;
        return n.slice(0, 5) + "-" + n.slice(5);
    }

    function aplicarMascara(input) {
        if (!input || input.dataset.cepMascara === "1") return;
        input.dataset.cepMascara = "1";
        input.setAttribute("maxlength", "9");
        input.setAttribute("inputmode", "numeric");
        input.placeholder = input.placeholder || "00000-000";
        input.addEventListener("input", function () {
            input.value = formatar(input.value);
        });
    }

    function definirValor(campo, valor) {
        if (!campo || valor == null || valor === "") return;
        campo.value = valor;
        if (campo.tagName === "SELECT" && campo.value !== valor) {
            var opcao = document.createElement("option");
            opcao.value = valor;
            opcao.textContent = valor;
            campo.appendChild(opcao);
            campo.value = valor;
        }
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        campo.dispatchEvent(new Event("change", { bubbles: true }));
    }

    async function buscar(cep) {
        var n = soNumeros(cep);
        if (n.length !== 8) return null;

        var resposta = await fetch("https://viacep.com.br/ws/" + n + "/json/");
        if (!resposta.ok) {
            throw new Error("Não foi possível consultar o CEP.");
        }

        var dados = await resposta.json();
        if (dados.erro) {
            throw new Error("CEP não encontrado. Confira o número e tente de novo.");
        }

        return {
            cep: formatar(dados.cep || n),
            rua: dados.logradouro || "",
            bairro: dados.bairro || "",
            cidade: dados.localidade || "",
            estado: dados.uf || ""
        };
    }

    function preencher(campos, endereco) {
        if (!campos || !endereco) return;
        definirValor(campos.rua, endereco.rua);
        definirValor(campos.bairro, endereco.bairro);
        definirValor(campos.cidade, endereco.cidade);
        definirValor(campos.estado, endereco.estado);
        definirValor(campos.cep, endereco.cep);
    }

    function ligar(cepInput, campos, opcoes) {
        if (!cepInput) return;

        campos = campos || {};
        opcoes = opcoes || {};

        aplicarMascara(cepInput);

        var ultimo = "";
        var timer = null;
        var emCurso = false;

        async function consultar() {
            var n = soNumeros(cepInput.value);
            if (n.length !== 8 || n === ultimo || emCurso) return;

            emCurso = true;
            ultimo = n;

            try {
                if (typeof opcoes.onStatus === "function") opcoes.onStatus("buscando");
                var endereco = await buscar(n);
                preencher(campos, endereco);
                if (campos.numero) campos.numero.focus();
                if (typeof opcoes.onPreenchido === "function") opcoes.onPreenchido(endereco);
                if (typeof opcoes.onStatus === "function") opcoes.onStatus("ok");
            } catch (erro) {
                ultimo = "";
                var mensagem = erro.message || "Não foi possível buscar o CEP.";
                if (typeof opcoes.onStatus === "function") {
                    opcoes.onStatus("erro", mensagem);
                } else {
                    alert(mensagem);
                }
            } finally {
                emCurso = false;
            }
        }

        cepInput.addEventListener("input", function () {
            clearTimeout(timer);
            if (soNumeros(cepInput.value).length !== 8) {
                ultimo = "";
                return;
            }
            timer = setTimeout(consultar, 250);
        });

        cepInput.addEventListener("blur", consultar);
    }

    root.Cep = {
        formatar: formatar,
        aplicarMascara: aplicarMascara,
        buscar: buscar,
        ligar: ligar
    };
})(typeof window !== "undefined" ? window : globalThis);
