// Al INICIO absoluto de app.js
console.log("app.js: >>> Script execution started.");

// --- CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (SDK v9+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

console.log("app.js: Firebase modules imported.");

// Tu configuración de Firebase (la que me diste)
const firebaseConfig = {
    apiKey: "AIzaSyDKyWnVlkKxQUVdNdIpM1s3YTEXFQyyBC0",
    authDomain: "montaje-14a4f.firebaseapp.com",
    projectId: "montaje-14a4f",
    storageBucket: "montaje-14a4f.firebasestorage.app",
    messagingSenderId: "258283681762",
    appId: "1:258283681762:web:af3adaafb3c322564dabbb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const requerimientosCollectionRef = collection(db, "requerimientos");

console.log("app.js: Firebase initialized.");

// --- ELEMENTOS DEL DOM ---
const formRequerimiento = document.getElementById('formRequerimiento');
const tablaRequerimientosBody = document.querySelector('#tablaRequerimientos tbody');
const vistaEntradaTitulo = document.querySelector('#vista-entrada h2');

console.log("app.js: DOM elements selected (form, table body, titulo). formRequerimiento:", formRequerimiento);


// --- MANEJO DE VISTAS ---
const vistas = ['vista-entrada', 'vista-visualizacion', 'vista-graficos'];
function mostrarVista(idVista) {
    console.log(`app.js: ---> mostrarVista called with idVista = ${idVista}`);
    let foundAndDisplayedSomething = false;
    vistas.forEach(vistaIdEnArray => {
        const el = document.getElementById(vistaIdEnArray);
        // console.log(`app.js: Checking element with ID: ${vistaIdEnArray}, Found:`, el); // Log detallado
        if (el) {
            const shouldDisplay = (vistaIdEnArray === idVista) ? 'block' : 'none';
            el.style.display = shouldDisplay;
            console.log(`app.js: Setting display of #${vistaIdEnArray} to ${shouldDisplay}`);
            if (shouldDisplay === 'block') {
                foundAndDisplayedSomething = true;
            }
        } else {
            console.error(`app.js: !!! CRITICAL: Element with ID '${vistaIdEnArray}' NOT FOUND in HTML!`);
        }
    });
    if (!foundAndDisplayedSomething && vistas.includes(idVista)) {
        console.warn(`app.js: WARNING: mostrarVista was called for '${idVista}', but it seems its element was not found or not set to display:block.`);
    }


    if (idVista === 'vista-visualizacion') {
        console.log("app.js: mostrarVista -> calling cargarRequerimientos()");
        cargarRequerimientos();
    }
    if (idVista === 'vista-graficos') {
        console.log("app.js: mostrarVista -> calling cargarDatosParaGraficos()");
        cargarDatosParaGraficos();
    }
    if (idVista === 'vista-entrada' && formRequerimiento && !formRequerimiento.dataset.editingId) {
        if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Nuevo Requerimiento';
        formRequerimiento.reset();
        console.log("app.js: mostrarVista -> Form reset for 'vista-entrada'.");
    }
}
window.mostrarVista = mostrarVista; // Hacemos la función global

// --- CRUD (Create, Read, Update, Delete) ---
// (El resto de las funciones CRUD como estaban: formRequerimiento.addEventListener, cargarRequerimientos, editarRequerimiento, eliminarRequerimiento)
// Asegúrate que estas funciones también tengan window.nombreFuncion = nombreFuncion si se llaman desde HTML onclick
// Ejemplo: window.editarRequerimiento = editarRequerimiento; y window.eliminarRequerimiento = eliminarRequerimiento;

formRequerimiento.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("app.js: Form submitted.");
    const idRequerimiento = formRequerimiento.dataset.editingId;
    const requerimiento = {
        fecha: document.getElementById('fecha').value,
        req: document.getElementById('req').value,
        nv: document.getElementById('nv').value,
        canalEntrada: document.getElementById('canalEntrada').value,
        asunto: document.getElementById('asunto').value,
        localidad: document.getElementById('localidad').value,
        cliente: document.getElementById('cliente').value,
        direccion: document.getElementById('direccion').value,
        tecnico: document.getElementById('tecnico').value,
        horario: document.getElementById('horario').value,
        estatus: document.getElementById('estatus').value,
        tipoEquipo: document.getElementById('tipoEquipo').value,
        observacion: document.getElementById('observacion').value,
        solicitante: document.getElementById('solicitante').value,
    };

    try {
        if (idRequerimiento) {
            const docRef = doc(db, "requerimientos", idRequerimiento);
            await updateDoc(docRef, requerimiento);
            alert('Requerimiento actualizado con éxito!');
            delete formRequerimiento.dataset.editingId;
            if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Nuevo Requerimiento';
        } else {
            requerimiento.timestamp = serverTimestamp();
            await addDoc(requerimientosCollectionRef, requerimiento);
            alert('Requerimiento guardado con éxito!');
        }
        formRequerimiento.reset();
        mostrarVista('vista-visualizacion');
    } catch (error) {
        console.error("app.js: Error al guardar/actualizar: ", error);
        alert('Error al guardar. Ver consola (F12 en el navegador).');
    }
});

async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    tablaRequerimientosBody.innerHTML = '<tr><td colspan="15">Cargando...</td></tr>';
    try {
        const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        let html = '';
        if (querySnapshot.empty) {
            html = '<tr><td colspan="15">No hay requerimientos registrados.</td></tr>';
        } else {
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                let fechaFormateada = 'N/A';
                if (data.fecha) {
                    const dateObj = new Date(data.fecha + 'T00:00:00Z');
                    if (!isNaN(dateObj)) {
                         fechaFormateada = dateObj.toLocaleDateString('es-CL', { timeZone: 'UTC' });
                    }
                }
                html += `
                    <tr data-id="${docSnap.id}">
                        <td>${fechaFormateada}</td>
                        <td>${data.req || ''}</td><td>${data.nv || ''}</td><td>${data.canalEntrada || ''}</td>
                        <td>${data.asunto || ''}</td><td>${data.localidad || ''}</td><td>${data.cliente || ''}</td>
                        <td>${data.direccion || ''}</td><td>${data.tecnico || ''}</td><td>${data.horario || ''}</td>
                        <td>${data.estatus || ''}</td><td>${data.tipoEquipo || ''}</td><td>${data.observacion || ''}</td>
                        <td>${data.solicitante || ''}</td>
                        <td>
                            <button class="action-button edit" onclick="window.editarRequerimiento('${docSnap.id}')">Editar</button>
                            <button class="action-button delete" onclick="window.eliminarRequerimiento('${docSnap.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
            });
        }
        tablaRequerimientosBody.innerHTML = html;
        console.log("app.js: Requerimientos cargados en tabla.");
    } catch (error) {
        console.error("app.js: Error al cargar requerimientos: ", error);
        tablaRequerimientosBody.innerHTML = '<tr><td colspan="15">Error al cargar datos. Ver consola (F12).</td></tr>';
    }
}
window.cargarRequerimientos = cargarRequerimientos;

async function editarRequerimiento(id) {
    console.log(`app.js: editarRequerimiento called for ID: ${id}`);
    try {
        const docRef = doc(db, "requerimientos", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('fecha').value = data.fecha || '';
            document.getElementById('req').value = data.req || '';
            document.getElementById('nv').value = data.nv || '';
            document.getElementById('canalEntrada').value = data.canalEntrada || '';
            document.getElementById('asunto').value = data.asunto || '';
            document.getElementById('localidad').value = data.localidad || '';
            document.getElementById('cliente').value = data.cliente || '';
            document.getElementById('direccion').value = data.direccion || '';
            document.getElementById('tecnico').value = data.tecnico || '';
            document.getElementById('horario').value = data.horario || '';
            document.getElementById('estatus').value = data.estatus || '';
            document.getElementById('tipoEquipo').value = data.tipoEquipo || '';
            document.getElementById('observacion').value = data.observacion || '';
            document.getElementById('solicitante').value = data.solicitante || '';
            formRequerimiento.dataset.editingId = id;
            if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Editar Requerimiento';
            mostrarVista('vista-entrada');
        } else {
            alert("No se encontró el documento para editar.");
        }
    } catch (error) {
        console.error("app.js: Error al cargar para edición: ", error);
        alert("Error al cargar datos para editar. Ver consola (F12).");
    }
}
window.editarRequerimiento = editarRequerimiento;

async function eliminarRequerimiento(id) {
    console.log(`app.js: eliminarRequerimiento called for ID: ${id}`);
    if (confirm('¿Estás seguro de que quieres eliminar este requerimiento?')) {
        try {
            const docRef = doc(db, "requerimientos", id);
            await deleteDoc(docRef);
            alert('Requerimiento eliminado con éxito!');
            cargarRequerimientos();
        } catch (error) {
            console.error("app.js: Error al eliminar: ", error);
            alert('Error al eliminar. Ver consola (F12).');
        }
    }
}
window.eliminarRequerimiento = eliminarRequerimiento;

// --- LÓGICA DE GRÁFICOS --- (sin cambios en la lógica interna, pero puedes añadir logs si es necesario)
let graficoCanal = null;
let graficoEstatus = null;
let graficoTecnicos = null;

async function cargarDatosParaGraficos() {
    console.log("app.js: cargarDatosParaGraficos called.");
    try {
        const querySnapshot = await getDocs(requerimientosCollectionRef);
        const requerimientos = [];
        querySnapshot.forEach(docSnap => { requerimientos.push(docSnap.data()); });
        generarGraficoCanalEntrada(requerimientos);
        generarGraficoEstatus(requerimientos);
        generarGraficoTecnicos(requerimientos);
        console.log("app.js: Gráficos generados/actualizados.");
    } catch (error) {
        console.error("app.js: Error al cargar datos para gráficos: ", error);
    }
}

function generarGraficoCanalEntrada(data) {
    const conteo = data.reduce((acc, curr) => { acc[curr.canalEntrada] = (acc[curr.canalEntrada] || 0) + 1; return acc; }, {});
    const ctx = document.getElementById('graficoCanalEntrada').getContext('2d');
    if (graficoCanal) graficoCanal.destroy();
    graficoCanal = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(conteo), datasets: [{ data: Object.values(conteo), backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#E7E9ED','#FDB45C'] }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top'}}}
    });
}

function generarGraficoEstatus(data) {
    const conteo = data.reduce((acc, curr) => { acc[curr.estatus] = (acc[curr.estatus] || 0) + 1; return acc; }, {});
    const ctx = document.getElementById('graficoEstatus').getContext('2d');
    if (graficoEstatus) graficoEstatus.destroy();
    graficoEstatus = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(conteo), datasets: [{ label: 'Estatus', data: Object.values(conteo), backgroundColor: ['#FF9F40','#FFCD56','#4BC0C0','#36A2EB'] }] },
        options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false }}}
    });
}

function generarGraficoTecnicos(data) {
    const conteo = data.reduce((acc, curr) => { if (curr.tecnico && curr.tecnico.trim() !== "") { acc[curr.tecnico] = (acc[curr.tecnico] || 0) + 1; } return acc; }, {});
    const ordenados = Object.entries(conteo).sort(([,a],[,b]) => b-a).slice(0, 5);
    const ctx = document.getElementById('graficoTecnicos').getContext('2d');
    if (graficoTecnicos) graficoTecnicos.destroy();
    graficoTecnicos = new Chart(ctx, {
        type: 'bar',
        data: { labels: ordenados.map(e => e[0]), datasets: [{ label: 'Técnicos (Top 5)', data: ordenados.map(e => e[1]), backgroundColor: ['#66CCCC','#FF6B6B','#FFD166','#06D6A0','#118AB2'] }] },
        options: { responsive: true, maintainAspectRatio: true, indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false }}}
    });
}


// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    mostrarVista('vista-entrada');
});

console.log("app.js: <<< Script execution finished. Event listeners (potentially) set up.");
