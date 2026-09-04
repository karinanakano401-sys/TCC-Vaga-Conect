// ===========================
// SESSÃO DO SISTEMA
// Usado pelas telas do admin e do funcionário
// ===========================

const API = "http://localhost:3333";


function pegarFuncionarioLogado(){

    return JSON.parse(
        localStorage.getItem("funcionarioLogado")
    );

}


function pegarUsuarioLogado(){

    return JSON.parse(
        localStorage.getItem("usuarioLogado")
    );

}


// Impede abrir a tela sem estar logado.
// O caminho do login muda conforme a pasta da tela.
function exigirLogin(tipo, caminhoLogin){

    const funcionario = pegarFuncionarioLogado();

    if(!funcionario){

        window.location.replace(caminhoLogin);

        return null;

    }

    if(tipo && funcionario.tipoFunc.tipo !== tipo){

        alert("Você não tem acesso a esta tela.");

        window.location.replace(caminhoLogin);

        return null;

    }

    return funcionario;

}


function iniciais(nome){

    if(!nome) return "F";

    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte.charAt(0).toUpperCase())
        .join("");

}


function mostrarFuncionarioNoPerfil(funcionario){

    if(!funcionario) return;

    const perfil = document.querySelector(".profile");

    if(perfil){

        const nome = perfil.querySelector("strong");

        const cargo = perfil.querySelector("small");

        const avatar = perfil.querySelector(".avatar");

        if(nome) nome.textContent = funcionario.nome;

        if(cargo) cargo.textContent = funcionario.tipoFunc.nome;

        if(avatar) avatar.textContent = funcionario.nome.charAt(0).toUpperCase();

    }

    const barra = document.querySelector(".sidebar-user");

    if(barra){

        const avatar = barra.querySelector(".user-avatar");

        const nome = barra.querySelector("strong");

        const cargo = barra.querySelector("span");

        if(avatar) avatar.textContent = iniciais(funcionario.nome);

        if(nome) nome.textContent = funcionario.nome;

        if(cargo) cargo.textContent = funcionario.tipoFunc.nome;

    }

}


function sair(caminhoSaida){

    const confirmar = confirm(
        "Tem certeza que deseja sair?"
    );

    if(!confirmar) return;

    localStorage.removeItem("funcionarioLogado");

    localStorage.removeItem("usuarioLogado");

    window.location.href = caminhoSaida;

}

/* =====================================================
   VagaConnect · confirmar-sair.js

   Troca a caixa cinza do navegador por uma janela no
   estilo do sistema, em TODAS as telas de uma vez.

   COMO USAR
   1. Salve em  front-end/Base/JS/confirmar-sair.js
   2. Em cada tela, adicione DEPOIS do sessao.js:

        <script src="../../Base/JS/sessao.js"></script>
        <script src="../../Base/JS/confirmar-sair.js"></script>

   Não precisa mexer em mais nada: o script segura o
   clique no #btnSair antes do código da página.
===================================================== */

(function(){

    "use strict";


    /* =================================================
       ESTILO
    ================================================= */

    const css = document.createElement("style");

    css.textContent = `
    .vcs-fundo{
        position:fixed; inset:0; z-index:10000;
        display:grid; place-items:center; padding:20px;
        background:rgba(3,11,22,.74);
        backdrop-filter:blur(4px);
        opacity:0; transition:opacity .18s ease;
        font-family:'Poppins', system-ui, sans-serif;
    }
    .vcs-fundo.on{ opacity:1; }

    .vcs-modal{
        width:min(360px, 100%);
        padding:24px 22px 18px;
        border:1px solid rgba(120,170,220,.2);
        border-top:2px solid var(--c);
        background:#071426;
        box-shadow:0 28px 60px rgba(0,0,0,.6);
        color:#e9f2fc;
        text-align:center;
        transform:translateY(10px);
        transition:transform .2s ease;
    }
    .vcs-fundo.on .vcs-modal{ transform:none; }

    .vcs-ico{
        width:46px; height:46px; margin:0 auto 14px;
        display:grid; place-items:center;
        border:1px solid var(--c);
        background:var(--f);
        color:var(--c);
    }
    .vcs-ico svg{ width:20px; height:20px; }

    .vcs-modal h3{ margin:0 0 6px; font-size:16px; font-weight:600; }
    .vcs-modal p{ margin:0 0 20px; color:#93aec9; font-size:12.5px; line-height:1.55; }

    .vcs-botoes{ display:grid; grid-template-columns:1fr 1fr; gap:9px; }

    .vcs-botoes button{
        position:relative; height:42px; overflow:hidden;
        border:1px solid transparent; border-radius:4px;
        background:transparent;
        font-family:ui-monospace,'Consolas',monospace;
        font-size:10.5px; font-weight:600;
        letter-spacing:.14em; text-transform:uppercase;
        cursor:pointer; transition:color .2s, border-color .2s;
    }
    .vcs-botoes button::before{
        content:""; position:absolute; inset:0; z-index:-1;
        transform:scaleX(0); transform-origin:left;
        transition:transform .26s cubic-bezier(.4,0,.2,1);
    }
    .vcs-botoes button:hover::before{ transform:scaleX(1); }

    .vcs-nao{ border-color:rgba(120,170,220,.34); color:#dceaf8; }
    .vcs-nao::before{ background:rgba(120,170,220,.18); }

    .vcs-sim{ border-color:var(--c); color:var(--c); }
    .vcs-sim::before{ background:var(--c); }
    .vcs-sim:hover{ color:#04121f; }

    .vcs-botoes button:focus-visible{ outline:2px solid #8cc2ff; outline-offset:2px; }

    @media (prefers-reduced-motion:reduce){
        .vcs-fundo,.vcs-modal,.vcs-botoes button::before{ transition:none; }
    }`;

    document.head.appendChild(css);



    /* =================================================
       A JANELA
    ================================================= */

    function perguntar(){

        return new Promise(function(responder){

            const fundo = document.createElement("div");

            fundo.className = "vcs-fundo";

            fundo.style.setProperty("--c", "#8cc2ff");

            fundo.style.setProperty("--f", "rgba(140,194,255,.12)");

            fundo.innerHTML = `
                <div class="vcs-modal" role="dialog" aria-modal="true" aria-labelledby="vcsTit">

                    <div class="vcs-ico" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/>
                        </svg>
                    </div>

                    <h3 id="vcsTit">Sair da sua conta?</h3>

                    <p>Suas reservas continuam salvas. Você volta para a tela inicial do VagaConnect.</p>

                    <div class="vcs-botoes">
                        <button class="vcs-nao" type="button">Ficar</button>
                        <button class="vcs-sim" type="button">Sair</button>
                    </div>

                </div>`;


            const naoBtn = fundo.querySelector(".vcs-nao");

            const simBtn = fundo.querySelector(".vcs-sim");

            const focoAnterior = document.activeElement;


            document.body.appendChild(fundo);

            requestAnimationFrame(function(){ fundo.classList.add("on"); });

            naoBtn.focus();          // começa no botão seguro


            function fechar(valor){

                fundo.classList.remove("on");

                setTimeout(function(){ fundo.remove(); }, 200);

                document.removeEventListener("keydown", tecla);

                if(focoAnterior && focoAnterior.focus) focoAnterior.focus();

                responder(valor);

            }


            function tecla(e){ if(e.key === "Escape") fechar(false); }


            document.addEventListener("keydown", tecla);

            naoBtn.onclick = function(){ fechar(false); };

            simBtn.onclick = function(){ fechar(true); };

            fundo.onclick  = function(e){ if(e.target === fundo) fechar(false); };

        });

    }



    /* =================================================
       INTERCEPTA O CLIQUE EM SAIR

       Roda na fase de captura, ou seja, ANTES do
       listener que cada página registra no #btnSair.
    ================================================= */

    document.addEventListener("click", async function(evento){

        const botao = evento.target.closest("#btnSair, .btnSair, [data-sair]");

        if(!botao) return;


        evento.preventDefault();

        evento.stopImmediatePropagation();      // segura o confirm() da página


        const querSair = await perguntar();

        if(!querSair) return;


        const destino = botao.getAttribute("href");

        const inicial = (destino && destino !== "#")
            ? destino
            : "../../Base/HTML/Abertura.html";


        if(typeof sair === "function"){

            // se o sair() do sessao.js também perguntar,
            // respondemos por ele: a pessoa já decidiu aqui
            const confirmOriginal = window.confirm;

            window.confirm = function(){ return true; };

            try { sair(inicial); }

            finally { window.confirm = confirmOriginal; }

        } else {

            window.location.href = inicial;

        }

    }, true);

})();