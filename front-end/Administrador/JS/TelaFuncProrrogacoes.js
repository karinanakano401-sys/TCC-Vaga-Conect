/* =====================================================
   VagaConnect · Prorrogações (funcionário)

   Lista os pedidos de mais tempo feitos pelos clientes
   e permite aprovar ou recusar.

   Aprovar = soma as horas pedidas na saída prevista da
   reserva (PUT /reservacli) e marca o pedido como
   "Aprovada".
===================================================== */


// =====================================================
// CONFIGURAÇÃO
// =====================================================


// O sessao.js já define API; se não definir, cai no padrão.
const api = (typeof API !== "undefined") ? API : "http://localhost:3333";


// Troque para "funcionario" se esta tela ficar na área do funcionário.
const PERFIL = "admin";


const funcionario = (typeof exigirLogin === "function")
    ? exigirLogin(PERFIL, "../../Base/HTML/OpçãoLogin.html")
    : JSON.parse(localStorage.getItem("funcionarioLogado") || "null");


if(!funcionario){

    // exigirLogin já redirecionou
    throw new Error("sem sessão");

}



// Enquanto o back não tiver a tabela de prorrogação, a tela
// funciona lendo os pedidos do localStorage do navegador.
let modoLocal = false;


let pedidos   = [];   // pedidos de prorrogação
let reservas  = [];   // reservacli, para cruzar os dados



// =====================================================
// ELEMENTOS
// =====================================================


const linhas         = document.getElementById("linhas");

const contagem       = document.getElementById("contagem");

const filtroStatus   = document.getElementById("filtroStatus");

const busca          = document.getElementById("busca");

const btnAtualizar   = document.getElementById("btnAtualizar");

const menuButton     = document.getElementById("menuButton");

const sidebar        = document.getElementById("sidebar");


const totalPendentes = document.getElementById("totalPendentes");

const totalAprovadas = document.getElementById("totalAprovadas");

const totalRecusadas = document.getElementById("totalRecusadas");

const totalHoras     = document.getElementById("totalHoras");



// =====================================================
// PERFIL NA SIDEBAR
// =====================================================


(function mostrarPerfil(){

    const nome = funcionario.nome || "Funcionário";

    document.getElementById("nomeFuncionario").textContent = nome;

    document.getElementById("inicialFuncionario").textContent = nome.charAt(0).toUpperCase();

    document.getElementById("cargoFuncionario").textContent = funcionario.cargo || PERFIL;

})();



// =====================================================
// AJUDANTES
// =====================================================


function mostrarDataHora(texto){

    if(!texto) return "--";

    const data = new Date(texto);

    if(isNaN(data)) return "--";

    const dia    = String(data.getDate()).padStart(2, "0");

    const mes    = String(data.getMonth() + 1).padStart(2, "0");

    const hora   = String(data.getHours()).padStart(2, "0");

    const minuto = String(data.getMinutes()).padStart(2, "0");

    return `${dia}/${mes} ${hora}:${minuto}`;

}


function somarHoras(texto, horas){

    const data = new Date(texto);

    data.setHours(data.getHours() + Number(horas || 0));

    return data;

}


function ehHoje(texto){

    const data = new Date(texto);

    const hoje = new Date();

    return data.toDateString() === hoje.toDateString();

}


function reservaDoPedido(pedido){

    return reservas.find(item => item.id === pedido.fk_reservacli) || null;

}



// =====================================================
// CARREGAR OS DADOS
// =====================================================


async function carregarReservas(){

    const resposta = await fetch(api + "/reservacli");

    const lista = await resposta.json();

    if(!resposta.ok) throw new Error(lista.erro || "Erro ao carregar as reservas");

    // funcionário vê só o pátio dele; admin vê todos
    reservas = funcionario.fk_est
        ? lista.filter(item => item.reserva?.vaga?.fk_est === funcionario.fk_est)
        : lista;

}


async function carregarPedidos(){

    try {

        const resposta = await fetch(api + "/prorrogacao");

        if(!resposta.ok) throw new Error("sem endpoint");

        pedidos = await resposta.json();

        modoLocal = false;

    } catch (error) {

        // o back ainda não tem a rota: usa o armazenamento local
        modoLocal = true;

        pedidos = JSON.parse(localStorage.getItem("prorrogacoes") || "[]");

    }

    // mantém só os pedidos das reservas deste pátio, mais novos primeiro
    pedidos = pedidos
        .filter(pedido => reservaDoPedido(pedido))
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

}


async function carregar(){

    btnAtualizar.classList.add("girando");

    try {

        await carregarReservas();

        await carregarPedidos();

        render();

    } catch (error) {

        linhas.innerHTML = `<tr><td colspan="8" class="vazio">
            ${error.message || "Não foi possível carregar. Verifique se o servidor está ligado."}
        </td></tr>`;

        contagem.textContent = "Erro ao carregar";

    } finally {

        btnAtualizar.classList.remove("girando");

    }

}



// =====================================================
// SALVAR A DECISÃO
// =====================================================


async function salvarStatus(pedido, status, horasLiberadas){

    if(modoLocal){

        const todos = JSON.parse(localStorage.getItem("prorrogacoes") || "[]");

        const alvo = todos.find(item => item.id === pedido.id);

        if(alvo){

            alvo.status         = status;

            alvo.respondido     = new Date().toISOString();

            alvo.horasLiberadas = horasLiberadas || null;

        }

        localStorage.setItem("prorrogacoes", JSON.stringify(todos));

        return;

    }


    const resposta = await fetch(api + "/prorrogacao/" + pedido.id, {

        method: "PUT",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

            horas:          pedido.horas,

            horasLiberadas: horasLiberadas || null,

            motivo:         pedido.motivo || "",

            status:         status,

            fk_reservacli:  pedido.fk_reservacli

        })

    });


    const retorno = await resposta.json();

    if(!resposta.ok) throw new Error(retorno.erro || "Erro ao atualizar o pedido");

}


// Soma as horas na saída prevista da reserva
async function estenderReserva(reserva, horas){

    const novaSaida = somarHoras(reserva.horaSaida || reserva.hora, horas);


    const resposta = await fetch(api + "/reservacli/" + reserva.id, {

        method: "PUT",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

            data:         reserva.data,

            hora:         reserva.hora,

            horaSaida:    novaSaida.toISOString(),

            fk_idCliente: reserva.fk_idCliente,

            fk_idReserva: reserva.fk_idReserva,

            fk_idCarro:   reserva.fk_idCarro

        })

    });


    const retorno = await resposta.json();

    if(!resposta.ok) throw new Error(retorno.erro || "Erro ao estender a reserva");

}



// =====================================================
// AÇÕES
// =====================================================


async function aprovar(id){

    const pedido  = pedidos.find(item => item.id === id);

    const reserva = reservaDoPedido(pedido);

    if(!pedido || !reserva) return;


    // o funcionário escolhe quanto tempo vai liberar
    const horas = await escolherHoras(pedido, reserva);

    if(!horas) return;


    const nova = somarHoras(reserva.horaSaida || reserva.hora, horas);


    try {

        await estenderReserva(reserva, horas);

        await salvarStatus(pedido, "Aprovada", horas);

        aviso(

            "sucesso",

            horas === Number(pedido.horas) ? "Prorrogação aprovada" : "Aprovada com ajuste",

            `Liberadas ${horas}h. Nova saída: ${mostrarDataHora(nova)}.`

        );

        await carregar();

    } catch (error) {

        aviso("erro", "Não deu para aprovar", error.message);

    }

}


async function recusar(id){

    const pedido  = pedidos.find(item => item.id === id);

    const reserva = reservaDoPedido(pedido);

    if(!pedido || !reserva) return;


    const ok = await confirmar({

        tom:     "perigo",

        titulo:  "Recusar este pedido?",

        texto:   `O cliente continua com a saída marcada para ${mostrarDataHora(reserva.horaSaida)}.`,

        nao:     "Voltar",

        sim:     "Recusar"

    });


    if(!ok) return;


    try {

        await salvarStatus(pedido, "Recusada");

        aviso("aviso", "Pedido recusado", "O cliente será avisado na tela de reservas.");

        await carregar();

    } catch (error) {

        aviso("erro", "Não deu para recusar", error.message);

    }

}


window.aprovar = aprovar;

window.recusar = recusar;



// =====================================================
// DESENHAR A TABELA
// =====================================================


function render(){

    const status = filtroStatus.value;

    const texto  = busca.value.trim().toLowerCase();


    const filtrados = pedidos.filter(pedido => {

        const reserva = reservaDoPedido(pedido);

        const procura = `
            ${reserva.usuario?.nome || ""}
            ${reserva.reserva.vaga.numero}
            ${reserva.carro?.placacarro || ""}
        `.toLowerCase();

        return (!status || pedido.status === status) && procura.includes(texto);

    });


    atualizarResumo();


    if(filtrados.length === 0){

        linhas.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum pedido por aqui</td></tr>`;

        contagem.textContent = "0 pedidos";

        return;

    }


    linhas.innerHTML = filtrados.map(pedido => {

        const reserva = reservaDoPedido(pedido);

        const vaga    = reserva.reserva.vaga;

        const nova    = somarHoras(reserva.horaSaida || reserva.hora, pedido.horas);

        const aberto  = pedido.status === "Pendente";


        return `
        <tr>

            <td class="quando">${mostrarDataHora(pedido.criadoEm)}</td>

            <td class="cliente">
                <strong>${reserva.usuario?.nome || "Cliente"}</strong>
                <small>${reserva.carro ? reserva.carro.placacarro : "sem veículo"}</small>
            </td>

            <td class="vaga"><b>${vaga.numero}</b></td>

            <td class="hora">${mostrarDataHora(reserva.horaSaida)}</td>

            <td>
                <span class="pedido">+${pedido.horas}h</span>
                ${pedido.horasLiberadas && Number(pedido.horasLiberadas) !== Number(pedido.horas)
                    ? `<span class="liberado">liberado ${pedido.horasLiberadas}h</span>` : ""}
                ${pedido.motivo ? `<span class="motivo">${pedido.motivo}</span>` : ""}
            </td>

            <td class="nova-saida">${aberto ? mostrarDataHora(nova) : "--"}</td>

            <td><span class="status ${pedido.status.toLowerCase()}">${pedido.status}</span></td>

            <td class="row-actions">
                ${aberto ? `
                    <button class="aprovar" onclick="aprovar('${pedido.id}')">Aprovar</button>
                    <button class="recusar" onclick="recusar('${pedido.id}')">Recusar</button>
                ` : `<span class="sem-acao">respondido</span>`}
            </td>

        </tr>`;

    }).join("");


    contagem.textContent = `${filtrados.length} de ${pedidos.length} pedidos`
        + (modoLocal ? " · modo local" : "");

}


function atualizarResumo(){

    const pendentes = pedidos.filter(p => p.status === "Pendente");

    totalPendentes.textContent = pendentes.length;

    totalAprovadas.textContent = pedidos.filter(p => p.status === "Aprovada" && ehHoje(p.respondido)).length;

    totalRecusadas.textContent = pedidos.filter(p => p.status === "Recusada" && ehHoje(p.respondido)).length;

    totalHoras.textContent = pendentes.reduce((soma, p) => soma + Number(p.horas || 0), 0) + "h";

}



// =====================================================
// EVENTOS
// =====================================================


filtroStatus.addEventListener("change", render);

busca.addEventListener("input", render);

btnAtualizar.addEventListener("click", carregar);


if(menuButton){

    menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));

    document.addEventListener("click", (evento) => {

        if(window.innerWidth <= 850

            && !sidebar.contains(evento.target)

            && !evento.target.closest("#menuButton")){

            sidebar.classList.remove("open");

        }

    });

}


document.getElementById("btnSair").addEventListener("click", async (evento) => {

    evento.preventDefault();

    const ok = await confirmar({

        tom:    "azul",

        titulo: "Sair da sua conta?",

        texto:  "Você volta para a tela inicial do VagaConnect.",

        nao:    "Ficar",

        sim:    "Sair"

    });

    if(ok){

        if(typeof sair === "function") sair("../../Base/HTML/Abertura.html");

        else window.location.href = "../../Base/HTML/Abertura.html";

    }

});



// atualiza sozinho a cada 30 segundos
setInterval(carregar, 30000);


carregar();




/* =====================================================
   JANELA DE CONFIRMAÇÃO E AVISOS
   (mesmo visual das outras telas)
===================================================== */

function estilosDaJanela(){

    const css = document.createElement("style");

    css.textContent = `
    .vc-fundo{
        position:fixed; inset:0; z-index:10000;
        display:grid; place-items:center; padding:20px;
        background:rgba(3,11,22,.74); backdrop-filter:blur(4px);
        opacity:0; transition:opacity .18s ease;
        font-family:'Poppins',sans-serif;
    }
    .vc-fundo.on{ opacity:1; }
    .vc-modal{
        width:min(360px,100%); padding:22px;
        border:1px solid rgba(120,170,220,.2);
        border-top:2px solid var(--c);
        background:#071426;
        box-shadow:0 28px 60px rgba(0,0,0,.6);
        color:#e9f2fc; text-align:center;
        transform:translateY(10px); transition:transform .2s ease;
    }
    .vc-fundo.on .vc-modal{ transform:none; }
    .vc-modal h3{ font-size:16px; font-weight:600; margin:0 0 6px; }
    .vc-modal p{ color:#93aec9; font-size:12.5px; line-height:1.55; margin:0 0 18px; }
    .vc-botoes{ display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    .vc-botoes button{
        height:42px; border-radius:4px; border:1px solid transparent;
        font-family:ui-monospace,'Consolas',monospace; font-size:10.5px; font-weight:600;
        letter-spacing:.14em; text-transform:uppercase; cursor:pointer;
        transition:background .18s, border-color .18s, color .18s;
    }
    .vc-nao{ border-color:rgba(120,170,220,.34); background:transparent; color:#dceaf8; }
    .vc-nao:hover{ background:rgba(120,170,220,.12); }
    .vc-sim{ border-color:var(--c); background:transparent; color:var(--c); }
    .vc-sim:hover{ background:var(--c); color:#04121f; }
    .vc-botoes button:focus-visible{ outline:2px solid #8cc2ff; outline-offset:2px; }

    .vc-avisos{
        position:fixed; top:18px; right:18px; z-index:10001;
        display:flex; flex-direction:column; gap:9px;
        width:min(320px, calc(100vw - 36px)); pointer-events:none;
    }
    .vc-aviso{
        position:relative; padding:12px 14px;
        border:1px solid rgba(120,170,220,.2);
        border-left:2px solid var(--c);
        background:#071426; box-shadow:0 18px 40px rgba(0,0,0,.5);
        color:#e9f2fc; font-family:'Poppins',sans-serif;
        pointer-events:auto; cursor:pointer;
        opacity:0; transform:translateX(14px);
        transition:opacity .2s, transform .2s;
    }
    .vc-aviso.on{ opacity:1; transform:none; }
    .vc-aviso b{
        display:block; margin-bottom:3px; color:var(--c);
        font-family:ui-monospace,'Consolas',monospace; font-size:9.5px;
        letter-spacing:.14em; text-transform:uppercase;
    }
    .vc-aviso span{ display:block; color:#cfe0f2; font-size:12.5px; line-height:1.45; }
    .vc-horas{
        display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:14px;
    }
    .vc-hora{
        position:relative; height:44px;
        border:1px solid rgba(120,170,220,.28); border-radius:4px;
        background:transparent; color:#93aec9;
        font-family:ui-monospace,'Consolas',monospace; font-size:13px; font-weight:600;
        cursor:pointer; transition:border-color .18s, background .18s, color .18s;
    }
    .vc-hora:hover{ border-color:#8cc2ff; color:#fff; }
    .vc-hora.escolhida{ border-color:#2f7dff; background:rgba(47,125,255,.18); color:#fff; }
    .vc-hora:focus-visible{ outline:2px solid #8cc2ff; outline-offset:2px; }
    .vc-hora small{
        position:absolute; top:-7px; left:50%; transform:translateX(-50%);
        padding:1px 6px; border:1px solid rgba(245,183,49,.5);
        background:#0a1d33; color:#f5b731; font-size:8px; font-weight:500;
        letter-spacing:.12em; text-transform:uppercase; white-space:nowrap;
    }
    .vc-previa{
        margin-bottom:18px; padding:10px;
        border-top:1px solid rgba(120,170,220,.16);
        border-bottom:1px solid rgba(120,170,220,.16);
        color:#93aec9; font-family:ui-monospace,'Consolas',monospace;
        font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    }
    .vc-previa b{ color:#3ddc97; font-weight:600; }
    .liberado{
        display:block; margin-top:3px; color:#3ddc97;
        font-family:ui-monospace,'Consolas',monospace; font-size:9.5px;
        letter-spacing:.06em; text-transform:uppercase;
    }
    @media (max-width:400px){ .vc-horas{ grid-template-columns:repeat(2,1fr); } }

    @media (prefers-reduced-motion:reduce){
        .vc-fundo,.vc-modal,.vc-aviso{ transition:none; }
    }
    @media (max-width:600px){
        .vc-avisos{ top:auto; bottom:14px; left:14px; right:14px; width:auto; }
    }`;

    document.head.appendChild(css);

}


estilosDaJanela();


const cores = {
    sucesso: "#3ddc97",
    aviso:   "#f5b731",
    erro:    "#ff7a7a",
    perigo:  "#ff7a7a",
    azul:    "#8cc2ff"
};


const caixaAvisos = document.createElement("div");

caixaAvisos.className = "vc-avisos";

caixaAvisos.setAttribute("role", "status");

caixaAvisos.setAttribute("aria-live", "polite");

document.body.appendChild(caixaAvisos);


function aviso(tom, titulo, texto){

    const el = document.createElement("div");

    el.className = "vc-aviso";

    el.style.setProperty("--c", cores[tom] || cores.azul);

    el.innerHTML = "<b></b><span></span>";

    el.querySelector("b").textContent = titulo;

    el.querySelector("span").textContent = texto || "";


    function fechar(){

        el.classList.remove("on");

        setTimeout(() => el.remove(), 220);

    }

    el.onclick = fechar;

    caixaAvisos.appendChild(el);

    requestAnimationFrame(() => el.classList.add("on"));

    setTimeout(fechar, tom === "erro" ? 6000 : 4200);

    while(caixaAvisos.children.length > 3) caixaAvisos.firstElementChild.remove();

}


function confirmar(op){

    return new Promise(function(responder){

        const fundo = document.createElement("div");

        fundo.className = "vc-fundo";

        fundo.style.setProperty("--c", cores[op.tom] || cores.azul);

        fundo.innerHTML = `
            <div class="vc-modal" role="dialog" aria-modal="true" aria-labelledby="vcTit">
                <h3 id="vcTit"></h3>
                <p></p>
                <div class="vc-botoes">
                    <button class="vc-nao" type="button"></button>
                    <button class="vc-sim" type="button"></button>
                </div>
            </div>`;

        fundo.querySelector("h3").textContent = op.titulo || "Tem certeza?";

        fundo.querySelector("p").textContent  = op.texto  || "";

        const naoBtn = fundo.querySelector(".vc-nao");

        const simBtn = fundo.querySelector(".vc-sim");

        naoBtn.textContent = op.nao || "Voltar";

        simBtn.textContent = op.sim || "Confirmar";


        const focoAnterior = document.activeElement;

        document.body.appendChild(fundo);

        requestAnimationFrame(() => fundo.classList.add("on"));

        naoBtn.focus();


        function fechar(valor){

            fundo.classList.remove("on");

            setTimeout(() => fundo.remove(), 200);

            document.removeEventListener("keydown", tecla);

            if(focoAnterior && focoAnterior.focus) focoAnterior.focus();

            responder(valor);

        }

        function tecla(e){ if(e.key === "Escape") fechar(false); }

        document.addEventListener("keydown", tecla);

        naoBtn.onclick = () => fechar(false);

        simBtn.onclick = () => fechar(true);

        fundo.onclick  = (e) => { if(e.target === fundo) fechar(false); };

    });

}


/* =====================================================
   ESCOLHA DO TEMPO A LIBERAR
   Devolve o número de horas ou null se cancelar.
===================================================== */

function escolherHoras(pedido, reserva){

    return new Promise(function(responder){

        const opcoes = [1, 2, 3, 4, 5, 6];

        let escolhida = Number(pedido.horas) || 1;


        const fundo = document.createElement("div");

        fundo.className = "vc-fundo";

        fundo.style.setProperty("--c", "#8cc2ff");

        fundo.innerHTML = `
            <div class="vc-modal" role="dialog" aria-modal="true" aria-labelledby="vcTit">

                <h3 id="vcTit">Quanto tempo liberar?</h3>

                <p>
                    Vaga ${reserva.reserva.vaga.numero} ·
                    ${reserva.usuario?.nome || "Cliente"} pediu ${pedido.horas}h.
                    Você pode liberar mais ou menos que isso.
                </p>

                <div class="vc-horas"></div>

                <div class="vc-previa">Nova saída: <b class="vc-nova"></b></div>

                <div class="vc-botoes">
                    <button class="vc-nao" type="button">Voltar</button>
                    <button class="vc-sim" type="button">Liberar</button>
                </div>

            </div>`;


        const caixaHoras = fundo.querySelector(".vc-horas");

        const novaSaida  = fundo.querySelector(".vc-nova");

        const simBtn     = fundo.querySelector(".vc-sim");

        const naoBtn     = fundo.querySelector(".vc-nao");


        opcoes.forEach(function(hora){

            const botao = document.createElement("button");

            botao.type = "button";

            botao.className = "vc-hora" + (hora === escolhida ? " escolhida" : "");

            botao.innerHTML = `${hora}h${hora === Number(pedido.horas) ? "<small>pedido</small>" : ""}`;

            botao.setAttribute("aria-pressed", hora === escolhida ? "true" : "false");


            botao.onclick = function(){

                escolhida = hora;

                caixaHoras.querySelectorAll(".vc-hora").forEach(function(b){

                    b.classList.remove("escolhida");

                    b.setAttribute("aria-pressed", "false");

                });

                botao.classList.add("escolhida");

                botao.setAttribute("aria-pressed", "true");

                atualizarPrevia();

            };


            caixaHoras.appendChild(botao);

        });


        function atualizarPrevia(){

            const nova = somarHoras(reserva.horaSaida || reserva.hora, escolhida);

            novaSaida.textContent = mostrarDataHora(nova);

            simBtn.textContent = `Liberar ${escolhida}h`;

        }


        atualizarPrevia();


        const focoAnterior = document.activeElement;

        document.body.appendChild(fundo);

        requestAnimationFrame(function(){ fundo.classList.add("on"); });

        naoBtn.focus();


        function fechar(valor){

            fundo.classList.remove("on");

            setTimeout(function(){ fundo.remove(); }, 200);

            document.removeEventListener("keydown", tecla);

            if(focoAnterior && focoAnterior.focus) focoAnterior.focus();

            responder(valor);

        }


        function tecla(e){

            if(e.key === "Escape") fechar(null);

            if(e.key === "ArrowRight" || e.key === "ArrowLeft"){

                const passo = e.key === "ArrowRight" ? 1 : -1;

                const indice = opcoes.indexOf(escolhida) + passo;

                if(indice >= 0 && indice < opcoes.length){

                    caixaHoras.querySelectorAll(".vc-hora")[indice].click();

                }

            }

        }


        document.addEventListener("keydown", tecla);

        naoBtn.onclick = function(){ fechar(null); };

        simBtn.onclick = function(){ fechar(escolhida); };

        fundo.onclick  = function(e){ if(e.target === fundo) fechar(null); };

    });

}