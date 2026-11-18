/* =====================================================
   VagaConnect · avatar.js

   Personagens (avatares) dos usuários, desenhados em SVG.
   Usado pela tela de escolha (Usuario/TelaUsuario.html) e
   por qualquer tela que mostre um usuário.

   O banco guarda só o código do personagem ("f3", "m7"),
   no campo Usuario.avatar. O avatar é OPCIONAL: sem código,
   nulo ou inválido, aparece um círculo com as iniciais.

   COMO USAR
   <link rel="stylesheet" href="../../Base/CSS/avatar.css">
   <script src="../../Base/JS/avatar.js"></script>

   Avatar.tag(usuario)        -> <span class="av">…</span>
   Avatar.tag(usuario, "p")   -> menor ("p"), "g" -> maior
   `usuario` é o objeto vindo da API ({ nome, avatar }).
   Funciona com usuario nulo ou sem avatar.
===================================================== */

(function (global) {

    "use strict";


    const VALIDO = /^[fm](10|[1-9])$/;


    // ---------- dados dos personagens ----------
    // estilo:  cabelo      (veja a função cabelo)
    // vest:    roupa       (camiseta, moletom, jaqueta, blazer, gola, regata, esporte)
    // deco:    fundo       (circulo, listras, pontos, anel, brilhos)
    // extra:   acessórios  (fone, fonepescoco, oculosr, oculosq, solar, brincos,
    //                       faixa, sardas, barba, bigode)

    const GRUPOS = {

        f: [
            { nome: "",   fundo: "#3b82f6", deco: "circulo", pele: "#f6d3b8", cabelo: "#6d28d9", estilo: "longo",
              vest: "moletom",  roupa: "#111827", detalhe: "#f472b6", extra: ["fone"],            boca: "sorriso", batom: "#c4546a" },

            { nome: "", fundo: "#10b981", deco: "listras", pele: "#e8b48a", cabelo: "#c2410c", estilo: "rabo",
              vest: "jaqueta",  roupa: "#111827", detalhe: "#f97316", extra: ["sardas", "brincos"], boca: "aberto" },

            { nome: "",  fundo: "#f59e0b", deco: "pontos",  pele: "#ffdbb4", cabelo: "#f1dc8a", estilo: "bob",
              vest: "camiseta", roupa: "#2563eb", detalhe: "#ffffff", extra: ["oculosr"],         boca: "sorriso", batom: "#d4607a" },

            { nome: "",    fundo: "#8b5cf6", deco: "anel",    pele: "#8d5524", cabelo: "#1f1a17", estilo: "cacheado",
              vest: "regata",   roupa: "#fb7185", detalhe: "#ffffff", extra: ["brincos"],         boca: "aberto",  batom: "#9f1239" },

            { nome: "",   fundo: "#ec4899", deco: "brilhos", pele: "#c68642", cabelo: "#3b2314", estilo: "trancas",
              vest: "esporte",  roupa: "#f8fafc", detalhe: "#2563eb", extra: [],                  boca: "lado" },

            { nome: "",   fundo: "#14b8a6", deco: "circulo", pele: "#f6d3b8", cabelo: "#ec4899", estilo: "doiscoques",
              vest: "gola",     roupa: "#1e293b", detalhe: "#fde047", extra: ["oculosq"],         boca: "sorriso" },

            { nome: "",   fundo: "#f97316", deco: "listras", pele: "#5c3a21", cabelo: "#0f0f0f", estilo: "coque",
              vest: "blazer",   roupa: "#1e1b4b", detalhe: "#fbbf24", extra: ["brincos"],         boca: "sorriso", batom: "#be123c" },

            { nome: "",  fundo: "#38bdf8", deco: "pontos",  pele: "#e8b48a", cabelo: "#78350f", estilo: "franja",
              vest: "camiseta", roupa: "#10b981", detalhe: "#ffffff", extra: [],                  boca: "aberto",  olhos: "pisca" },

            { nome: "",   fundo: "#84cc16", deco: "anel",    pele: "#ffdbb4", cabelo: "#0ea5e9", estilo: "curto",
              vest: "jaqueta",  roupa: "#111827", detalhe: "#38bdf8", extra: ["brincos"],         boca: "lado" },

            { nome: "",   fundo: "#f472b6", deco: "brilhos", pele: "#c68642", cabelo: "#111827", estilo: "afro",
              vest: "moletom",  roupa: "#7c3aed", detalhe: "#ffffff", extra: ["solar"],           boca: "sorriso", batom: "#9f1239" }
        ],

        m: [
            { nome: "",    fundo: "#2563eb", deco: "circulo", pele: "#f6d3b8", cabelo: "#3b2314", estilo: "curto",
              vest: "camiseta", roupa: "#f8fafc", detalhe: "#2563eb", extra: [],                  boca: "sorriso" },

            { nome: "",   fundo: "#10b981", deco: "listras", pele: "#e8b48a", cabelo: "#1a1a1a", estilo: "topete",
              vest: "jaqueta",  roupa: "#f59e0b", detalhe: "#1f2937", extra: ["oculosq"],         boca: "aberto",  interno: "#111827" },

            { nome: "",   fundo: "#f97316", deco: "pontos",  pele: "#8d5524", cabelo: "#0f0f0f", estilo: "afro",
              vest: "esporte",  roupa: "#1d4ed8", detalhe: "#fde047", extra: ["fonepescoco"],     boca: "aberto" },

            { nome: "",   fundo: "#7c3aed", deco: "anel",    pele: "#ffdbb4", cabelo: "#b45309", estilo: "social",
              vest: "blazer",   roupa: "#1f2937", detalhe: "#ef4444", extra: ["barba"],           boca: "sorriso" },

            { nome: "",   fundo: "#ef4444", deco: "listras", pele: "#c68642", cabelo: "#1a1a1a", estilo: "bone",
              vest: "moletom",  roupa: "#111827", detalhe: "#ffffff", extra: [],                  boca: "lado",    chapeu: "#fbbf24" },

            { nome: "",   fundo: "#0d9488", deco: "brilhos", pele: "#5c3a21", cabelo: "#0f0f0f", estilo: "careca",
              vest: "gola",     roupa: "#f97316", detalhe: "#ffffff", extra: ["barba", "oculosr"], boca: "sorriso" },

            { nome: "",   fundo: "#38bdf8", deco: "circulo", pele: "#f6d3b8", cabelo: "#e9c46a", estilo: "topete",
              vest: "regata",   roupa: "#10b981", detalhe: "#ffffff", extra: ["sardas"],          boca: "aberto",  olhos: "feliz" },

            { nome: "",  fundo: "#fbbf24", deco: "pontos",  pele: "#e8b48a", cabelo: "#3b2314", estilo: "social",
              vest: "jaqueta",  roupa: "#3b82f6", detalhe: "#1e3a8a", extra: ["solar"],           boca: "lado",    interno: "#f8fafc" },

            { nome: "",   fundo: "#ec4899", deco: "anel",    pele: "#8d5524", cabelo: "#1a1a1a", estilo: "crespo",
              vest: "moletom",  roupa: "#fde047", detalhe: "#111827", extra: ["fone"],            boca: "sorriso" },

            { nome: "",  fundo: "#65a30d", deco: "listras", pele: "#ffdbb4", cabelo: "#6b7280", estilo: "gorro",
              vest: "camiseta", roupa: "#0ea5e9", detalhe: "#ffffff", extra: ["barba"],           boca: "sorriso", chapeu: "#ef4444" }
        ]

    };


    // "f3" -> terceira mulher; "m7" -> sétimo homem
    function buscar(id) {

        if (typeof id !== "string") return null;

        const grupo = GRUPOS[id.charAt(0)];

        const posicao = parseInt(id.slice(1), 10) - 1;

        if (!grupo || !grupo[posicao]) return null;

        return Object.assign({ id: id, genero: id.charAt(0) }, grupo[posicao]);

    }


    // ---------- ferramentas de cor ----------

    function hexParaRgb(h) {

        const n = parseInt(h.slice(1), 16);

        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];

    }

    function misturar(h, alvo, f) {

        return "#" + hexParaRgb(h).map(function (v) {

            return Math.round(v + (alvo - v) * f).toString(16).padStart(2, "0");

        }).join("");

    }

    function escurecer(h, f) { return misturar(h, 0, f); }

    function clarear(h, f) { return misturar(h, 255, f); }


    // ---------- partes do desenho ----------

    const TINTA = "#1b2a3a";

    // franja lateral: base de quase todos os penteados
    const CAP = "M31.5 46 C29 28 40 20 50 20 C60 20 71 28 68.5 46 C66 38 62 33 56 31 C50 36 40 36 34 40 C33 42 32 44 31.5 46 Z";

    const BRILHO_CABELO = '<path d="M40 24 C46 21 55 21 61 25" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2.2" stroke-linecap="round"/>';

    let sequencia = 0;


    function brilho(x, y, r, o) {

        return '<path d="M' + x + " " + (y - r) +
            " Q" + x + " " + y + " " + (x + r) + " " + y +
            " Q" + x + " " + y + " " + x + " " + (y + r) +
            " Q" + x + " " + y + " " + (x - r) + " " + y +
            " Q" + x + " " + y + " " + x + " " + (y - r) +
            'Z" fill="rgba(255,255,255,' + o + ')"/>';

    }


    // fundo em degradê com um detalhe gráfico
    function fundoArte(p, id) {

        const f2 = escurecer(p.fundo, 0.38);

        let deco = "";

        switch (p.deco) {

            case "circulo":
                deco = '<circle cx="50" cy="44" r="40" fill="rgba(255,255,255,.14)"/>' +
                       '<circle cx="50" cy="44" r="27" fill="rgba(255,255,255,.1)"/>';
                break;

            case "listras":
                deco = '<path d="M-10 62 L62 -10 L78 -10 L-10 78 Z M22 110 L110 22 L110 38 L38 110 Z" fill="rgba(255,255,255,.12)"/>';
                break;

            case "pontos": {
                let pontos = "";
                for (let x = 10; x <= 90; x += 16) {
                    for (let y = 10; y <= 90; y += 16) {
                        pontos += '<circle cx="' + x + '" cy="' + y + '" r="1.6"/>';
                    }
                }
                deco = '<g fill="rgba(255,255,255,.22)">' + pontos + "</g>";
                break;
            }

            case "anel":
                deco = '<circle cx="50" cy="44" r="36" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>' +
                       '<circle cx="50" cy="44" r="46" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="2"/>';
                break;

            case "brilhos":
                deco = brilho(17, 24, 6, 0.5) + brilho(85, 30, 4.5, 0.4) +
                       brilho(82, 76, 5, 0.35) + brilho(15, 74, 3.5, 0.3);
                break;

        }

        return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + p.fundo + '"/>' +
            '<stop offset="1" stop-color="' + f2 + '"/></linearGradient></defs>' +
            '<rect width="100" height="100" fill="url(#' + id + ')"/>' + deco;

    }


    // cabelo: "atras" fica atrás da cabeça, "frente" na testa, "lados" por cima do corpo
    function cabelo(estilo, c, cs, acc) {

        let atras = "", frente = "", lados = "";

        const capa = '<path d="' + CAP + '" fill="' + c + '"/>' + BRILHO_CABELO;

        const longoAtras = '<path d="M28 46 C24 22 40 16 50 16 C60 16 76 22 72 46 L79 92 L21 92 Z" fill="' + cs + '"/>';

        const longoLados =
            '<path d="M33 48 C27 60 26 76 29 90 C35 85 37 72 36.5 58 Z" fill="' + c + '"/>' +
            '<path d="M67 48 C73 60 74 76 71 90 C65 85 63 72 63.5 58 Z" fill="' + c + '"/>';

        function tranca(x) {

            let s = "";

            [64, 71, 78, 85, 92].forEach(function (y) {

                s += '<circle cx="' + x + '" cy="' + y + '" r="4.4" fill="' + c + '" stroke="' + cs + '" stroke-width="1"/>';

            });

            return s + '<circle cx="' + x + '" cy="97.5" r="2.2" fill="' + acc + '"/>';

        }

        switch (estilo) {

            case "longo":
                atras = longoAtras; frente = capa; lados = longoLados;
                break;

            case "franja":
                atras = longoAtras; lados = longoLados;
                frente = '<path d="M31 46 C28 26 40 19 50 19 C60 19 72 26 69 46 L67.5 35 C58 38 42 38 32.5 35 Z" fill="' + c + '"/>' + BRILHO_CABELO;
                break;

            case "bob":
                atras = '<path d="M29 46 C26 22 42 16 50 16 C58 16 74 22 71 46 L72.5 70 Q50 78 27.5 70 Z" fill="' + cs + '"/>';
                frente = capa;
                lados = '<path d="M32.5 48 C28.5 56 28 64 30 71 C35 69 36.5 60 36.5 52 Z" fill="' + c + '"/>' +
                        '<path d="M67.5 48 C71.5 56 72 64 70 71 C65 69 63.5 60 63.5 52 Z" fill="' + c + '"/>';
                break;

            case "rabo":
                atras = '<path d="M63 30 C86 26 92 62 74 84 C80 64 72 52 65 46 Z" fill="' + cs + '"/>';
                frente = capa + '<circle cx="65" cy="35" r="2.6" fill="' + acc + '"/>';
                break;

            case "coque":
                atras = '<circle cx="50" cy="14" r="10" fill="' + c + '"/>';
                frente = capa + '<ellipse cx="50" cy="22" rx="8.5" ry="2.5" fill="' + acc + '"/>';
                break;

            case "doiscoques":
                atras = '<circle cx="28" cy="22" r="8.5" fill="' + c + '"/><circle cx="72" cy="22" r="8.5" fill="' + c + '"/>';
                frente = capa;
                break;

            case "trancas":
                frente = capa +
                    '<path d="M31.5 46 C29 52 28 57 28.5 62 L34 62 C34 56 34 51 33 46 Z" fill="' + c + '"/>' +
                    '<path d="M68.5 46 C71 52 72 57 71.5 62 L66 62 C66 56 66 51 67 46 Z" fill="' + c + '"/>';
                lados = tranca(30) + tranca(70);
                break;

            case "cacheado":
                atras = '<g fill="' + cs + '">' +
                    '<circle cx="50" cy="28" r="17"/><circle cx="33" cy="34" r="12"/><circle cx="67" cy="34" r="12"/>' +
                    '<circle cx="27" cy="50" r="10"/><circle cx="73" cy="50" r="10"/>' +
                    '<circle cx="38" cy="22" r="11"/><circle cx="62" cy="22" r="11"/>' +
                    '<circle cx="28" cy="64" r="8"/><circle cx="72" cy="64" r="8"/></g>';
                frente = '<g fill="' + c + '">' +
                    '<circle cx="36" cy="32" r="6.5"/><circle cx="44" cy="28" r="6.5"/><circle cx="56" cy="28" r="6.5"/>' +
                    '<circle cx="64" cy="32" r="6.5"/><circle cx="50" cy="25" r="7"/></g>';
                break;

            case "afro":
                atras = '<circle cx="50" cy="34" r="28" fill="' + cs + '"/>' +
                        '<circle cx="26" cy="50" r="9" fill="' + cs + '"/><circle cx="74" cy="50" r="9" fill="' + cs + '"/>';
                frente = '<g fill="' + c + '">' +
                    '<circle cx="35" cy="31" r="7"/><circle cx="43" cy="27" r="7"/><circle cx="51" cy="25" r="7"/>' +
                    '<circle cx="59" cy="27" r="7"/><circle cx="66" cy="31" r="7"/></g>';
                break;

            case "crespo":
                frente = '<path d="M32 44 C30 28 40 22 50 22 C60 22 70 28 68 44 C66 36 60 32 50 32 C40 32 34 36 32 44 Z" fill="' + c + '"/>' +
                    '<g fill="' + c + '">' +
                    '<circle cx="36" cy="31" r="6"/><circle cx="43" cy="26" r="6.5"/><circle cx="50" cy="24" r="7"/>' +
                    '<circle cx="57" cy="26" r="6.5"/><circle cx="64" cy="31" r="6"/>' +
                    '<circle cx="32" cy="40" r="4.5"/><circle cx="68" cy="40" r="4.5"/></g>';
                break;

            case "topete":
                frente = '<path d="M31.5 46 C27 24 44 12 58 14 C71 16 73 30 68.5 46 C66 38 62 33 56 31 C50 36 40 36 34 40 C33 42 32 44 31.5 46 Z" fill="' + c + '"/>' +
                    '<path d="M42 20 C48 15 58 15 63 20" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2.2" stroke-linecap="round"/>';
                break;

            case "social":
                frente = '<path d="M31.5 46 C28 27 40 19 52 19 C66 19 72 30 68.5 46 C66 37 60 31 50 30 C43 30 37 34 31.5 46 Z" fill="' + c + '"/>' +
                    '<path d="M46 20.5 C47 25 45 28 40 31" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.4" stroke-linecap="round"/>';
                break;

            case "bone":
            case "gorro":
                frente = '<path d="M31.5 46 C31 42 31.5 40 32.5 38 L35 40 C34.5 42 34 44 33.5 47 Z" fill="' + c + '"/>' +
                         '<path d="M68.5 46 C69 42 68.5 40 67.5 38 L65 40 C65.5 42 66 44 66.5 47 Z" fill="' + c + '"/>';
                break;

            case "careca":
                frente = '<path d="M40 28 Q50 22.5 60 28" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round"/>';
                break;

            default:
                frente = capa;

        }

        return { atras: atras, frente: frente, lados: lados };

    }


    // roupa: "pre" fica atrás do pescoço, "corpo" por cima dele
    function roupa(tipo, r, sh, pele, d, interno) {

        const B = "M12 100 C12 84 28 75 50 75 C72 75 88 84 88 100 Z";

        let pre = "", corpo = "";

        switch (tipo) {

            case "moletom":
                pre = '<path d="M32 80 C30 63 40 60 50 67 C60 60 70 63 68 80 Z" fill="' + sh + '"/>';
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M31 95 H69 L72 100 H28 Z" fill="rgba(0,0,0,.14)"/>' +
                    '<path d="M40.5 76 Q50 88.5 59.5 76 Z" fill="' + pele + '"/>' +
                    '<path d="M38.5 77 Q50 91 61.5 77" fill="none" stroke="' + sh + '" stroke-width="3.4" stroke-linecap="round"/>' +
                    '<path d="M44.5 85 L44 95 M55.5 85 L56 95" stroke="' + d + '" stroke-width="1.3" stroke-linecap="round"/>' +
                    '<circle cx="44" cy="95.6" r="1.2" fill="' + d + '"/><circle cx="56" cy="95.6" r="1.2" fill="' + d + '"/>';
                break;

            case "jaqueta":
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M42 75.5 L50 94 L58 75.5 Z" fill="' + interno + '"/>' +
                    '<path d="M36.5 77 L43.5 75.5 L50 94 L44.5 94 Z" fill="' + sh + '"/>' +
                    '<path d="M63.5 77 L56.5 75.5 L50 94 L55.5 94 Z" fill="' + sh + '"/>' +
                    '<path d="M50 94 V100" stroke="' + d + '" stroke-width="1.4"/>' +
                    '<path d="M37.5 77 Q50 69 62.5 77 L60 81 Q50 74.5 40 81 Z" fill="' + d + '"/>';
                break;

            case "blazer":
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M43.5 75.5 L50 95 L56.5 75.5 Z" fill="#f4f8fd"/>' +
                    '<path d="M40 75.5 L50 96 L33 86 L36 79 Z" fill="rgba(255,255,255,.1)" stroke="' + sh + '" stroke-width="1"/>' +
                    '<path d="M60 75.5 L50 96 L67 86 L64 79 Z" fill="rgba(255,255,255,.1)" stroke="' + sh + '" stroke-width="1"/>' +
                    '<path d="M48.6 79 H51.4 L52.8 92 L50 96 L47.2 92 Z" fill="' + d + '"/>';
                break;

            case "gola":
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M40.5 62 H59.5 L61 80 H39 Z" fill="' + r + '"/>' +
                    '<path d="M40.7 67.5 H59.3 M40.2 73 H59.8" stroke="' + sh + '" stroke-width="1.2" fill="none"/>';
                break;

            case "regata":
                corpo = '<path d="' + B + '" fill="' + pele + '"/>' +
                    '<path d="M29 100 C29 88 36 80 43 77 Q50 85 57 77 C64 80 71 88 71 100 Z" fill="' + r + '"/>';
                break;

            case "esporte":
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M16 90 H84 V93.5 H16 Z" fill="' + d + '"/>' +
                    '<path d="M41 75.5 Q50 86 59 75.5 L62 77 Q50 92 38 77 Z" fill="' + d + '"/>' +
                    '<path d="M41 75.5 Q50 86 59 75.5 Z" fill="' + pele + '"/>';
                break;

            default: // camiseta
                corpo = '<path d="' + B + '" fill="' + r + '"/>' +
                    '<path d="M41.5 75.5 Q50 85.5 58.5 75.5 Z" fill="' + pele + '"/>' +
                    '<path d="M41.5 75.5 Q50 85.5 58.5 75.5" fill="none" stroke="' + sh + '" stroke-width="1.4"/>' +
                    '<path d="M60 91 L66 91 L63 96.5 Z" fill="' + d + '"/>';

        }

        return { pre: pre, corpo: corpo };

    }


    // ---------- personagem completo ----------

    function desenhar(p) {

        const id = "av" + (++sequencia);

        const extras = p.extra || [];

        const tem = function (nome) { return extras.indexOf(nome) !== -1; };

        const fem = p.genero === "f";

        const pele = p.pele;
        const c = p.cabelo;
        const cs = escurecer(c, 0.28);
        const acc = p.detalhe || "#38bdf8";
        const r = p.roupa;
        const sh = escurecer(r, 0.22);
        const olho = p.corOlho || TINTA;
        const sob = p.sobrancelha || escurecer(c, 0.2);
        const batom = p.batom || TINTA;
        const chapeu = p.chapeu || "#2563eb";

        const cab = cabelo(p.estilo, c, cs, acc);

        const vest = roupa(p.vest, r, sh, pele, acc, p.interno || "#e9f2fc");


        // olhos
        const olhoAberto = function (x) {

            return '<ellipse cx="' + x + '" cy="46" rx="2.3" ry="2.9" fill="' + olho + '"/>' +
                   '<circle cx="' + (x + 0.8) + '" cy="44.9" r="0.85" fill="#fff"/>';

        };

        const olhoFeliz = function (x) {

            return '<path d="M' + (x - 2.7) + ' 47 Q' + x + " 43.5 " + (x + 2.7) + ' 47" fill="none" stroke="' + TINTA +
                   '" stroke-width="1.9" stroke-linecap="round"/>';

        };

        let olhos;

        if (p.olhos === "feliz") olhos = olhoFeliz(42.5) + olhoFeliz(57.5);
        else if (p.olhos === "pisca") olhos = olhoAberto(42.5) + olhoFeliz(57.5);
        else olhos = olhoAberto(42.5) + olhoAberto(57.5);


        // sobrancelhas e cílios
        let sobrancelhas;

        if (fem) {

            sobrancelhas =
                '<path d="M38.5 41 Q42.5 38.2 46.5 40 M53.5 40 Q57.5 38.2 61.5 41" fill="none" stroke="' + sob +
                '" stroke-width="1.7" stroke-linecap="round"/>' +
                '<path d="M40 44.8 L38.2 43.4 M60 44.8 L61.8 43.4" stroke="' + TINTA + '" stroke-width="1.4" stroke-linecap="round"/>';

        } else {

            sobrancelhas =
                '<path d="M38.5 40.5 L46.5 39.8 M53.5 39.8 L61.5 40.5" fill="none" stroke="' + sob +
                '" stroke-width="2.3" stroke-linecap="round"/>';

        }


        // boca
        let boca;

        if (tem("barba")) {

            boca = '<path d="M46 58.4 Q50 60.4 54 58.4" fill="none" stroke="' + TINTA + '" stroke-width="1.8" stroke-linecap="round"/>';

        } else {

            switch (p.boca) {

                case "aberto":
                    boca = '<path d="M44 55.5 Q50 64 56 55.5 Z" fill="#5b1a24"/>' +
                           '<path d="M45 55.8 Q50 58.6 55 55.8 Q50 57.3 45 55.8 Z" fill="#fff"/>' +
                           '<path d="M47.5 58.6 Q50 57 52.5 58.6 Q50 59.6 47.5 58.6 Z" fill="#e5707e"/>';
                    break;

                case "lado":
                    boca = '<path d="M45 57.5 Q50 60 56.5 55" fill="none" stroke="' + batom + '" stroke-width="1.9" stroke-linecap="round"/>';
                    break;

                case "neutro":
                    boca = '<path d="M46.5 57.5 H53.5" fill="none" stroke="' + batom + '" stroke-width="1.9" stroke-linecap="round"/>';
                    break;

                default:
                    boca = '<path d="M44.5 56 Q50 61.5 55.5 56" fill="none" stroke="' + batom + '" stroke-width="1.9" stroke-linecap="round"/>';

            }

        }


        // detalhes do rosto
        let rosto = "";

        rosto += '<ellipse cx="37.5" cy="52" rx="3.4" ry="2" fill="rgba(255,95,110,' + (fem ? ".28" : ".1") + ')"/>' +
                 '<ellipse cx="62.5" cy="52" rx="3.4" ry="2" fill="rgba(255,95,110,' + (fem ? ".28" : ".1") + ')"/>';

        if (tem("sardas")) {

            rosto += '<g fill="rgba(120,60,20,.45)">' +
                '<circle cx="40" cy="52" r=".8"/><circle cx="43" cy="53.5" r=".8"/><circle cx="38.5" cy="54" r=".8"/>' +
                '<circle cx="60" cy="52" r=".8"/><circle cx="57" cy="53.5" r=".8"/><circle cx="61.5" cy="54" r=".8"/></g>';

        }

        const bigodeForma = '<path d="M41.5 55 Q46 51.5 50 54 Q54 51.5 58.5 55 Q54 57 50 55.8 Q46 57 41.5 55 Z" fill="' + c + '"/>';

        if (tem("barba")) {

            rosto += '<path d="M32 50 C32 72 68 72 68 50 C67 56 62 58 56 59 Q50 62 44 59 C38 58 33 56 32 50 Z" fill="' + c + '"/>' + bigodeForma;

        } else if (tem("bigode")) {

            rosto += bigodeForma;

        }


        // peças por cima do cabelo
        let cima = "";

        if (p.estilo === "bone") {

            cima += '<path d="M30.5 41 C29 12 71 12 69.5 41 Z" fill="' + chapeu + '"/>' +
                    '<path d="M26.5 41.5 Q50 35 73.5 41.5 Q50 44.5 26.5 41.5 Z" fill="' + escurecer(chapeu, 0.25) + '"/>' +
                    '<circle cx="50" cy="28" r="3.2" fill="' + acc + '"/>';

        }

        if (p.estilo === "gorro") {

            cima += '<path d="M30 38 C28 10 72 10 70 38 Z" fill="' + chapeu + '"/>' +
                    '<rect x="28.5" y="30" width="43" height="9.5" rx="3.2" fill="' + escurecer(chapeu, 0.18) + '"/>' +
                    '<path d="M35 31 V38.5 M41 31 V38.5 M47 31 V38.5 M53 31 V38.5 M59 31 V38.5 M65 31 V38.5" stroke="rgba(0,0,0,.18)" stroke-width="1"/>' +
                    '<circle cx="50" cy="15" r="4.6" fill="' + clarear(chapeu, 0.2) + '"/>';

        }

        if (tem("faixa")) {

            cima += '<path d="M31 37 C40 29 60 29 69 37 L69.5 41 C60 34 40 34 30.5 41 Z" fill="' + acc + '"/>';

        }

        if (tem("fone")) {

            cima += '<path d="M30.5 47 C27 14 73 14 69.5 47" fill="none" stroke="' + acc + '" stroke-width="3.4" stroke-linecap="round"/>' +
                    '<rect x="26.5" y="43" width="7.5" height="14" rx="3.5" fill="' + acc + '"/>' +
                    '<rect x="66" y="43" width="7.5" height="14" rx="3.5" fill="' + acc + '"/>' +
                    '<rect x="28.5" y="46" width="3.5" height="8" rx="1.7" fill="' + escurecer(acc, 0.35) + '"/>' +
                    '<rect x="68" y="46" width="3.5" height="8" rx="1.7" fill="' + escurecer(acc, 0.35) + '"/>';

        }

        if (tem("fonepescoco")) {

            cima += '<path d="M35 66 C34 92 66 92 65 66" fill="none" stroke="#1f2937" stroke-width="3.6" stroke-linecap="round"/>' +
                    '<rect x="31" y="64" width="8" height="12" rx="3.5" fill="' + acc + '"/>' +
                    '<rect x="61" y="64" width="8" height="12" rx="3.5" fill="' + acc + '"/>';

        }

        if (tem("oculosr")) {

            cima += '<circle cx="42" cy="46" r="6" fill="rgba(255,255,255,.14)" stroke="' + TINTA + '" stroke-width="1.6"/>' +
                    '<circle cx="58" cy="46" r="6" fill="rgba(255,255,255,.14)" stroke="' + TINTA + '" stroke-width="1.6"/>' +
                    '<path d="M48 45.5 Q50 44 52 45.5 M36 45.5 L32.5 44.5 M64 45.5 L67.5 44.5" fill="none" stroke="' + TINTA + '" stroke-width="1.5" stroke-linecap="round"/>';

        }

        if (tem("oculosq")) {

            cima += '<rect x="35.5" y="41.5" width="13" height="9.5" rx="2.5" fill="rgba(255,255,255,.14)" stroke="' + TINTA + '" stroke-width="1.6"/>' +
                    '<rect x="51.5" y="41.5" width="13" height="9.5" rx="2.5" fill="rgba(255,255,255,.14)" stroke="' + TINTA + '" stroke-width="1.6"/>' +
                    '<path d="M48.5 45 H51.5 M35.5 44.5 L32.5 44 M64.5 44.5 L67.5 44" fill="none" stroke="' + TINTA + '" stroke-width="1.5" stroke-linecap="round"/>';

        }

        if (tem("solar")) {

            cima += '<rect x="35" y="42" width="14" height="9.5" rx="4" fill="#111827"/>' +
                    '<rect x="51" y="42" width="14" height="9.5" rx="4" fill="#111827"/>' +
                    '<path d="M49 44.5 H51 M35 44 L32.5 43.5 M65 44 L67.5 43.5" fill="none" stroke="#111827" stroke-width="1.6" stroke-linecap="round"/>' +
                    '<path d="M38 44.8 H42 M54 44.8 H58" stroke="rgba(255,255,255,.45)" stroke-width="1.4" stroke-linecap="round"/>';

        }

        if (tem("brincos")) {

            cima += '<circle cx="32.2" cy="54" r="2.4" fill="none" stroke="#fbbf24" stroke-width="1.3"/>' +
                    '<circle cx="67.8" cy="54" r="2.4" fill="none" stroke="#fbbf24" stroke-width="1.3"/>';

        }


        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
            fundoArte(p, id) +
            cab.atras +
            vest.pre +
            '<rect x="43" y="58" width="14" height="22" rx="6" fill="' + pele + '"/>' +
            '<path d="M43 61 H57 V70 Q50 75 43 70 Z" fill="rgba(0,0,0,.16)"/>' +
            vest.corpo +
            '<ellipse cx="32.5" cy="47" rx="3" ry="4.2" fill="' + pele + '"/>' +
            '<ellipse cx="67.5" cy="47" rx="3" ry="4.2" fill="' + pele + '"/>' +
            '<ellipse cx="32.8" cy="47" rx="1.4" ry="2.4" fill="rgba(0,0,0,.1)"/>' +
            '<ellipse cx="67.2" cy="47" rx="1.4" ry="2.4" fill="rgba(0,0,0,.1)"/>' +
            '<ellipse cx="50" cy="45" rx="17.5" ry="20" fill="' + pele + '"/>' +
            '<path d="M33 52 C34 62 42 65 50 65 C58 65 66 62 67 52 C64 60 58 61 50 61 C42 61 36 60 33 52 Z" fill="rgba(0,0,0,.06)"/>' +
            rosto +
            olhos +
            sobrancelhas +
            '<path d="M50 48.5 Q52 52.5 49.5 53.2" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1.3" stroke-linecap="round"/>' +
            boca +
            cab.frente +
            cab.lados +
            cima +
            '</svg>';

    }


    // ---------- uso nas telas ----------

    function escapar(texto) {

        return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {

            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];

        });

    }


    // "Maria Santos" -> "MS"; "Maria" -> "M"; vazio -> "?"
    function iniciais(nome) {

        const partes = String(nome == null ? "" : nome).trim().split(/\s+/).filter(Boolean);

        if (!partes.length) return "?";

        const primeira = partes[0].charAt(0);
        const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";

        return (primeira + ultima).toUpperCase();

    }


    // HTML do avatar de um usuário (personagem ou, sem avatar, as iniciais)
    function tag(usuario, tamanho) {

        const classe = "av" + (tamanho ? " av-" + tamanho : "");

        const codigo = usuario && typeof usuario.avatar === "string" && VALIDO.test(usuario.avatar)
            ? usuario.avatar
            : null;

        const personagem = codigo ? buscar(codigo) : null;

        if (personagem) {

            return '<span class="' + classe + '" aria-hidden="true">' + desenhar(personagem) + "</span>";

        }

        return '<span class="' + classe + ' av-vazio" aria-hidden="true">' +
            escapar(iniciais(usuario && usuario.nome)) + "</span>";

    }


    global.Avatar = {
        GRUPOS: GRUPOS,
        VALIDO: VALIDO,
        buscar: buscar,
        desenhar: desenhar,
        iniciais: iniciais,
        tag: tag
    };

})(window);
