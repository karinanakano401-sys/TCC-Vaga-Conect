/* =====================================================
   VagaConnect · modal.js

   Troca as caixas cinzas do navegador (alert e confirm)
   por janelas no estilo do sistema.

   COMO USAR
   Em cada tela, ANTES dos outros scripts:

        <script src="../../Base/JS/modal.js"></script>

   O alert() que já existe nas telas passa a abrir a janela
   sozinho. O que mudou na prática:

   - alert("texto")        abre a janela e devolve uma Promise
                           que resolve quando a pessoa fecha.
                           Se depois do aviso a tela troca de
                           página, espere o fechamento:
                               await alert("...");
                               window.location.href = "...";
                           (fora de função async:
                               alert("...").then(() => { ... });)

   - await confirmar({ titulo, texto, sim, nao, tom })
                           substitui o confirm(). Devolve
                           true (sim) ou false (não/Esc/fora).
                           tom: "perigo" | "aviso" | "azul" | "sucesso"

   O tipo do aviso (sucesso, erro, atenção) é escolhido pelo
   texto da mensagem. Para escolher na mão:
                               alert("texto", { tom: "perigo", titulo: "Ops" })
===================================================== */

(function(){

    "use strict";

    if(window.__vcModal) return;

    window.__vcModal = true;


    /* =================================================
       ESTILO
    ================================================= */

    const css = document.createElement("style");

    css.textContent = `
    .vcm-fundo{
        position:fixed; inset:0; z-index:10050;
        display:grid; place-items:center; padding:20px;
        background:rgba(4,12,24,.72);
        backdrop-filter:blur(4px);
        opacity:0; transition:opacity .18s ease;
        font-family:'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .vcm-fundo.on{ opacity:1; }

    .vcm-modal{
        width:min(380px, 100%);
        max-height:calc(100vh - 40px);
        overflow-y:auto;
        padding:26px 22px 18px;
        border:1px solid rgba(126,178,232,.22);
        border-top:3px solid var(--c);
        border-radius:16px;
        background:
            linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,0) 130px),
            #0b2138;
        box-shadow:0 28px 60px rgba(0,0,0,.55);
        color:#e8f2ff;
        text-align:center;
        transform:translateY(12px) scale(.97);
        transition:transform .22s cubic-bezier(.2,.9,.3,1.25);
    }
    .vcm-fundo.on .vcm-modal{ transform:none; }

    .vcm-icone{
        width:54px; height:54px; margin:0 auto 14px;
        display:grid; place-items:center;
        border:1px solid var(--c);
        border-radius:50%;
        background:var(--f);
        color:var(--c);
    }
    .vcm-icone svg{ width:26px; height:26px; }

    .vcm-modal h3{
        margin:0 0 8px;
        font-size:16.5px; font-weight:600; line-height:1.3;
        color:inherit;
    }

    .vcm-modal p{
        margin:0 0 22px;
        color:#9db6d0;
        font-size:13px; line-height:1.55;
        white-space:pre-line;
        overflow-wrap:anywhere;
    }

    .vcm-botoes{
        display:grid; grid-template-columns:1fr; gap:9px;
    }
    .vcm-botoes.dois{ grid-template-columns:1fr 1fr; }

    .vcm-botoes button{
        min-height:44px;
        border:1px solid transparent;
        border-radius:11px;
        font-family:inherit; font-size:13.5px; font-weight:600;
        cursor:pointer;
        transition:background .18s, border-color .18s, color .18s, filter .18s;
    }

    .vcm-nao{
        border-color:rgba(126,178,232,.32);
        background:transparent;
        color:#dceaf8;
    }
    .vcm-nao:hover{ background:rgba(111,180,255,.12); }

    .vcm-sim{
        background:var(--c);
        color:#06182d;
    }
    .vcm-sim:hover{ filter:brightness(1.12); }

    .vcm-botoes button:focus-visible{
        outline:3px solid #6fb4ff; outline-offset:2px;
    }

    /* telas de painel (admin, funcionário e a área "técnica" do usuário):
       cantos retos e botões em fonte monoespaçada, igual à janela de "Sair" */
    .vcm-reto .vcm-modal{
        border-radius:0;
        border-top-width:2px;
        background:#071426;
        box-shadow:0 28px 60px rgba(0,0,0,.6);
        transform:translateY(10px);
        transition:transform .2s ease;
    }
    .vcm-reto .vcm-icone{ border-radius:0; }
    .vcm-reto .vcm-modal h3{ font-size:16px; }
    .vcm-reto .vcm-botoes button{
        position:relative; overflow:hidden; z-index:0;
        border-radius:4px;
        font-family:var(--vcm-mono);
        font-size:10.5px; letter-spacing:.14em; text-transform:uppercase;
        transition:color .2s, border-color .2s;
    }
    .vcm-reto .vcm-botoes button::before{
        content:""; position:absolute; inset:0; z-index:-1;
        transform:scaleX(0); transform-origin:left;
        transition:transform .26s cubic-bezier(.4,0,.2,1);
    }
    .vcm-reto .vcm-botoes button:hover::before{ transform:scaleX(1); }
    .vcm-reto .vcm-nao{ border-color:rgba(120,170,220,.34); background:transparent; }
    .vcm-reto .vcm-nao::before{ background:rgba(120,170,220,.18); }
    .vcm-reto .vcm-sim{ background:transparent; border-color:var(--c); color:var(--c); }
    .vcm-reto .vcm-sim::before{ background:var(--c); }
    .vcm-reto .vcm-sim:hover{ filter:none; color:#04121f; }

    /* modo claro */
    html[data-tema="claro"] .vcm-fundo{ background:rgba(20,40,70,.45); }
    html[data-tema="claro"] .vcm-modal{
        border-color:#cfdcec;
        border-top-color:var(--c);
        background:#ffffff;
        color:#0b2138;
        box-shadow:0 24px 54px rgba(20,40,70,.28);
    }
    html[data-tema="claro"] .vcm-modal p{ color:#4a6580; }
    html[data-tema="claro"] .vcm-nao{ border-color:#b7c9de; color:#17324f; }
    html[data-tema="claro"] .vcm-nao:hover{ background:#eef4fb; }
    html[data-tema="claro"] .vcm-reto .vcm-modal{ background:#ffffff; }
    html[data-tema="claro"] .vcm-reto .vcm-nao::before{ background:#e3edf8; }
    html[data-tema="claro"] .vcm-reto .vcm-nao:hover{ background:transparent; }

    @media (max-width:480px){
        .vcm-fundo{ padding:14px; place-items:end center; }
        .vcm-modal{ width:100%; }
    }

    @media (prefers-reduced-motion:reduce){
        .vcm-fundo,.vcm-modal,.vcm-botoes button{ transition:none; }
    }`;

    document.head.appendChild(css);


    /* =================================================
       TONS (cor + desenho)
    ================================================= */

    const desenhos = {

        sucesso: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',

        perigo:  '<path d="M12 7v6M12 17h.01"/>',

        aviso:   '<path d="M12 7v6M12 17h.01"/>',

        azul:    '<path d="M12 11v6M12 7h.01"/>',

        pergunta:'<path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01"/>'

    };

    const tons = {

        sucesso: { c:"#34d399", f:"rgba(52,211,153,.14)",  d:"sucesso",  t:"Tudo certo!" },

        perigo:  { c:"#f87171", f:"rgba(248,113,113,.14)", d:"perigo",   t:"Algo deu errado" },

        aviso:   { c:"#fbbf24", f:"rgba(251,191,36,.14)",  d:"aviso",    t:"Atenção" },

        azul:    { c:"#6fb4ff", f:"rgba(111,180,255,.14)", d:"azul",     t:"VagaConnect" }

    };


    function desenhar(chave){

        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${desenhos[chave]}</svg>`;

    }


    // Escolhe o tom pelo texto (as telas só mandam a frase)
    function tomDoTexto(texto){

        const t = String(texto);

        if(/n[ãa]o foi poss[ií]vel|erro|inv[áa]lid|falha|servidor|expirou|n[ãa]o tem acesso|n[ãa]o encontr|n[ãa]o confere|n[ãa]o coincidem/i.test(t)) return "perigo";

        if(/sucesso|realizad|conclu[ií]d|enviad|salv[oa]|atualizad|cadastrad|finalizad|exclu[ií]d|prorrogad|cancelad/i.test(t)) return "sucesso";

        return "aviso";

    }


    /* =================================================
       FILA (uma janela por vez, na ordem em que chegam)
    ================================================= */

    let fila = Promise.resolve();


    function abrir(op){

        const vez = fila.then(() => mostrar(op));

        // um erro numa janela nunca trava as próximas
        fila = vez.catch(() => {});

        return vez;

    }


    function mostrar(op){

        return new Promise(function(responder){

            const tom = tons[op.tom] || tons.aviso;

            const doisBotoes = !!op.pergunta;

            const fundo = document.createElement("div");

            fundo.className = "vcm-fundo";

            // As telas de painel definem a fonte --mono no CSS; as da reserva (arredondadas) não.
            // É isso que decide qual dos dois visuais a janela usa.
            const mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();

            if(mono){

                fundo.classList.add("vcm-reto");

                fundo.style.setProperty("--vcm-mono", mono);

            }

            fundo.style.setProperty("--c", tom.c);

            fundo.style.setProperty("--f", tom.f);

            fundo.innerHTML = `
                <div class="vcm-modal" role="${doisBotoes ? "dialog" : "alertdialog"}"
                     aria-modal="true" aria-labelledby="vcmTit" aria-describedby="vcmTxt">

                    <div class="vcm-icone" aria-hidden="true">${desenhar(op.pergunta ? "pergunta" : tom.d)}</div>

                    <h3 id="vcmTit"></h3>

                    <p id="vcmTxt"></p>

                    <div class="vcm-botoes ${doisBotoes ? "dois" : ""}">
                        ${doisBotoes ? '<button class="vcm-nao" type="button"></button>' : ""}
                        <button class="vcm-sim" type="button"></button>
                    </div>

                </div>`;

            fundo.querySelector("h3").textContent = op.titulo || tom.t;

            fundo.querySelector("p").textContent = op.texto || "";

            if(!op.texto) fundo.querySelector("p").style.display = "none";

            const simBtn = fundo.querySelector(".vcm-sim");

            const naoBtn = fundo.querySelector(".vcm-nao");

            simBtn.textContent = op.sim || (doisBotoes ? "Confirmar" : "Entendi");

            if(naoBtn) naoBtn.textContent = op.nao || "Voltar";

            const focoAnterior = document.activeElement;

            document.body.appendChild(fundo);

            requestAnimationFrame(function(){ fundo.classList.add("on"); });

            // pergunta: começa no botão seguro ("Voltar"); aviso: no único botão
            (naoBtn || simBtn).focus();

            let aberta = true;

            function fechar(valor){

                if(!aberta) return;

                aberta = false;

                fundo.classList.remove("on");

                setTimeout(function(){ fundo.remove(); }, 200);

                document.removeEventListener("keydown", tecla, true);

                if(focoAnterior && focoAnterior.focus){

                    try { focoAnterior.focus(); } catch(e) {}

                }

                responder(valor);

            }

            function tecla(e){

                if(e.key === "Escape"){

                    e.preventDefault();

                    e.stopPropagation();

                    fechar(false);

                    return;

                }

                // o foco fica preso dentro da janela
                if(e.key === "Tab"){

                    const botoes = [...fundo.querySelectorAll("button")];

                    const primeiro = botoes[0];

                    const ultimo = botoes[botoes.length - 1];

                    if(e.shiftKey && document.activeElement === primeiro){

                        e.preventDefault();

                        ultimo.focus();

                    } else if(!e.shiftKey && document.activeElement === ultimo){

                        e.preventDefault();

                        primeiro.focus();

                    } else if(!fundo.contains(document.activeElement)){

                        e.preventDefault();

                        primeiro.focus();

                    }

                }

            }

            document.addEventListener("keydown", tecla, true);

            simBtn.onclick = function(){ fechar(true); };

            if(naoBtn) naoBtn.onclick = function(){ fechar(false); };

            // clicar fora fecha: no aviso é só "entendi"; na pergunta vale "não"
            fundo.onclick = function(e){

                if(e.target === fundo) fechar(!doisBotoes);

            };

        });

    }


    /* =================================================
       O QUE AS TELAS USAM
    ================================================= */

    // alert("texto") ou alert("texto", { tom, titulo, botao })
    window.alert = function(mensagem, opcoes){

        opcoes = opcoes || {};

        const texto = mensagem === undefined || mensagem === null ? "" : String(mensagem);

        return abrir({
            tom:    opcoes.tom || tomDoTexto(texto),
            titulo: opcoes.titulo,
            texto:  texto,
            sim:    opcoes.botao
        }).then(function(){});

    };


    // await confirmar({ titulo, texto, sim, nao, tom }) -> true | false
    window.confirmar = function(op){

        op = op || {};

        return abrir({
            tom:      op.tom || "aviso",
            titulo:   op.titulo || "Tem certeza?",
            texto:    op.texto || "",
            sim:      op.sim,
            nao:      op.nao,
            pergunta: true
        });

    };

})();
