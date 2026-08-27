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
