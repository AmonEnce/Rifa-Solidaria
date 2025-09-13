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

async function carregarCompradores() {
    const statusFiltro = document.getElementById('statusFiltro').value;
    const tbody = document.getElementById('compradoresTable');
    tbody.innerHTML = "";

    // Pega o documento único
    const docRef = db.collection("rifas").doc("rifaNumeros");
    const docSnap = await docRef.get();

    if (!docSnap.exists) return;

    const numeros = docSnap.data().numeros; // objeto com 1..1500

    // Agrupar por comprador
    const compradores = {};
    Object.keys(numeros).forEach(key => {
        const n = numeros[key];
        if (n.status === statusFiltro && n.comprador) {
            const nome = n.comprador.nome;
            const telefone = n.comprador.telefone;

            if (!compradores[nome]) compradores[nome] = { telefone: telefone, numeros: [] };
            compradores[nome].numeros.push(key);
        }
    });

    // Montar tabela
    for (let nome in compradores) {
        const c = compradores[nome];
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${nome}</td>
            <td>${c.telefone}</td>
            <td>${c.numeros.length}</td>
            <td>R$ ${c.numeros.length * 10},00</td>
            <td class="numeros">${c.numeros.join(", ")}</td>
            <td>
                ${statusFiltro === 'reservado' ? `
                    <button onclick="autorizar('${nome}')">Autorizar</button>
                    <button style="background:#dc3545; margin-left:5px;" onclick="recusar('${nome}')">Recusar</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
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