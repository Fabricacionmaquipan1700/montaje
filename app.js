// Al INICIO absoluto de app.js
console.log("app.js: >>> Script execution started.");

// --- CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (SDK v9+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, serverTimestamp, getDoc, writeBatch // writeBatch añadido
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
const vistas = ['vista-entrada', 'vista-visualizacion', 'vista-graficos', 'vista-carga-masiva']; // Añadido 'vista-carga-masiva'
function mostrarVista(idVista) {
    console.log(`app.js: ---> mostrarVista called with idVista = ${idVista}`);
    let foundAndDisplayedSomething = false;
    vistas.forEach(vistaIdEnArray => {
        const el = document.getElementById(vistaIdEnArray);
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
window.mostrarVista = mostrarVista;

// --- CRUD (Create, Read, Update, Delete) ---
formRequerimiento.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("app.js: Form submitted.");
    const idRequerimiento = formRequerimiento.dataset.editingId;

    const requerimiento = {
        fecha: document.getElementById('fecha').value, 
        fechaRecepcionMontaje: document.getElementById('fechaRecepcionMontaje').value || null,
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
            requerimiento.timestamp = serverTimestamp(); // Añadir timestamp solo al crear
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

// Esta función la definimos antes, o puedes ponerla aquí si no está ya
function formatearFechaDesdeYYYYMMDD(fechaString) {
    if (!fechaString || !/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
        return ''; // Devolver vacío si la fecha no es válida o no existe
    }
    const dateObj = new Date(fechaString + 'T00:00:00Z'); // Interpretar como UTC
    if (isNaN(dateObj.getTime())) {
        return 'Fecha Inv.';
    }
    return dateObj.toLocaleDateString('es-CL', { timeZone: 'UTC' }); // Formato Chileno
}
async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    // 'tablaRequerimientosBody' es la variable que definimos antes que apunta al <tbody> de tu tabla
    if (!tablaRequerimientosBody) {
        console.error("app.js: tablaRequerimientosBody no encontrado. No se puede cargar datos.");
        return;
    }
    tablaRequerimientosBody.innerHTML = '<tr><td colspan="16">Cargando...</td></tr>'; // Aumentado colspan a 16 porque añadimos una columna

    try {
        const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        let html = ''; // Aquí vamos a ir construyendo el HTML de las filas

        if (querySnapshot.empty) {
            html = '<tr><td colspan="16">No hay requerimientos registrados.</td></tr>'; // Aumentado colspan
        } else {
            querySnapshot.forEach(docSnap => { // Por cada requerimiento que viene de Firebase...
                const data = docSnap.data(); // 'data' es un objeto con todos los campos del requerimiento

                // Construimos una fila <tr> con varias celdas <td>
                // Cada ${data.nombreDelCampo || ''} toma el valor del campo de Firebase.
                // Si el campo no existe o está vacío, muestra un string vacío '' en lugar de 'undefined' o 'null'.
                // Usamos la función formatearFechaDesdeYYYYMMDD para las fechas.

                html += `
                    <tr data-id="${docSnap.id}">
                        <td>${formatearFechaDesdeYYYYMMDD(data.fecha)}</td>
                        <td>${formatearFechaDesdeYYYYMMDD(data.fechaRecepcionMontaje)}</td>
                        
                        <td>${data.req || ''}</td>
                        <td>${data.nv || ''}</td>
                        <td>${data.canalEntrada || ''}</td>
                        <td>${data.asunto || ''}</td>
                        <td>${data.localidad || ''}</td>
                        <td>${data.cliente || ''}</td>
                        <td>${data.direccion || ''}</td> 
                        <td>${data.tecnico || ''}</td>
                        <td>${data.horario || ''}</td>
                        <td>${data.estatus || ''}</td>
                        <td>${data.tipoEquipo || ''}</td>
                        <td>${data.observacion || ''}</td> 
                        <td>${data.solicitante || ''}</td>
                        <td>
                            <button class="action-button edit" onclick="window.editarRequerimiento('${docSnap.id}')">Editar</button>
                            <button class="action-button delete" onclick="window.eliminarRequerimiento('${docSnap.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
            });
        }
        tablaRequerimientosBody.innerHTML = html; // Finalmente, ponemos todas las filas construidas dentro del <tbody> de la tabla
        console.log("app.js: Requerimientos cargados en tabla.");
    } catch (error) {
        console.error("app.js: Error al cargar requerimientos: ", error);
        tablaRequerimientosBody.innerHTML = '<tr><td colspan="16">Error al cargar datos. Ver consola (F12).</td></tr>'; // Aumentado colspan
    }
}
window.cargarRequerimientos = cargarRequerimientos; // Hacemos global la función si aún no lo está


async function editarRequerimiento(id) {
    console.log(`app.js: editarRequerimiento called for ID: ${id}`);
    try {
        const docRef = doc(db, "requerimientos", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('fecha').value = data.fecha || '';
            document.getElementById('fechaRecepcionMontaje').value = data.fechaRecepcionMontaje || '';
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

// --- LÓGICA DE GRÁFICOS ---
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
    const conteo = data.reduce((acc, curr) => {if(curr.canalEntrada) acc[curr.canalEntrada] = (acc[curr.canalEntrada] || 0) + 1; return acc; }, {});
    const ctx = document.getElementById('graficoCanalEntrada').getContext('2d');
    if (graficoCanal) graficoCanal.destroy();
    graficoCanal = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(conteo), datasets: [{ data: Object.values(conteo), backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#E7E9ED','#FDB45C'] }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top'}}}
    });
}

function generarGraficoEstatus(data) {
    const conteo = data.reduce((acc, curr) => {if(curr.estatus) acc[curr.estatus] = (acc[curr.estatus] || 0) + 1; return acc; }, {});
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

// --- LÓGICA DE CARGA MASIVA ---
const csvFileInput = document.getElementById('csvFile');
const btnProcesarCsv = document.getElementById('btnProcesarCsv');
const cargaMasivaLog = document.getElementById('cargaMasivaLog');

if (btnProcesarCsv) {
    btnProcesarCsv.addEventListener('click', handleFileUpload);
} else {
    // Este log puede aparecer si app.js se carga antes de que el DOM esté completamente listo
    // o si el ID del botón es incorrecto, pero debería funcionar con type="module" y DOMContentLoaded
    console.warn("app.js: Botón 'btnProcesarCsv' no encontrado al configurar listener inicial para carga masiva. Se intentará de nuevo en DOMContentLoaded si es necesario.");
}

function logCargaMasiva(message, isError = false) {
    if (cargaMasivaLog) {
        const p = document.createElement('p');
        p.textContent = message;
        if (isError) {
            p.style.color = 'red';
        }
        cargaMasivaLog.appendChild(p);
        cargaMasivaLog.scrollTop = cargaMasivaLog.scrollHeight;
    }
    if (isError) {
        console.error("Carga Masiva:", message);
    } else {
        console.log("Carga Masiva:", message);
    }
}

async function handleFileUpload() {
    if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
        logCargaMasiva("Por favor, selecciona un archivo CSV primero.", true);
        return;
    }
    const file = csvFileInput.files[0];
    if (file.type !== "text/csv" && !file.name.toLowerCase().endsWith(".csv") && file.type !== "application/vnd.ms-excel") { //Añadido application/vnd.ms-excel
         logCargaMasiva(`Tipo de archivo no soportado: ${file.type}. Por favor, selecciona un archivo con formato CSV (.csv).`, true);
         return;
    }

    if (cargaMasivaLog) cargaMasivaLog.innerHTML = '<p>Procesando archivo...</p>';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",", // <--- FORZAMOS COMA COMO DELIMITADOR
        newline: "",    // <--- Permitir que PapaParse autodetecte saltos de línea (\n, \r, o \r\n)
        dynamicTyping: true,
        transformHeader: function(header) {
            return header.trim(); // Limpiar espacios de las cabeceras
        },
        complete: async function(results) {
            logCargaMasiva(`Archivo CSV leído. Filas de datos encontradas: ${results.data.length}`);

            if (results.meta && results.meta.fields) {
                logCargaMasiva(`Cabeceras detectadas por PapaParse: ${results.meta.fields.join(' | ')}`);
            } else {
                logCargaMasiva("No se pudieron detectar cabeceras con PapaParse.", true);
            }

            if (results.errors.length > 0) {
                logCargaMasiva("Errores/Advertencias durante el parseo del CSV (PapaParse):", true);
                results.errors.forEach(err => {
                     let message = err.message || JSON.stringify(err);
                     // El error "Too many fields" puede ser normal si hay columnas extra al final y no se usa 'fastMode'
                     // Solo lo mostraremos como una advertencia si no es el único tipo de error.
                     if (!message.includes("Too many fields") || results.errors.filter(e => !e.message.includes("Too many fields")).length > 0) {
                        logCargaMasiva(` - Tipo: ${err.type}, Código: ${err.code}, Fila: ${err.row !== undefined ? err.row : 'desconocida'}: ${message}`, true);
                     }
                });
            }

            if (results.data.length === 0) {
                logCargaMasiva("No se encontraron datos válidos en el CSV para procesar.", true);
                return;
            }
            // Pasar las cabeceras que realmente se usaron para crear los objetos de datos.
            // Si results.data[0] existe, Object.keys(results.data[0]) son las cabeceras efectivas.
            const cabecerasEfectivas = results.data.length > 0 ? Object.keys(results.data[0]) : (results.meta.fields || []);
            if (cabecerasEfectivas.length > 0) {
                 logCargaMasiva(`Cabeceras efectivas usadas para los objetos de datos: ${cabecerasEfectivas.join(' | ')}`);
            }

            await procesarYSubirDatos(results.data, cabecerasEfectivas);
        },
        error: function(err, file) {
            logCargaMasiva("Error CRÍTICO al leer el archivo CSV con PapaParse: " + err.message, true);
        }
    });
}
async function procesarYSubirDatosSimple(registros, cabecerasDetectadas) {
    const mapeoCsvAFirestore = {
        // Asegúrate que el orden aquí coincida con el que le dijiste al usuario en index.html
        // Y que estas claves coincidan con las cabeceras de su CSV (después de .trim())
        "FECHA_RECEPCION_MONTAJE": "fechaRecepcionMontaje",
        "FECHA": "fecha", 
        "REQ": "req",
        "NV": "nv",
        "CANAL DE ENTRADA": "canalEntrada",
        "ASUNTO": "asunto",
        "LOCALIDAD": "localidad",
        "CLIENTE": "cliente",
        "DIRECCION": "direccion", // Sin tilde aquí, como lo corregimos antes
        "TECNICO": "tecnico",
        "HORARIO": "horario",
        "ESTATUS": "estatus",
        "TIPO DE EQUIPO": "tipoEquipo",
        "OBSERVACION": "observacion", // Sin tilde aquí
        "SOLICITANTE": "solicitante"
    };

    const registrosParaFirestore = [];
    let erroresDeFormato = 0;

    logCargaMasiva(`Procesando ${registros.length} filas de datos...`);

    for (let i = 0; i < registros.length; i++) {
        const filaCsv = registros[i];
        const nuevoRequerimiento = {};
        let filaValida = true;

        for (const cabeceraCsvEsperada in mapeoCsvAFirestore) {
            const claveFirestore = mapeoCsvAFirestore[cabeceraCsvEsperada];
            let valor = filaCsv[cabeceraCsvEsperada];

            if (valor === undefined) {
                logCargaMasiva(`Advertencia Fila <span class="math-inline">\{i \+ 1\}\: Cabecera CSV "</span>{cabeceraCsvEsperada}" no encontrada. Se usará valor vacío. Datos de fila: ${JSON.stringify(filaCsv).substring(0,100)}`, true);
                valor = "";
            }

            valor = String(valor !== undefined ? valor : "").trim();

            // Validaciones
            if (claveFirestore === "fecha" || claveFirestore === "fechaRecepcionMontaje") {
                if (claveFirestore === "fecha" && (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor))) { // Fecha principal es obligatoria
                    logCargaMasiva(`Error Fila ${i + 1}: <span class="math-inline">\{cabeceraCsvEsperada\} "</span>{valor}" no tiene formato YYYY-MM-DD o está vacía. Se omitirá esta fila.`, true);
                    filaValida = false; break;
                }
                if (claveFirestore === "fechaRecepcionMontaje" && valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) { // Opcional, pero si existe, validar
                    logCargaMasiva(`Error Fila ${i + 1}: <span class="math-inline">\{cabeceraCsvEsperada\} "</span>{valor}" no tiene formato YYYY-MM-DD. Se usará valor vacío para este campo.`, true);
                    valor = ""; // Opcional, así que no invalidamos la fila, solo el campo
                }
            }
            if (claveFirestore === "req" && valor === "") {
                 logCargaMasiva(`Error Fila ${i + 1}: REQ es obligatorio. Se omitirá esta fila.`, true);
                 filaValida = false; break;
            }
            if (claveFirestore === "cliente" && valor === "") {
                 logCargaMasiva(`Error Fila ${i + 1}: CLIENTE es obligatorio. Se omitirá esta fila.`, true);
                 filaValida = false; break;
            }
            nuevoRequerimiento[claveFirestore] = valor;
        }

        if (filaValida) {
            // Asegurarse que los campos de fecha opcionales que quedaron vacíos se guarden como null o no se incluyan
            if (nuevoRequerimiento.fechaRecepcionMontaje === "") {
                nuevoRequerimiento.fechaRecepcionMontaje = null; 
            }
            nuevoRequerimiento.timestamp = serverTimestamp();
            registrosParaFirestore.push(nuevoRequerimiento);
        } else {
            erroresDeFormato++;
        }
    }
    // ... resto de la función procesarYSubirDatosSimple (subida por lotes) sin cambios ...
    if (erroresDeFormato > 0) {
        logCargaMasiva(`${erroresDeFormato} filas contenían errores de formato y fueron omitidas.`);
    }
    if (registrosParaFirestore.length === 0) {
        logCargaMasiva("No hay registros válidos para subir a Firebase después del procesamiento.", true);
        return;
    }

    logCargaMasiva(`Intentando subir ${registrosParaFirestore.length} registros válidos a Firebase...`);
    const tamanoLote = 490;
    let lotesEnviados = 0;
    let registrosSubidos = 0;

    for (let i = 0; i < registrosParaFirestore.length; i += tamanoLote) {
        const loteActual = registrosParaFirestore.slice(i, i + tamanoLote);
        const batch = writeBatch(db);
        loteActual.forEach(registro => {
            const docRef = doc(collection(db, "requerimientos"));
            batch.set(docRef, registro);
        });
        try {
            await batch.commit();
            lotesEnviados++;
            registrosSubidos += loteActual.length;
            logCargaMasiva(`Lote <span class="math-inline">\{lotesEnviados\} enviado con éxito \(</span>{loteActual.length} registros). Total subidos: ${registrosSubidos}`);
        } catch (error) {
            logCargaMasiva(`Error al enviar lote ${lotesEnviados + 1}: ${error.message}`, true);
            console.error("Error en batch commit:", error);
        }
    }
    logCargaMasiva(`Proceso de carga masiva (simple) completado. Total de registros válidos intentados en lotes: ${registrosSubidos}.`);
    if (erroresDeFormato === 0 && registrosSubidos === registrosParaFirestore.length && registrosSubidos > 0) {
         logCargaMasiva("¡Todos los registros válidos fueron subidos exitosamente!", false);
    } else if (registrosSubidos > 0) {
         logCargaMasiva("Algunos registros pudieron no haberse subido o fueron omitidos. Revisa el log.", true);
    }
    if(csvFileInput) csvFileInput.value = "";
}
// --- FIN DE LÓGICA DE CARGA MASIVA ---

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    // Re-intentar obtener elementos de carga masiva si no se encontraron antes (por si acaso)
    if (!btnProcesarCsv && document.getElementById('btnProcesarCsv')) {
        const btn = document.getElementById('btnProcesarCsv');
        if(btn) btn.addEventListener('click', handleFileUpload);
        console.log("app.js: Listener para 'btnProcesarCsv' añadido en DOMContentLoaded.");
    }
    mostrarVista('vista-entrada');
});

console.log("app.js: <<< Script execution finished. Event listeners (potentially) set up.");
