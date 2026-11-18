/* =====================================================
   VagaConnect · auth.js

   Manda o token de login em toda chamada à API, para que
   as telas continuem usando fetch() normalmente.

   COMO USAR
   Em cada tela que fala com a área financeira, adicione
   antes do código da página:

        <script src="../../Base/JS/auth.js"></script>

   O token vem no próprio objeto de sessão (usuarioLogado /
   funcionarioLogado), gravado no login.

   Sessão antiga (sem token) ou vencida: a API responde 401
   e o usuário volta para a tela de login.
===================================================== */

(function () {
    "use strict";

    var API = "http://localhost:3333";

    var fetchOriginal = window.fetch.bind(window);

    // onde fica a tela de login, a partir do endereço deste script
    var scriptAtual = document.currentScript && document.currentScript.src;
    var urlLogin = scriptAtual
        ? new URL("../HTML/OpçãoLogin.html", scriptAtual).href
        : "../../Base/HTML/OpçãoLogin.html";

    var avisou = false;


    function lerSessao(chave) {
        try {
            return JSON.parse(localStorage.getItem(chave) || "null");
        } catch (erro) {
            return null;
        }
    }


    // Telas do pátio usam a sessão do funcionário; as do cliente, a do usuário
    function areaDaTela() {
        var caminho = decodeURIComponent(window.location.pathname).toLowerCase();

        if (caminho.indexOf("/administrador/") !== -1 || caminho.indexOf("/funcionario/") !== -1) {
            return "funcionario";
        }

        if (caminho.indexOf("/usuario/") !== -1) {
            return "usuario";
        }

        return null;
    }


    function tokenDaTela() {
        var funcionario = lerSessao("funcionarioLogado");
        var usuario = lerSessao("usuarioLogado");
        var area = areaDaTela();

        if (area === "funcionario") return (funcionario && funcionario.token) || null;
        if (area === "usuario") return (usuario && usuario.token) || null;

        return (funcionario && funcionario.token) || (usuario && usuario.token) || null;
    }


    function ehChamadaDaApi(url) {
        return typeof url === "string" && url.indexOf(API) === 0;
    }


    function ehLogin(url) {
        return /\/(usuario|funcionario)\/login(\?|$)/.test(url);
    }


    function sessaoExpirada() {
        if (avisou) return;
        avisou = true;

        var area = areaDaTela();

        if (area === "funcionario" || area === null) localStorage.removeItem("funcionarioLogado");
        if (area === "usuario" || area === null) localStorage.removeItem("usuarioLogado");

        alert("Sua sessão expirou. Entre novamente para continuar.");

        window.location.replace(urlLogin);
    }


    window.fetch = function (entrada, opcoes) {
        var url = typeof entrada === "string" ? entrada : (entrada && entrada.url) || "";

        if (!ehChamadaDaApi(url) || ehLogin(url)) {
            return fetchOriginal(entrada, opcoes);
        }

        var token = tokenDaTela();
        var config = Object.assign({}, opcoes || {});
        var cabecalhos = new Headers(config.headers || {});

        if (token && !cabecalhos.has("Authorization")) {
            cabecalhos.set("Authorization", "Bearer " + token);
        }

        config.headers = cabecalhos;

        return fetchOriginal(entrada, config).then(function (resposta) {
            if (resposta.status === 401) sessaoExpirada();

            return resposta;
        });
    };


    // as telas podem pedir os dados de quem está logado sem reler o storage
    window.Auth = {
        token: tokenDaTela,

        // mensagem pronta para erros de permissão
        mensagemDeErro: function (resposta, corpo) {
            if (resposta && resposta.status === 403) {
                return (corpo && corpo.erro) || "Você não tem permissão para esta ação.";
            }

            return (corpo && corpo.erro) || "Não foi possível concluir a operação.";
        }
    };
})();
