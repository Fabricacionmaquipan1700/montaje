// --- IMPORTS Y CONFIGURACIÓN DE FIREBASE ---
console.log("app.js: >>> Script execution started.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, 
    orderBy, query, serverTimestamp, getDoc, where, collectionGroup, writeBatch,
    limit // <--- ¡AÑADE ESTO AQUÍ!
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Y la importación para initializeApp es separada:
// import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";

// Tu configuración de Firebase
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

// LISTA DE TÉCNICOS PREDEFINIDA (¡Actualiza esta lista con tus técnicos reales!)
const LISTA_TECNICOS_PREDEFINIDOS = [
    "Alejandro Arias", "Alejandro Mena", "Alejandro Robles", "Bastian Garrido", "Beato Paula", 
    "Claudio López", "Diego Valderas", "Enrico Ramírez", "Enzo Rodríguez", "Felipe Santos", 
    "Fredy Gallardo", "Gabriel Cifuentes", "Gerardo Calderón", "Héctor Loaiza", "Henry Zamora", 
    "Hugo Morales", "Jonathan Huichalaf", "José Bravo", "José Cea", "José Luis González", 
    "José Riquelme", "Juan Carlos Godoy", "Juan González", "Juan Manuel Chandía", "Juan Rojas", 
    "Julián Herrera", "Karlo Zambrano", "Manuel Urrutia", "Manuel Venegas", "Marcelo Riveros", 
    "Marco Ayala", "Marco López", "Octavio Henríquez", "Óscar Jiménez", "Pablo Olivares", 
    "Rogelio Lagos", "Sergio Ibañez", "Sergio Valencia", "Sergio Viloria", "Víctor Chávez", 
    "Víctor Valdebenito", "Externo",
    "TECNICO SIN ASIGNAR"
].sort();
console.log("app.js: Lista de técnicos predefinidos cargada.");

console.log("app.js: Firebase initialized.");

// --- ELEMENTOS DEL DOM ---
const formRequerimiento = document.getElementById('formRequerimiento');
const tablaRequerimientosBody = document.querySelector('#tablaRequerimientos tbody');
const vistaEntradaTitulo = document.querySelector('#vista-entrada-requerimiento h2');

// Modal de Programaciones
const modalProgramaciones = document.getElementById('modalGestionProgramaciones');
const modalTituloRequerimiento = document.getElementById('modalTituloRequerimiento');
const formAddProgramacion = document.getElementById('formAddProgramacion');
const listaProgramacionesContainer = document.getElementById('listaProgramacionesContainer');
const currentRequerimientoIdInput = document.getElementById('currentRequerimientoId');

console.log("app.js: DOM elements selected.");

// --- MANEJO DE VISTAS ---
const vistas = ['vista-entrada-requerimiento', 'vista-visualizacion', 'vista-planificacion', 'vista-graficos'];
let calendarioFullCalendar = null;
let todosLosRecursosTecnicos = [];

function mostrarVista(idVista) {
    console.log(`app.js: ---> mostrarVista called with idVista = ${idVista}`);
    vistas.forEach(vistaIdEnArray => {
        const el = document.getElementById(vistaIdEnArray);
        if (el) {
            el.style.display = (vistaIdEnArray === idVista) ? 'block' : 'none';
        } else {
            console.warn(`app.js: Elemento de vista con ID '${vistaIdEnArray}' no encontrado.`);
        }
    });

    if (idVista === 'vista-visualizacion') {
        cargarRequerimientos();
    }
    if (idVista === 'vista-graficos') {
        cargarDatosParaGraficosEstadisticas();
    }
    if (idVista === 'vista-planificacion') {
        inicializarOActualizarCalendario();
    }
    if (idVista === 'vista-entrada-requerimiento' && formRequerimiento && !formRequerimiento.dataset.editingId) {
        if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
        formRequerimiento.reset();
    }
}
window.mostrarVista = mostrarVista;

// --- FUNCIONES AUXILIARES ---
function formatearFechaDesdeYYYYMMDD(fechaString) {
    if (!fechaString || !/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
        return '';
    }
    const dateObj = new Date(fechaString + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) return 'Fecha Inv.';
    return dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

// --- CRUD DE REQUERIMIENTOS (SERVICIOS) ---
if (formRequerimiento) {
    formRequerimiento.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idRequerimiento = formRequerimiento.dataset.editingId;

        const requerimientoData = {
            fechaRecepcion: document.getElementById('fechaRecepcion').value,
            req: document.getElementById('req').value.trim(),
            nv: document.getElementById('nv').value.trim(),
            canalEntrada: document.getElementById('canalEntrada').value,
            asunto: document.getElementById('asunto').value.trim(),
            localidad: document.getElementById('localidad').value.trim(),
            cliente: document.getElementById('cliente').value.trim(),
            direccion: document.getElementById('direccion').value.trim(),
            estatusRequerimiento: document.getElementById('estatusRequerimiento').value,
            tipoEquipo: document.getElementById('tipoEquipo').value.trim(),
            observacionRequerimiento: document.getElementById('observacionRequerimiento').value.trim(),
            solicitante: document.getElementById('solicitante').value.trim(),
        };

        if (!requerimientoData.req || !requerimientoData.cliente || !requerimientoData.fechaRecepcion) {
            alert("Los campos Fecha de Recepción, N° REQ/OT y Cliente son obligatorios.");
            return;
        }

        try {
            if (idRequerimiento) {
                const docRef = doc(db, "requerimientos", idRequerimiento);
                await updateDoc(docRef, requerimientoData);
                alert('Servicio actualizado con éxito!');
                delete formRequerimiento.dataset.editingId;
            } else {
                requerimientoData.timestamp = serverTimestamp();
                // const docRef = // No necesitamos la referencia aquí si no abrimos el modal automáticamente
                await addDoc(requerimientosCollectionRef, requerimientoData);
                alert('Servicio guardado con éxito! Ahora puedes añadir programaciones desde "Ver Servicios".');
            }
            formRequerimiento.reset();
            if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
            mostrarVista('vista-visualizacion');
        } catch (error) {
            console.error("Error al guardar/actualizar servicio:", error);
            alert('Error al guardar el servicio. Ver consola.');
        }
    });
} else {
    console.warn("Elemento formRequerimiento no encontrado al cargar la página.");
}


async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    if (!tablaRequerimientosBody) {
        console.error("Error: El elemento tablaRequerimientosBody no fue encontrado en el DOM.");
        return;
    }
    tablaRequerimientosBody.innerHTML = `<tr><td colspan="9">Cargando...</td></tr>`;

    try {
        const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        let html = '';
        if (querySnapshot.empty) {
            html = `<tr><td colspan="9">No hay servicios registrados.</td></tr>`;
        } else {
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                html += `
                    <tr data-id="${docSnap.id}">
                        <td>${formatearFechaDesdeYYYYMMDD(data.fechaRecepcion)}</td>
                        <td>${data.req || ''}</td>
                        <td>${data.cliente || ''}</td>
                        <td>${data.asunto ? (data.asunto.length > 30 ? data.asunto.substring(0,27)+'...' : data.asunto) : ''}</td>
                        <td>${data.localidad || ''}</td>
                        <td>${data.estatusRequerimiento || ''}</td>
                        <td>${formatearFechaDesdeYYYYMMDD(data.fechaTerminoServicio)}</td> 
                        <td>${data.solicitante || ''}</td>
                        <td>
                            <button class="action-button edit" onclick="window.editarRequerimiento('${docSnap.id}')">Editar</button>
                            <button class="action-button delete" onclick="window.eliminarRequerimiento('${docSnap.id}')">Eliminar</button>
                        </td>
                        <td>
                            <button class="action-button" onclick="window.gestionarProgramaciones('${docSnap.id}', '${data.req || 'Servicio'}')">Programar</button>
                        </td>
                    </tr>
                `;
            });
        }
        tablaRequerimientosBody.innerHTML = html;
    } catch (error) {
        console.error("Error al cargar requerimientos:", error);
        tablaRequerimientosBody.innerHTML = `<tr><td colspan="9">Error al cargar datos.</td></tr>`;
    }
}
window.cargarRequerimientos = cargarRequerimientos;

async function editarRequerimiento(id) {
    const docRef = doc(db, "requerimientos", id);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (formRequerimiento) {
                formRequerimiento.reset();
                document.getElementById('fechaRecepcion').value = data.fechaRecepcion || '';
                document.getElementById('req').value = data.req || '';
                document.getElementById('nv').value = data.nv || '';
                document.getElementById('canalEntrada').value = data.canalEntrada || 'Telefono';
                document.getElementById('asunto').value = data.asunto || '';
                document.getElementById('localidad').value = data.localidad || '';
                document.getElementById('cliente').value = data.cliente || '';
                document.getElementById('direccion').value = data.direccion || '';
                document.getElementById('estatusRequerimiento').value = data.estatusRequerimiento || 'Pendiente';
                document.getElementById('tipoEquipo').value = data.tipoEquipo || '';
                document.getElementById('observacionRequerimiento').value = data.observacionRequerimiento || '';
                document.getElementById('solicitante').value = data.solicitante || '';
                
                formRequerimiento.dataset.editingId = id;
                if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = `Editando Servicio REQ: ${data.req || id}`;
                mostrarVista('vista-entrada-requerimiento');
            } else {
                 alert("Error: Formulario de requerimiento no encontrado.");
            }
        } else {
            alert("Documento no encontrado para editar.");
        }
    } catch(error) {
        console.error("Error al obtener documento para editar:", error);
        alert("Error al cargar datos para editar.");
    }
}
window.editarRequerimiento = editarRequerimiento;

function filtrarTablaServicios() {
    const input = document.getElementById('buscadorServicios');
    const filtro = input.value.toUpperCase();
    const tabla = document.getElementById('tablaRequerimientos');
    const filas = tabla.getElementsByTagName('tr');

    // Empezar desde 1 para saltar la fila de cabeceras (<tr><th>...</th></tr>)
    for (let i = 1; i < filas.length; i++) {
        const filaActual = filas[i];
        const celdas = filaActual.getElementsByTagName('td');
        let visible = false;
        for (let j = 0; j < celdas.length; j++) { // Iterar sobre todas las celdas EXCEPTO las de acciones
            // No buscar en la columna de botones de "Acciones" ni "Programaciones"
            // Asumiendo que estas son las últimas 2 columnas
            if (j < celdas.length - 2) { 
                const celda = celdas[j];
                if (celda) {
                    const textoCelda = celda.textContent || celda.innerText;
                    if (textoCelda.toUpperCase().indexOf(filtro) > -1) {
                        visible = true;
                        break; // Si una celda coincide, la fila es visible
                    }
                }
            }
        }
        filaActual.style.display = visible ? "" : "none";
    }
}
// Para que la función sea accesible desde el onkeyup en el HTML
window.filtrarTablaServicios = filtrarTablaServicios;

async function eliminarRequerimiento(id) {
    if (confirm('¿Estás seguro de eliminar este servicio y TODAS sus programaciones asociadas? Esta acción no se puede deshacer.')) {
        try {
            console.warn(`Eliminando requerimiento ${id}. Sus programaciones quedarán huérfanas si no se eliminan por separado (requiere Cloud Function para eliminación en cascada).`);
            await deleteDoc(doc(db, "requerimientos", id));
            alert('Servicio eliminado con éxito. (Las programaciones individuales no se eliminan automáticamente con esta acción).');
            cargarRequerimientos();
        } catch (error) {
            console.error("Error al eliminar servicio:", error);
            alert('Error al eliminar el servicio.');
        }
    }
}
window.eliminarRequerimiento = eliminarRequerimiento;


// --- GESTIÓN DE PROGRAMACIONES (MODAL) ---
function poblarCheckboxesTecnicos() {
    const container = document.getElementById('modalTecnicosCheckboxContainer');
    if (!container) {
        console.error("Contenedor de checkboxes para técnicos ('modalTecnicosCheckboxContainer') no encontrado.");
        return;
    }
    container.innerHTML = ''; 

    if (!LISTA_TECNICOS_PREDEFINIDOS || LISTA_TECNICOS_PREDEFINIDOS.length === 0) {
        container.innerHTML = '<p>No hay técnicos predefinidos en la lista.</p>';
        return;
    }

    LISTA_TECNICOS_PREDEFINIDOS.forEach(tecnico => {
        const labelEl = document.createElement('label');
        const checkboxEl = document.createElement('input');
        
        checkboxEl.type = 'checkbox';
        checkboxEl.name = 'modalTecnicos'; 
        checkboxEl.value = tecnico;
        const tecnicoIdSanitized = tecnico.replace(/[^a-zA-Z0-9-_]/g, '');
        checkboxEl.id = `tec-check-${tecnicoIdSanitized}-${Math.random().toString(36).substr(2, 5)}`;

        labelEl.appendChild(checkboxEl);
        labelEl.appendChild(document.createTextNode(` ${tecnico}`));
        labelEl.htmlFor = checkboxEl.id; 
        container.appendChild(labelEl);
    });
    console.log("Checkboxes de técnicos poblados en el modal.");
}

function abrirModalProgramaciones(requerimientoId, reqNombre) {
    if (!currentRequerimientoIdInput || !modalTituloRequerimiento || !formAddProgramacion || !modalProgramaciones || !listaProgramacionesContainer) {
        console.error("Error: Elementos del modal de programaciones no encontrados en el DOM.");
        alert("Error al abrir el gestor de programaciones. Faltan elementos en la página.");
        return;
    }
    currentRequerimientoIdInput.value = requerimientoId;
    modalTituloRequerimiento.textContent = `Gestionar Programaciones para REQ: ${reqNombre}`;
    formAddProgramacion.reset(); 
    
    document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked').forEach(cb => {
        cb.checked = false;
    });
    
    poblarCheckboxesTecnicos(); 

    cargarProgramacionesExistentes(requerimientoId);
    modalProgramaciones.style.display = 'block';
}
window.gestionarProgramaciones = abrirModalProgramaciones;

function cerrarModalProgramaciones() {
    if(modalProgramaciones) modalProgramaciones.style.display = 'none';
}
window.cerrarModalProgramaciones = cerrarModalProgramaciones;

if (formAddProgramacion) {
    formAddProgramacion.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requerimientoId = currentRequerimientoIdInput.value;
        if (!requerimientoId) {
            alert("Error: ID de requerimiento no encontrado.");
            return;
        }

        const checkboxesTecnicos = document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked');
        const tecnicosAsignados = Array.from(checkboxesTecnicos).map(cb => cb.value);

        if (tecnicosAsignados.length === 0) {
            alert("Debe seleccionar al menos un técnico.");
            return;
        }

        const programacionData = {
            fechaProgramada: document.getElementById('modalFechaProgramada').value,
            horaInicio: document.getElementById('modalHoraInicio').value,
            horaFin: document.getElementById('modalHoraFin').value,
            tipoTarea: document.getElementById('modalTipoTarea').value.trim(),
            tecnicosAsignados: tecnicosAsignados,
            estadoProgramacion: document.getElementById('modalEstadoProgramacion').value,
            notasProgramacion: document.getElementById('modalNotasProgramacion').value.trim(),
            timestampCreacion: serverTimestamp()
        };

        if (!programacionData.fechaProgramada || !programacionData.horaInicio || !programacionData.horaFin || !programacionData.tipoTarea) {
            alert("Fecha, Hora Inicio, Hora Fin y Tipo de Tarea son obligatorios para la programación.");
            return;
        }
        if (programacionData.horaFin <= programacionData.horaInicio) {
            alert("La Hora Fin debe ser posterior a la Hora Inicio.");
            return;
        }

        try {
            const programacionesRef = collection(db, "requerimientos", requerimientoId, "programaciones");
            await addDoc(programacionesRef, programacionData);
            alert('Programación guardada con éxito!');
            formAddProgramacion.reset();
            document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked').forEach(cb => {
                cb.checked = false;
            });
            cargarProgramacionesExistentes(requerimientoId);
        } catch (error) {
            console.error("Error al guardar programación:", error);
            alert('Error al guardar la programación.');
        }
    });
} else {
    console.warn("Elemento formAddProgramacion no encontrado al cargar la página.");
}

async function cargarProgramacionesExistentes(requerimientoId) {
    if (!listaProgramacionesContainer) {
        console.error("Error: listaProgramacionesContainer no encontrado.");
        return;
    }
    listaProgramacionesContainer.innerHTML = '<p>Cargando programaciones...</p>';
    
    const programacionesRef = collection(db, "requerimientos", requerimientoId, "programaciones");
    const q = query(programacionesRef, orderBy("timestampCreacion", "desc"));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            listaProgramacionesContainer.innerHTML = '<p>No hay programaciones para este servicio.</p>';
        } else {
            let html = '<ul>';
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                html += `
                    <li>
                        <div>
                            <strong>${formatearFechaDesdeYYYYMMDD(data.fechaProgramada)}</strong> (${data.horaInicio || ''} - ${data.horaFin || ''})<br>
                            <strong>Tarea:</strong> ${data.tipoTarea || 'N/A'}<br>
                            <strong>Técnicos:</strong> ${data.tecnicosAsignados ? data.tecnicosAsignados.join(', ') : 'N/A'}<br>
                            <strong>Estado:</strong> ${data.estadoProgramacion || 'N/A'}<br>
                            ${data.notasProgramacion ? `<strong>Notas:</strong> ${data.notasProgramacion}<br>` : ''}
                        </div>
                        <button class="action-button delete" onclick="window.eliminarProgramacion('${requerimientoId}', '${docSnap.id}')">X</button>
                    </li>
                `;
            });
            html += '</ul>';
            listaProgramacionesContainer.innerHTML = html;
        }
    } catch (error) {
        console.error("Error cargando programaciones:", error);
        listaProgramacionesContainer.innerHTML = '<p>Error al cargar programaciones.</p>';
    }
}

async function eliminarProgramacion(requerimientoId, programacionId) {
    if (confirm('¿Estás seguro de eliminar esta programación?')) {
        try {
            const programacionDocRef = doc(db, "requerimientos", requerimientoId, "programaciones", programacionId);
            await deleteDoc(programacionDocRef);
            alert("Programación eliminada.");
            cargarProgramacionesExistentes(requerimientoId);
        } catch (error) {
            console.error("Error al eliminar programación:", error);
            alert("Error al eliminar programación.");
        }
    }
}
window.eliminarProgramacion = eliminarProgramacion;

// --- LÓGICA DE GRÁFICOS (ESTADÍSTICAS) ---
let graficoEstatusReq = null;
let graficoCanal = null;

// Variables globales para los nuevos gráficos (cerca de las otras de gráficos)
let graficoTiempo1raProg = null;
let graficoTiempoTotal = null;

// Función auxiliar para calcular diferencia en días
function diferenciaEnDias(fechaInicioStr, fechaFinStr) {
    if (!fechaInicioStr || !fechaFinStr) return null;
    const inicio = new Date(fechaInicioStr + 'T00:00:00Z'); // Asegurar UTC para evitar problemas de zona
    const fin = new Date(fechaFinStr + 'T00:00:00Z');
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null;
    const diffTiempo = fin.getTime() - inicio.getTime();
    if (diffTiempo < 0) return null; // Fecha fin no puede ser antes que inicio para este cálculo
    return Math.ceil(diffTiempo / (1000 * 3600 * 24)); // Math.ceil para redondear hacia arriba
}


async function cargarDatosParaGraficosEstadisticas() {
    console.log("app.js: cargarDatosParaGraficosEstadisticas called.");
    try {
        const requerimientosSnapshot = await getDocs(query(requerimientosCollectionRef, orderBy("timestamp", "desc")));
        const dataParaGraficos = [];

        for (const reqDoc of requerimientosSnapshot.docs) {
            const reqData = reqDoc.data();
            reqData.id = reqDoc.id; // Guardar el ID por si lo necesitamos

            // Obtener la primera programación para este requerimiento
            const progRef = collection(db, "requerimientos", reqDoc.id, "programaciones");
            const qPrimeraProg = query(progRef, orderBy("fechaProgramada", "asc"), orderBy("timestampCreacion", "asc"), limit(1)); // limit(1) no está en SDK v9 web, quitarlo. Ordenar y tomar el primero.
            // Corrección: Firestore web SDK no soporta limit(1) directamente en query.
            // Haremos el query y tomaremos el primer documento.
            
            let primeraFechaProgramada = null;
            try {
                const primerasProgSnapshot = await getDocs(qPrimeraProg);
                if (!primerasProgSnapshot.empty) {
                    primeraFechaProgramada = primerasProgSnapshot.docs[0].data().fechaProgramada;
                }
            } catch (e) {
                console.warn(`No se pudo obtener programaciones para ${reqData.req} o no tiene: ${e.message}`);
            }


            dataParaGraficos.push({
                ...reqData,
                primeraFechaProgramada: primeraFechaProgramada
            });
        }

        console.log("Datos preparados para gráficos:", dataParaGraficos);

        // --- Gráfico por Estatus de Requerimiento (como estaba) ---
        const conteoEstatus = dataParaGraficos.reduce((acc, curr) => {
            if(curr.estatusRequerimiento) acc[curr.estatusRequerimiento] = (acc[curr.estatusRequerimiento] || 0) + 1;
            return acc;
        }, {});
        const ctxEstatus = document.getElementById('graficoEstatusRequerimiento')?.getContext('2d');
        if (ctxEstatus) {
            if (graficoEstatusReq) graficoEstatusReq.destroy();
            graficoEstatusReq = new Chart(ctxEstatus, { /* ...configuración igual que antes... */ 
                type: 'pie',
                data: {
                    labels: Object.keys(conteoEstatus),
                    datasets: [{ data: Object.values(conteoEstatus), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#27ae60', '#f39c12'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top'}}}
            });
        }

        // --- Gráfico por Canal de Entrada (como estaba) ---
        const conteoCanales = dataParaGraficos.reduce((acc, curr) => {
            if(curr.canalEntrada) acc[curr.canalEntrada] = (acc[curr.canalEntrada] || 0) + 1;
            return acc;
        }, {});
        const ctxCanal = document.getElementById('graficoCanalEntrada')?.getContext('2d');
        if (ctxCanal) {
            if (graficoCanal) graficoCanal.destroy();
            graficoCanal = new Chart(ctxCanal, { /* ...configuración igual que antes... */ 
                type: 'bar',
                data: {
                    labels: Object.keys(conteoCanales),
                    datasets: [{ label: 'Servicios por Canal', data: Object.values(conteoCanales), backgroundColor: '#36A2EB' }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true}}, plugins: { legend: { display: false }}}
            });
        }

        // --- NUEVO GRÁFICO 1: Tiempo Promedio Recepción a 1ra Programación ---
        const tiemposRecepcionAProgramacion = [];
        dataParaGraficos.forEach(req => {
            if (req.fechaRecepcion && req.primeraFechaProgramada) {
                const diff = diferenciaEnDias(req.fechaRecepcion, req.primeraFechaProgramada);
                if (diff !== null && diff >= 0) { // Solo considerar si la programación es después o el mismo día de la recepción
                    tiemposRecepcionAProgramacion.push(diff);
                }
            }
        });

        const ctxTiempo1Prog = document.getElementById('graficoTiempoPrimeraProgramacion')?.getContext('2d');
        if (ctxTiempo1Prog) {
            if (graficoTiempo1raProg) graficoTiempo1raProg.destroy();
            let promedioTiempo1Prog = 0;
            if (tiemposRecepcionAProgramacion.length > 0) {
                promedioTiempo1Prog = tiemposRecepcionAProgramacion.reduce((a, b) => a + b, 0) / tiemposRecepcionAProgramacion.length;
            }
            // Podríamos hacer un histograma o simplemente mostrar el promedio
            // Por simplicidad, un gráfico de barras con una sola barra para el promedio
            graficoTiempo1raProg = new Chart(ctxTiempo1Prog, {
                type: 'bar',
                data: {
                    labels: ['Promedio (días)'],
                    datasets: [{
                        label: 'Tiempo Recepción a 1ra Programación',
                        data: [promedioTiempo1Prog.toFixed(1)], // Mostrar con 1 decimal
                        backgroundColor: ['#FF9F40']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true, title: { display: true, text: 'Días Promedio' }}}, plugins: { legend: { display: false }}}
            });
        }

        // --- NUEVO GRÁFICO 2: Tiempo Promedio Recepción a Término Servicio ---
        const tiemposRecepcionATermino = [];
        dataParaGraficos.forEach(req => {
            // Solo considerar si el servicio tiene estatus "Resuelto" y tiene fecha de término
            if (req.estatusRequerimiento === 'Resuelto' && req.fechaRecepcion && req.fechaTerminoServicio) {
                const diff = diferenciaEnDias(req.fechaRecepcion, req.fechaTerminoServicio);
                 if (diff !== null && diff >= 0) {
                    tiemposRecepcionATermino.push(diff);
                }
            }
        });
        const ctxTiempoTotal = document.getElementById('graficoTiempoTotalServicio')?.getContext('2d');
        if (ctxTiempoTotal) {
            if (graficoTiempoTotal) graficoTiempoTotal.destroy();
            let promedioTiempoTotal = 0;
            if (tiemposRecepcionATermino.length > 0) {
                promedioTiempoTotal = tiemposRecepcionATermino.reduce((a, b) => a + b, 0) / tiemposRecepcionATermino.length;
            }
             graficoTiempoTotal = new Chart(ctxTiempoTotal, {
                type: 'bar',
                data: {
                    labels: ['Promedio (días)'],
                    datasets: [{
                        label: 'Tiempo Recepción a Término (Serv. Resueltos)',
                        data: [promedioTiempoTotal.toFixed(1)],
                        backgroundColor: ['#4BC0C0']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true, title: { display: true, text: 'Días Promedio' }}}, plugins: { legend: { display: false }}}
            });
        }

    } catch (error) {
        console.error("Error al cargar datos para gráficos de estadísticas:", error);
    }
}

// --- LÓGICA DEL CALENDARIO ---
// (Esta es la versión que intenta usar resourceTimeGridDay, etc.)
// (Asegúrate de que los plugins de FullCalendar estén correctamente enlazados en index.html)
// --- LÓGICA DEL CALENDARIO (VERSIÓN CON VISTAS ESTÁNDAR - SIN RECURSOS) ---
async function inicializarOActualizarCalendario() {
    console.log("CALENDARIO: Iniciando inicializarOActualizarCalendario (Vistas Estándar)...");
    const calendarEl = document.getElementById('calendarioFullCalendar');
    if (!calendarEl) {
        console.error("CALENDARIO: Elemento #calendarioFullCalendar NO encontrado en el DOM.");
        return;
    }

    calendarEl.innerHTML = '<p>Cargando calendario y programaciones...</p>';

    if (!FullCalendar) {
        console.error("CALENDARIO: FullCalendar no está definido. Revisa la etiqueta <script> en index.html.");
        calendarEl.innerHTML = "<p>Error: Librería FullCalendar no cargada.</p>";
        return;
    }
    console.log("CALENDARIO: FullCalendar está definido.");

    const programacionesParaEventos = [];
    try {
        console.log("CALENDARIO: Intentando obtener programaciones desde Firestore...");
        const qProgramaciones = query(collectionGroup(db, 'programaciones'), orderBy('timestampCreacion', 'desc'));
        const snapshotProgramaciones = await getDocs(qProgramaciones);
        console.log(`CALENDARIO: Se encontraron ${snapshotProgramaciones.docs.length} documentos de programaciones.`);

        if (snapshotProgramaciones.empty) {
            console.log("CALENDARIO: No se encontraron programaciones en la base de datos.");
        }

        for (const progDoc of snapshotProgramaciones.docs) {
            const progData = progDoc.data();
            const requerimientoRef = progDoc.ref.parent.parent;
            let reqDataParaTitulo = { req: '?', cliente: '?' };

            console.log(`CALENDARIO: Procesando programación ID: ${progDoc.id}, Fecha: ${progData.fechaProgramada}`);

            if (requerimientoRef) {
                try {
                    const reqSnap = await getDoc(requerimientoRef);
                    if (reqSnap.exists()) {
                        const rData = reqSnap.data();
                        reqDataParaTitulo.req = rData.req || '?';
                        reqDataParaTitulo.cliente = rData.cliente || '?';
                    } else {
                        console.warn(`CALENDARIO: Documento de requerimiento padre no encontrado para programación ${progDoc.id}`);
                    }
                } catch (errGetParent) {
                    console.error(`CALENDARIO: Error obteniendo documento padre para programación ${progDoc.id}:`, errGetParent);
                }
            } else {
                 console.warn(`CALENDARIO: No se pudo obtener la referencia al requerimiento padre para programación ${progDoc.id}`);
            }
            
            let startDateTime, endDateTime;
            if (progData.fechaProgramada && progData.horaInicio) {
                startDateTime = `${progData.fechaProgramada}T${progData.horaInicio}`;
            } else { 
                console.warn(`CALENDARIO: Programación ${progDoc.id} con datos de fecha/hora incompletos. Omitiendo.`);
                continue; 
            }

            if (progData.fechaProgramada && progData.horaFin) {
                endDateTime = `${progData.fechaProgramada}T${progData.horaFin}`;
            } else { 
                console.warn(`CALENDARIO: Programación ${progDoc.id} sin horaFin. Asumiendo 1 hora de duración.`);
                try {
                    const startDateObj = new Date(startDateTime);
                    if(isNaN(startDateObj.getTime())) throw new Error("Fecha de inicio inválida para calcular fin");
                    startDateObj.setHours(startDateObj.getHours() + 1);
                    endDateTime = startDateObj.toISOString().split('.')[0]; 
                } catch (e) {
                     console.error(`CALENDARIO: Error calculando horaFin para ${progDoc.id}`, e);
                     endDateTime = startDateTime; 
                }
            }
            
            const tecnicosTexto = progData.tecnicosAsignados && progData.tecnicosAsignados.length > 0 ?
                                  progData.tecnicosAsignados.join(', ') : 'S/A';

            programacionesParaEventos.push({
                id: progDoc.id, 
                requerimientoId: requerimientoRef ? requerimientoRef.id : null,
                title: `REQ:${reqDataParaTitulo.req} (${reqDataParaTitulo.cliente || ''}) - ${progData.tipoTarea || 'Tarea'} [Téc: ${tecnicosTexto}]`,
                start: startDateTime,
                end: endDateTime,
                extendedProps: {
                    tecnicosOriginales: progData.tecnicosAsignados || [], 
                    estado: progData.estadoProgramacion || '',
                    notas: progData.notasProgramacion || '',
                    reqNombre: reqDataParaTitulo.req,
                    clienteNombre: reqDataParaTitulo.cliente,
                    tipoTareaOriginal: progData.tipoTarea
                },
            });
        }
        
        console.log(`CALENDARIO: Se procesaron ${programacionesParaEventos.length} eventos para el calendario.`);

    } catch (error) {
        console.error("CALENDARIO: Error obteniendo o procesando programaciones de Firestore:", error);
        if (calendarEl) {
             calendarEl.innerHTML = "<p>Error al cargar datos para el calendario. Revisa la consola (F12).</p>";
        }
        if (error.message && error.message.toLowerCase().includes("index")) {
            alert("Error de Firestore: El índice necesario para el calendario aún no está listo o falta. Por favor, créalo usando el enlace que aparece en la consola y espera a que se habilite.");
        }
        return; 
    }

    if (calendarioFullCalendar) {
        console.log("CALENDARIO: Destruyendo calendario existente...");
        calendarioFullCalendar.destroy();
        calendarioFullCalendar = null;
    }
    
    try {
        console.log("CALENDARIO: Creando nueva instancia de FullCalendar (Vistas Estándar).");
        calendarioFullCalendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es',
            initialView: 'timeGridWeek', // Usamos vistas estándar
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' // Vistas estándar
            },
            views: { 
                timeGridDay: { buttonText: 'Día' },
                timeGridWeek: { buttonText: 'Semana' },
                dayGridMonth: { buttonText: 'Mes' },
                listWeek: { buttonText: 'Lista' }
            },
            editable: false, 
            selectable: true, 
            events: programacionesParaEventos,
            contentHeight: 'auto',
            nowIndicator: true,
            slotEventOverlap: false, 

            eventClick: function(info) {
                const evento = info.event;
                const props = evento.extendedProps;
                alert(
                    `Servicio REQ: ${props.reqNombre || (evento.title.match(/REQ:([^ ]+)/) ? evento.title.match(/REQ:([^ ]+)/)[1] : '?')}\n` +
                    `Cliente: ${props.clienteNombre || (evento.title.match(/\(([^)]+)\)/) ? evento.title.match(/\(([^)]+)\)/)[1] : '?') }\n` +
                    `Tarea: ${props.tipoTareaOriginal || (evento.title.split(' - ')[1] ? evento.title.split(' - ')[1].split(' (')[0] : '?')}\n` +
                    `Fecha: ${evento.start ? evento.start.toLocaleDateString('es-CL') : 'N/A'}\n` +
                    `Hora: ${evento.start ? evento.start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''} - ${evento.end ? evento.end.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''}\n` +
                    `Técnicos: ${props.tecnicosOriginales ? props.tecnicosOriginales.join(', ') : 'No asignados'}\n` +
                    `Estado: ${props.estado || 'N/A'}\n` +
                    `Notas: ${props.notas || ''}`
                );
            },
        });
        calendarioFullCalendar.render();
        console.log("CALENDARIO: Calendario (Vistas Estándar) renderizado.");
    } catch (e) {
        console.error("CALENDARIO: Error CRÍTICO al inicializar FullCalendar:", e);
        if (calendarEl) calendarEl.innerHTML = "<p>Error fatal al inicializar el calendario. Revisa la consola.</p>";
    }
}

// --- LÓGICA DE CARGA MASIVA (COMENTADA - NECESITA REFACTORIZACIÓN COMPLETA) ---
const csvFileInput = document.getElementById('csvFile'); // Esto podría ser null si la sección está comentada
const btnProcesarCsv = document.getElementById('btnProcesarCsv'); // Esto podría ser null
// const cargaMasivaLog = document.getElementById('cargaMasivaLog'); // Ya no se usa directamente aquí
if (btnProcesarCsv) {
    btnProcesarCsv.addEventListener('click', () => {
        alert("La carga masiva está actualmente deshabilitada y necesita ser rediseñada para la nueva estructura de datos con múltiples programaciones por servicio.");
    });
} else {
    // console.warn("Botón de carga masiva (btnProcesarCsv) no encontrado. Normal si la sección está comentada.");
}


// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    // Comprobaciones adicionales para elementos del DOM del modal
    if (!modalProgramaciones) console.error("Elemento modalGestionProgramaciones no encontrado.");
    if (!formAddProgramacion) console.warn("Elemento formAddProgramacion no encontrado. El listener no se añadirá.");
    
    mostrarVista('vista-entrada-requerimiento');
});

console.log("app.js: <<< Script execution finished.");

