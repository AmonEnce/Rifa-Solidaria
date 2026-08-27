const firebaseConfig = {
    apiKey: "AIzaSyAdSwi3Dq8c263cAfpCC2FqfrbbP8bD-Yk",
    authDomain: "rifa-publica.firebaseapp.com",
    projectId: "rifa-publica",
    storageBucket: "rifa-publica.firebasestorage.app",
    messagingSenderId: "65813208539",
    appId: "1:65813208539:web:ba86fcfba44fff146f9bfe"
};
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


async function login() {
    const email = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();

    if (!email || !pass) {
        await Swal.fire({
            icon: 'warning',
            title: 'Atenção!',
            text: 'Preencha usuário e senha!',
            confirmButtonText: 'Ok'
        });
        return;
    }

    try {
        // Pega o documento de admins
        const docRef = db.collection("config").doc("admins");
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            throw new Error("Documento de admins não encontrado!");
        }

        const admins = docSnap.data();

        // Verifica se existe algum admin com email e senha
        let logado = false;
        Object.keys(admins).forEach(key => {
            const a = admins[key];
            if (a.email === email && a.senha === pass) {
                logado = true;
            }
        });

        if (!logado) {
            throw new Error("Usuário ou senha inválidos!");
        }

        // Login válido → mostra painel
        document.getElementById('loginDiv').style.display = "none";
        document.getElementById('adminDiv').style.display = "block";
        carregarCompradores();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonText: 'Ok'
        });
    }
}


function logout() {
    document.getElementById('loginDiv').style.display = "block";
    document.getElementById('adminDiv').style.display = "none";
}

function formatarDataBR(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

async function carregarCompradores() {
    const statusFiltro = document.getElementById('statusFiltro').value;
    const tbody = document.getElementById('compradoresTable');
    tbody.innerHTML = "";

    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const numeros = docSnap.data().numeros;

    // Agrupar por comprador
    const compradores = {};
    Object.keys(numeros).forEach(key => {
        const n = numeros[key];
        if (n.status === statusFiltro && n.comprador) {
            const nome = n.comprador.nome;
            const telefone = n.comprador.telefone;
            const vendedor = n.comprador.vendedor || "Não informado";
            const timestamp = n.timestamp || null;

            if (!compradores[nome]) {
                compradores[nome] = { 
                    telefone, 
                    vendedor, 
                    numeros: [], 
                    timestamp 
                };
            }
            compradores[nome].numeros.push(key);
        }
    });

    // Para resumo
    const resumo = {};

    // Montar tabela
    for (let nome in compradores) {
        const c = compradores[nome];
        const qtd = c.numeros.length;
        const valor = qtd * 10;

        // Alimenta resumo por vendedor
        if (!resumo[c.vendedor]) resumo[c.vendedor] = 0;
        resumo[c.vendedor] += valor;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="width: 155px;">${nome}</td>
            <td style="width: 165px;">${c.telefone}</td>
            <td>${qtd}</td>
            <td>R$ ${valor},00</td>
            <td>${c.vendedor}</td>
            <td style="width: 155px;">${formatarDataBR(c.timestamp)}</td>
            <td class="numeros">${c.numeros.join(", ")}</td>
            <td>
                <div style="display: flex; gap: 10px;">
                    ${statusFiltro === 'reservado' ? `
                        <button class="btn btn-success btn-sm" onclick="confirmarAutorizar('${nome}')">
                            <i class="bi bi-check-circle"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="confirmarRecusar('${nome}')" style="margin-left:5px;">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-primary btn-sm" onclick="editarComprador('${nome}')" style="margin-left:5px;">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }

    // Montar resumo
    let resumoHTML = "<h3>Resumo de Vendas</h3><ul>";
    for (let vendedor in resumo) {
        resumoHTML += `<li>${vendedor}: R$ ${resumo[vendedor]},00</li>`;
    }
    resumoHTML += "</ul>";

    document.getElementById("resumoVendas").innerHTML = resumoHTML;
}

async function confirmarRecusar(nome) {
    const result = await Swal.fire({
        title: `Tem certeza que deseja recusar os números de ${nome}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, recusar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        recusar(nome);
    }
}

async function confirmarAutorizar(nome) {
    const result = await Swal.fire({
        title: `Tem certeza que deseja autorizar o pagamento de ${nome}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, autorizar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        autorizar(nome);
    }
}

async function recusar(nome) {
    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const numeros = docSnap.data().numeros;
    Object.keys(numeros).forEach(key => {
        if (numeros[key].comprador && numeros[key].comprador.nome === nome && numeros[key].status === "reservado") {
            numeros[key].status = "livre";
            numeros[key].comprador = null;
            numeros[key].timestamp = null;
        }
    });

    await docRef.set({ numeros }, { merge: true });

    Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: `Os números de ${nome} foram liberados!`,
        confirmButtonText: 'Ok'
    });

    carregarCompradores();
}

async function autorizar(nome) {
    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const numeros = docSnap.data().numeros;
    Object.keys(numeros).forEach(key => {
        if (numeros[key].comprador && numeros[key].comprador.nome === nome && numeros[key].status === "reservado") {
            numeros[key].status = "pago";
        }
    });

    await docRef.set({ numeros }, { merge: true });

    Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: `Pagamento de ${nome} autorizado!`,
        confirmButtonText: 'Ok'
    });

    carregarCompradores();
}

async function editarComprador(nome) {
    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const numeros = docSnap.data().numeros;

    // Pegar primeiro número do comprador para preencher os dados
    let comprador = null;
    Object.keys(numeros).forEach(key => {
        if (numeros[key].comprador && numeros[key].comprador.nome === nome) {
            comprador = numeros[key].comprador;
        }
    });

    if (!comprador) return;

    // Se não existir vendedor ainda, define padrão
    if (!comprador.vendedor) {
        comprador.vendedor = "Marcio"; // ou "" se quiser deixar vazio
    }

    // Abrir o Swal com formulário preenchido
    const { value: formValues } = await Swal.fire({
    title: 'Editar Comprador',
    html: `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
            <label>
                <span style="font-size:14px; font-weight:bold;">Nome</span>
                <input id="swal-nome" class="swal2-input" 
                       style="width:100%; margin:5px 0;" 
                       placeholder="Nome" 
                       value="${comprador.nome || ''}">
            </label>
            <label>
                <span style="font-size:14px; font-weight:bold;">Telefone</span>
                <input id="swal-telefone" class="swal2-input" 
                       style="width:100%; margin:5px 0;" 
                       placeholder="Telefone" 
                       value="${comprador.telefone || ''}">
            </label>
            <label>
                <span style="font-size:14px; font-weight:bold;">Vendedor</span>
                <select id="swal-vendedor" class="swal2-input" style="width:100%; margin:5px 0;">
                    <option value="Marcio" ${comprador.vendedor === 'Marcio' ? 'selected' : ''}>Marcio</option>
                    <option value="Gerson" ${comprador.vendedor === 'Gerson' ? 'selected' : ''}>Gerson</option>
                    <option value="Ademir" ${comprador.vendedor === 'Ademir' ? 'selected' : ''}>Ademir</option>
                </select>
            </label>
        </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
        return {
            nome: document.getElementById('swal-nome').value.trim(),
            telefone: document.getElementById('swal-telefone').value.trim(),
            vendedor: document.getElementById('swal-vendedor').value
        };
    }
});

    if (!formValues) return; // usuário cancelou

    // Atualizar todos os números desse comprador
    Object.keys(numeros).forEach(key => {
        if (numeros[key].comprador && numeros[key].comprador.nome === nome) {
            numeros[key].comprador.nome = formValues.nome;
            numeros[key].comprador.telefone = formValues.telefone;
            numeros[key].comprador.vendedor = formValues.vendedor;
        }
    });

    await docRef.set({ numeros }, { merge: true });

    Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: `Os dados de ${nome} foram atualizados com sucesso.`,
        confirmButtonText: 'Ok'
    });

    carregarCompradores();
}

async function obterDadosRelatorio() {

    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        throw new Error("Dados da rifa não encontrados.");
    }

    const numeros = docSnap.data().numeros;

    const vendas = [];

    Object.keys(numeros).forEach(numero => {

        const item = numeros[numero];

        // Relatório considera somente números pagos
        if (
            item.status !== "pago" ||
            !item.comprador
        ) {
            return;
        }

        const comprador = item.comprador;

        vendas.push({
            vendedor: comprador.vendedor || "Não informado",
            nome: comprador.nome || "Não informado",
            telefone: comprador.telefone || "",
            numero: numero,
            timestamp: item.timestamp || null
        });
    });

    // Agrupar os números da mesma compra
    const comprasMap = {};

    vendas.forEach(venda => {

        // Agrupa por comprador + vendedor + timestamp
        const timestamp = obterTimestampMillis(venda.timestamp);

        const chave =
            `${venda.vendedor}|${venda.nome}|${venda.telefone}|${timestamp}`;

        if (!comprasMap[chave]) {

            comprasMap[chave] = {
                vendedor: venda.vendedor,
                nome: venda.nome,
                telefone: venda.telefone,
                timestamp: venda.timestamp,
                numeros: []
            };
        }

        comprasMap[chave].numeros.push(venda.numero);
    });

    return Object.values(comprasMap)
        .map(compra => {

            compra.numeros.sort((a, b) => {
                return Number(a) - Number(b);
            });

            compra.quantidade = compra.numeros.length;

            // Valor atual da rifa
            compra.valor = compra.quantidade * 10;

            return compra;
        })
        .sort((a, b) => {

            const vendedorCompare =
                a.vendedor.localeCompare(b.vendedor);

            if (vendedorCompare !== 0) {
                return vendedorCompare;
            }

            return obterTimestampMillis(a.timestamp) -
                obterTimestampMillis(b.timestamp);
        });
}


function obterTimestampMillis(timestamp) {

    if (!timestamp) {
        return 0;
    }

    // Firebase Timestamp
    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }

    // Firebase Timestamp convertido
    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().getTime();
    }

    // Número
    if (typeof timestamp === "number") {
        return timestamp;
    }

    // String / Date
    const data = new Date(timestamp);

    if (!isNaN(data.getTime())) {
        return data.getTime();
    }

    return 0;
}


function formatarDataRelatorio(timestamp) {

    const millis = obterTimestampMillis(timestamp);

    if (!millis) {
        return "";
    }

    const data = new Date(millis);

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();

    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}


function formatarMoeda(valor) {

    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

async function abrirRelatorio() {

    Swal.fire({
        title: "Carregando relatório...",
        text: "Aguarde.",
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {

        const vendas = await obterDadosRelatorio();

        if (!vendas.length) {

            Swal.fire({
                icon: "info",
                title: "Nenhuma venda encontrada",
                text: "Não existem vendas pagas para gerar o relatório."
            });

            return;
        }

        const vendedores = [
            ...new Set(vendas.map(x => x.vendedor))
        ].sort();

        let opcoesVendedor = `
            <option value="">Todos os vendedores</option>
        `;

        vendedores.forEach(vendedor => {

            opcoesVendedor += `
                <option value="${escapeHtml(vendedor)}">
                    ${escapeHtml(vendedor)}
                </option>
            `;
        });

        Swal.fire({
            title: "Relatório de Vendas",
            html: `
                <div style="text-align:left;">

                    <label style="font-weight:bold;">
                        Vendedor
                    </label>

                    <select id="relatorioVendedor"
                            class="swal2-select"
                            style="width:100%; margin:10px 0 20px;">
                        ${opcoesVendedor}
                    </select>

                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        O relatório considera somente vendas com
                        pagamento autorizado.
                    </div>

                    <div class="d-flex gap-2 justify-content-center mt-3">

                        <button type="button"
                                class="btn btn-danger"
                                onclick="gerarRelatorioPDF()">
                            <i class="bi bi-file-earmark-pdf"></i>
                            Gerar PDF
                        </button>

                        <button type="button"
                                class="btn btn-success"
                                onclick="gerarRelatorioCSV()">
                            <i class="bi bi-filetype-csv"></i>
                            Gerar CSV
                        </button>

                    </div>

                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            width: 500
        });

    } catch (error) {

        Swal.fire({
            icon: "error",
            title: "Erro",
            text: error.message
        });
    }
}

async function gerarRelatorioPDF() {

    try {

        const vendas = await obterDadosRelatorio();

        const vendedorSelecionado =
            document.getElementById("relatorioVendedor")?.value || "";

        const vendasFiltradas = vendedorSelecionado
            ? vendas.filter(x => x.vendedor === vendedorSelecionado)
            : vendas;

        if (!vendasFiltradas.length) {

            Swal.fire({
                icon: "info",
                title: "Nenhuma venda",
                text: "Não existem vendas para o vendedor selecionado."
            });

            return;
        }

        const { jsPDF } = window.jspdf;

        const doc = new jsPDF("landscape");

        const vendedores = [
            ...new Set(vendasFiltradas.map(x => x.vendedor))
        ].sort();

        let posY = 20;

        // Título
        doc.setFontSize(18);
        doc.text("Relatório de Vendas - Rifa Solidária", 14, posY);

        posY += 8;

        doc.setFontSize(10);

        doc.text(
            `Gerado em: ${formatarDataRelatorio(new Date())}`,
            14,
            posY
        );

        posY += 10;

        let totalGeral = 0;
        let quantidadeGeral = 0;

        vendedores.forEach((vendedor, index) => {

            const vendasVendedor =
                vendasFiltradas.filter(x =>
                    x.vendedor === vendedor
                );

            const totalVendedor =
                vendasVendedor.reduce(
                    (total, venda) => total + venda.valor,
                    0
                );

            const quantidadeNumeros =
                vendasVendedor.reduce(
                    (total, venda) =>
                        total + venda.quantidade,
                    0
                );

            totalGeral += totalVendedor;
            quantidadeGeral += quantidadeNumeros;

            // Evita quebrar o cabeçalho do vendedor
            if (posY > 170) {
                doc.addPage();
                posY = 20;
            }

            doc.setFontSize(14);
            doc.setFont(undefined, "bold");

            doc.text(
                `Vendedor: ${vendedor}`,
                14,
                posY
            );

            posY += 7;

            doc.setFontSize(10);
            doc.setFont(undefined, "normal");

            doc.text(
                `Total de números: ${quantidadeNumeros}`,
                14,
                posY
            );

            doc.text(
                `Total vendido: ${formatarMoeda(totalVendedor)}`,
                90,
                posY
            );

            posY += 5;

            const linhas = vendasVendedor.map(venda => [

                venda.nome,

                venda.telefone,

                venda.numeros.join(", "),

                venda.quantidade.toString(),

                formatarMoeda(venda.valor),

                formatarDataRelatorio(venda.timestamp)

            ]);

            doc.autoTable({

                startY: posY,

                head: [[
                    "Comprador",
                    "Telefone",
                    "Números Comprados",
                    "Qtd.",
                    "Valor Pago",
                    "Data/Hora"
                ]],

                body: linhas,

                theme: "grid",

                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },

                headStyles: {
                    fontStyle: "bold"
                },

                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 70 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 40 }
                },

                margin: {
                    left: 14,
                    right: 14
                }
            });

            posY = doc.lastAutoTable.finalY + 12;

        });

        // Resumo final
        if (posY > 170) {
            doc.addPage();
            posY = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, "bold");

        doc.text(
            "Resumo Geral",
            14,
            posY
        );

        posY += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, "normal");

        doc.text(
            `Total de números vendidos: ${quantidadeGeral}`,
            14,
            posY
        );

        doc.text(
            `Valor total vendido: ${formatarMoeda(totalGeral)}`,
            100,
            posY
        );

        const dataArquivo =
            new Date().toISOString().slice(0, 10);

        doc.save(
            `relatorio-vendas-${dataArquivo}.pdf`
        );

        Swal.close();

    } catch (error) {

        console.error(error);

        Swal.fire({
            icon: "error",
            title: "Erro ao gerar PDF",
            text: error.message
        });
    }
}

async function gerarRelatorioCSV() {

    try {

        const vendas = await obterDadosRelatorio();

        const vendedorSelecionado =
            document.getElementById("relatorioVendedor")?.value || "";

        const vendasFiltradas = vendedorSelecionado
            ? vendas.filter(x => x.vendedor === vendedorSelecionado)
            : vendas;

        if (!vendasFiltradas.length) {

            Swal.fire({
                icon: "info",
                title: "Nenhuma venda",
                text: "Não existem vendas para o vendedor selecionado."
            });

            return;
        }

        const linhas = [];

        // Cabeçalho
        linhas.push([
            "Vendedor",
            "Comprador",
            "Telefone",
            "Números Comprados",
            "Quantidade",
            "Valor Pago",
            "Data/Hora"
        ]);

        vendasFiltradas.forEach(venda => {

            linhas.push([
                venda.vendedor,
                venda.nome,
                venda.telefone,
                venda.numeros.join(", "),
                venda.quantidade,
                venda.valor.toFixed(2).replace(".", ","),
                formatarDataRelatorio(venda.timestamp)
            ]);

        });

        // Converter para CSV
        const csv = linhas
            .map(linha =>
                linha
                    .map(valor => {
                        const texto = String(valor ?? "");

                        // Escapa aspas
                        return `"${texto.replace(/"/g, '""')}"`;
                    })
                    .join(";")
            )
            .join("\r\n");

        // BOM para o Excel reconhecer UTF-8
        const blob = new Blob(
            ["\uFEFF" + csv],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        const dataArquivo =
            new Date().toISOString().slice(0, 10);

        link.download =
            `relatorio-vendas-${dataArquivo}.csv`;

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        Swal.close();

    } catch (error) {

        console.error(error);

        Swal.fire({
            icon: "error",
            title: "Erro ao gerar CSV",
            text: error.message
        });
    }
}

function escapeHtml(valor) {

    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
