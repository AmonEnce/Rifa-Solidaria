// Configuração Firebase
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

const TOTAL_NUMEROS = 1500;
let numerosSelecionados = [];

// Referência ao documento único da rifa
const rifaDocRef = db.collection("rifas").doc("rifaNumeros");

// Carregar números do JSON
async function carregarNumeros() {
    const container = document.getElementById("numeros");
    container.innerHTML = "";

    try {
        const doc = await rifaDocRef.get();
        if (!doc.exists) {
            console.error("Documento da rifa não encontrado!");
            return;
        }

        const data = doc.data();
        const numeros = data.numeros;

        for (let i = 1; i <= TOTAL_NUMEROS; i++) {
            const numeroData = numeros[i] || { status: "livre", comprador: null };
            const btn = document.createElement("button");
            btn.textContent = i;
            btn.disabled = numeroData.status !== "livre";

            btn.onclick = () => {
                if (btn.disabled) return;
                if (numerosSelecionados.includes(i)) {
                    numerosSelecionados = numerosSelecionados.filter(n => n !== i);
                    btn.classList.remove("selected");
                } else {
                    numerosSelecionados.push(i);
                    btn.classList.add("selected");
                }
                atualizarBotaoReserva();
            };

            container.appendChild(btn);
        }
    } catch (error) {
        console.error("Erro ao carregar números:", error);
    }
}

const PRECO_POR_NUMERO = 10; // R$ 10,00 por número

function atualizarBotaoReserva() {
    const botao = document.querySelector("button.reservar");
    const qtd = numerosSelecionados.length;
    const total = qtd * PRECO_POR_NUMERO;

    if (qtd === 0) {
        botao.textContent = "Reservar Números Selecionados";
    } else if (qtd === 1) {
        botao.textContent = `Reservar 1 número - R$ ${total},00`;
    } else {
        botao.textContent = `Reservar ${qtd} números - R$ ${total},00`;
    }
}

// Reservar números selecionados com concorrência
async function reservar() {
    if (numerosSelecionados.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Atenção',
            text: "Selecione ao menos um numero!",
            confirmButtonText: 'Ok'
        });

        return
    }

    const nome = document.getElementById("nome").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const vendedor = document.getElementById("vendedor").value;

    if (!nome || !telefone) {
        Swal.fire({
            icon: 'info',
            title: 'Atenção',
            text: "Preencha nome e telefone.",
            confirmButtonText: 'Ok'
        });

        return
    }

    if (!vendedor) {
        Swal.fire({
            icon: 'info',
            title: 'Atenção',
            text: 'Por favor, selecione um vendedor antes de continuar!',
            confirmButtonText: 'OK'
        });

        return;
    }

    Swal.fire({
        title: 'Processando...',
        text: 'Confirmando reserva, aguarde.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rifaDocRef);
            const numeros = doc.data().numeros;

            let numerosFalha = [];

            numerosSelecionados.forEach(num => {
                if (!numeros[num] || numeros[num].status !== "livre") {
                    numerosFalha.push(num);
                }
            });

            if (numerosFalha.length > 0) {
                throw new Error(`Números já vendidos: ${numerosFalha.join(", ")}`);
            }

            let atualizacao = {};
            numerosSelecionados.forEach(num => {
                atualizacao[`numeros.${num}`] = {
                    status: "reservado",
                    comprador: { nome, telefone, vendedor },
                    timestamp: new Date().toISOString()
                };
            });

            transaction.update(rifaDocRef, atualizacao);
        });

        Swal.fire({
            icon: 'success',
            title: 'Reserva confirmada!',
            html: `
                    <p>✅ Você reservou <b>${numerosSelecionados.length}</b> número(s).</p>
                    <p>💰 Valor total: <b>R$ ${(numerosSelecionados.length * 10).toFixed(2).replace('.', ',')}</b></p>
                    <hr>
                    <p><b>1️⃣ Pague via Pix (copia e cola):</b></p>
                    <button  class="btn btn-info shadow-sm rounded-pill" onclick="copiarPix(this)" style="margin-top:5px;padding:10px;cursor:pointer;">
                        📋 Copiar Pix
                    </button>
                    <hr>
                    <p><b>2️⃣ Envie o comprovante do Pix no WhatsApp:</b></p>
                    <a href="https://wa.me/554988945075" target="_blank" 
                    style="display:inline-block;margin-top:5px;padding:8px 15px;background:#25D366;color:white;
                            border-radius:10px;text-decoration:none;font-weight:bold;">
                        📲 (49) 98894-5075
                    </a>
                `,
            confirmButtonText: 'Entendi',
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: true
        });

        numerosSelecionados = [];
        carregarNumeros();
        atualizarBotaoReserva();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message,
            confirmButtonText: 'Ok'
        });
        numerosSelecionados = [];
        carregarNumeros();
    }
}

carregarNumeros();
atualizarBotaoReserva();

const telefoneInput = document.getElementById('telefone');

telefoneInput.addEventListener('input', function (e) {
    let v = e.target.value.replace(/\D/g, ''); // remove tudo que não é número

    if (v.length > 11) v = v.slice(0, 11); // limita a 11 dígitos

    // Formata
    if (v.length > 10) { // celular: (99) 99999-9999
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (v.length > 5) { // fixo: (99) 9999-9999
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (v.length > 0) {
        v = v.replace(/^(\d*)$/, '($1');
    }

    e.target.value = v;
});

function copiarPix(btn) {
    const textarea = document.getElementById("pixCopiaCola");
    const texto = textarea.value;

    // Usa API moderna
    navigator.clipboard.writeText(texto).then(() => {
        btn.innerHTML = '<i class="bi bi-clipboard-check"></i> Copiado!';
        setTimeout(() => {
            btn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar PIX';
        }, 2000);
    }).catch(err => {
        console.error("Erro ao copiar:", err);
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Não foi possível copiar o PIX automaticamente.'
        });
    });
}

