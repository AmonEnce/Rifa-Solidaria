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
