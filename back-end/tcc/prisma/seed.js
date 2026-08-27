import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function tiposDaVaga(numero) {
  if (numero % 15 === 0) return "PCD";
  if (numero % 12 === 0) return "Idoso";
  if (numero % 10 === 0) return "Elétrica";
  return "Comum";
}

async function criarVagas(idEstacionamento, quantidade, preco) {
  const vagas = [];

  for (let numero = 1; numero <= quantidade; numero++) {
    vagas.push({
      numero: String(numero),
      tipo: tiposDaVaga(numero),
      status: "Livre",
      preco,
      fk_est: idEstacionamento,
    });
  }

  await prisma.vaga.createMany({ data: vagas });
}

async function limpar() {
  await prisma.pagamento.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.reservaCli.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.carro.deleteMany();
  await prisma.funcionario.deleteMany();
  await prisma.vaga.deleteMany();
  await prisma.estacionamento.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.tipoFunc.deleteMany();
  await prisma.endereco.deleteMany();
}

async function popular() {
  const enderecoUsuario = await prisma.endereco.create({
    data: {
      rua: "Rua das Acácias",
      numero: "120",
      bairro: "Centro",
      cidade: "Santa Fé do Sul",
      estado: "SP",
      cep: "15775-000",
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      nome: "Maria Santos",
      dataNascimento: new Date("1998-04-15"),
      cpf: "123.456.789-00",
      email: "maria@email.com",
      senha: "123456",
      fk_idEndereco: enderecoUsuario.id,
    },
  });

  await prisma.carro.create({
    data: {
      placacarro: "ABC1D23",
      modelo: "Honda Civic",
      fk_idCliente: usuario.id,
    },
  });

  const enderecoPark = await prisma.endereco.create({
    data: {
      rua: "Avenida Brasil",
      numero: "1000",
      bairro: "Jardim América",
      cidade: "Jales",
      estado: "SP",
      cep: "15700-000",
    },
  });

  const centerPark = await prisma.estacionamento.create({
    data: {
      nome: "CenterPark",
      status: "Ativo",
      fk_idEndereco: enderecoPark.id,
    },
  });

  await criarVagas(centerPark.id, 35, 25);

  const enderecoPlaza = await prisma.endereco.create({
    data: {
      rua: "Rua XV de Novembro",
      numero: "450",
      bairro: "Centro",
      cidade: "Jales",
      estado: "SP",
      cep: "15700-100",
    },
  });

  const shoppingPlaza = await prisma.estacionamento.create({
    data: {
      nome: "Shopping Plaza",
      status: "Ativo",
      fk_idEndereco: enderecoPlaza.id,
    },
  });

  await criarVagas(shoppingPlaza.id, 40, 20);

  const tipoAdmin = await prisma.tipoFunc.create({
    data: { nome: "Administrador", tipo: "admin" },
  });

  const tipoFuncionario = await prisma.tipoFunc.create({
    data: { nome: "Recepcionista", tipo: "funcionario" },
  });

  await prisma.funcionario.create({
    data: {
      nome: "Ana Administradora",
      dataNascimento: new Date("1990-08-20"),
      cpf: "111.222.333-44",
      telefone: "(17) 98888-0001",
      email: "admin@vagaconnect.com",
      senha: "admin123",
      fk_tipofunc: tipoAdmin.id,
      fk_est: centerPark.id,
    },
  });

  await prisma.funcionario.create({
    data: {
      nome: "João Silva",
      dataNascimento: new Date("1995-03-10"),
      cpf: "555.666.777-88",
      telefone: "(17) 97777-0002",
      email: "joao.func@vagaconnect.com",
      senha: "123456",
      fk_tipofunc: tipoFuncionario.id,
      fk_est: shoppingPlaza.id,
    },
  });
}

try {
  await limpar();
  await popular();

  const [usuarios, funcionarios, estacionamentos, vagas] = await Promise.all([
    prisma.usuario.count(),
    prisma.funcionario.count(),
    prisma.estacionamento.count(),
    prisma.vaga.count(),
  ]);

  console.log(`ok usuarios=${usuarios} funcionarios=${funcionarios} estacionamentos=${estacionamentos} vagas=${vagas}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
