// --- IMPORTS Y CONFIGURACIÓN DE FIREBASE ---
console.log("app.js: >>> Script execution started.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, serverTimestamp, getDoc, where, collectionGroup // Añadido where y collectionGroup
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

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
console.log("app.js: Firebase initialized.");

// --- ELEMENTOS DEL DOM ---
const formRequerimiento = document.getElementById('formRequerimiento');
const tablaRequerimientosBody = document.querySelector('#tablaRequerimientos tbody');
const vistaEntradaTitulo = document.querySelector('#vista-entrada-requerimiento h2'); // Ajustado al nuevo ID de vista

// Modal de Programaciones
const modalProgramaciones = document.getElementById('modalGestionProgramaciones');
const modalTituloRequerimiento = document.getElementById('modalTituloRequerimiento');
const formAddProgramacion = document.getElementById('formAddProgramacion');
const listaProgramacionesContainer = document.getElementById('listaProgramacionesContainer');
const currentRequerimientoIdInput = document.getElementById('currentRequerimientoId');

console.log("app.js: DOM elements selected.");

// --- MANEJO DE VISTAS ---
const vistas = ['vista-entrada-requerimiento', 'vista-visualizacion', 'vista-planificacion', 'vista-graficos']; // 'vista-carga-masiva' removida temporalmente
let calendarioFullCalendar = null; // Variable para la instancia del calendario

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
        cargarDatosParaGraficosEstadisticas(); // Renombrada para claridad
    }
    if (idVista === 'vista-planificacion') {
        inicializarOActualizarCalendario(); // Nueva función para el calendario
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
            const docRef = await addDoc(requerimientosCollectionRef, requerimientoData);
            alert('Servicio guardado con éxito! Ahora puedes añadir programaciones desde "Ver Servicios".');
            // Opcional: abrir modal de programaciones para este nuevo servicio
            // gestionarProgramaciones(docRef.id, requerimientoData.req); 
        }
        formRequerimiento.reset();
        if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
        mostrarVista('vista-visualizacion');
    } catch (error) {
        console.error("Error al guardar/actualizar servicio:", error);
        alert('Error al guardar el servicio. Ver consola.');
    }
});

async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    if (!tablaRequerimientosBody) return;
    tablaRequerimientosBody.innerHTML = `<tr><td colspan="9">Cargando...</td></tr>`; // Ajustar colspan

    try {
        const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        let html = '';
        if (querySnapshot.empty) {
            html = `<tr><td colspan="9">No hay servicios registrados.</td></tr>`; // Ajustar colspan
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
        tablaRequerimientosBody.innerHTML = `<tr><td colspan="9">Error al cargar datos.</td></tr>`; // Ajustar colspan
    }
}
window.cargarRequerimientos = cargarRequerimientos;

async function editarRequerimiento(id) {
    const docRef = doc(db, "requerimientos", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        formRequerimiento.reset(); // Limpiar formulario
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
        alert("Documento no encontrado para editar.");
    }
}
window.editarRequerimiento = editarRequerimiento;

async function eliminarRequerimiento(id) {
    if (confirm('¿Estás seguro de eliminar este servicio y todas sus programaciones asociadas? Esta acción no se puede deshacer.')) {
        try {
            // Opcional: Eliminar subcolección de programaciones (más complejo, requiere recursión o función de cloud)
            // Por ahora, solo eliminamos el requerimiento principal. Las programaciones quedarían huérfanas.
            // Para una app de producción, se necesitaría una Cloud Function para eliminar subcolecciones.
            await deleteDoc(doc(db, "requerimientos", id));
            alert('Servicio eliminado con éxito.');
            cargarRequerimientos();
        } catch (error) {
            console.error("Error al eliminar servicio:", error);
            alert('Error al eliminar el servicio.');
        }
    }
}
window.eliminarRequerimiento = eliminarRequerimiento;


// --- GESTIÓN DE PROGRAMACIONES (MODAL) ---
function abrirModalProgramaciones(requerimientoId, reqNombre) {
    currentRequerimientoIdInput.value = requerimientoId;
    modalTituloRequerimiento.textContent = `Gestionar Programaciones para REQ: ${reqNombre}`;
    formAddProgramacion.reset();
    cargarProgramacionesExistentes(requerimientoId);
    modalProgramaciones.style.display = 'block';
}
window.gestionarProgramaciones = abrirModalProgramaciones; // Alias para el HTML

function cerrarModalProgramaciones() {
    modalProgramaciones.style.display = 'none';
}
window.cerrarModalProgramaciones = cerrarModalProgramaciones; // Para el botón X

formAddProgramacion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const requerimientoId = currentRequerimientoIdInput.value;
    if (!requerimientoId) {
        alert("Error: ID de requerimiento no encontrado.");
        return;
    }

    const tecnicosAsignados = document.getElementById('modalTecnicosAsignados').value.split(',')
        .map(t => t.trim()).filter(t => t !== "");

    if (tecnicosAsignados.length === 0) {
        alert("Debe ingresar al menos un técnico.");
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

    try {
        const programacionesRef = collection(db, "requerimientos", requerimientoId, "programaciones");
        await addDoc(programacionesRef, programacionData);
        alert('Programación guardada con éxito!');
        formAddProgramacion.reset();
        cargarProgramacionesExistentes(requerimientoId); // Recargar lista
    } catch (error) {
        console.error("Error al guardar programación:", error);
        alert('Error al guardar la programación.');
    }
});

async function cargarProgramacionesExistentes(requerimientoId) {
    if (!listaProgramacionesContainer) return;
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
            cargarProgramacionesExistentes(requerimientoId); // Recargar lista
        } catch (error) {
            console.error("Error al eliminar programación:", error);
            alert("Error al eliminar programación.");
        }
    }
}
window.eliminarProgramacion = eliminarProgramacion;


// --- LÓGICA DE GRÁFICOS (ESTADÍSTICAS) ---
// (Simplificado, puedes expandir esto)
let graficoEstatusReq = null;
let graficoCanal = null;

async function cargarDatosParaGraficosEstadisticas() {
    console.log("app.js: cargarDatosParaGraficosEstadisticas called.");
    try {
        const querySnapshot = await getDocs(requerimientosCollectionRef);
        const requerimientos = [];
        querySnapshot.forEach(doc => { requerimientos.push(doc.data()); });

        // Gráfico por Estatus de Requerimiento
        const conteoEstatus = requerimientos.reduce((acc, curr) => {
            acc[curr.estatusRequerimiento] = (acc[curr.estatusRequerimiento] || 0) + 1;
            return acc;
        }, {});
        const ctxEstatus = document.getElementById('graficoEstatusRequerimiento')?.getContext('2d');
        if (ctxEstatus) {
            if (graficoEstatusReq) graficoEstatusReq.destroy();
            graficoEstatusReq = new Chart(ctxEstatus, {
                type: 'pie',
                data: {
                    labels: Object.keys(conteoEstatus),
                    datasets: [{ data: Object.values(conteoEstatus), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top'}}}
            });
        }

        // Gráfico por Canal de Entrada (similar a antes)
        const conteoCanales = requerimientos.reduce((acc, curr) => {
            acc[curr.canalEntrada] = (acc[curr.canalEntrada] || 0) + 1;
            return acc;
        }, {});
        const ctxCanal = document.getElementById('graficoCanalEntrada')?.getContext('2d');
        if (ctxCanal) {
            if (graficoCanal) graficoCanal.destroy();
            graficoCanal = new Chart(ctxCanal, {
                type: 'bar',
                data: {
                    labels: Object.keys(conteoCanales),
                    datasets: [{ label: 'Servicios por Canal', data: Object.values(conteoCanales), backgroundColor: '#36A2EB' }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true}}, plugins: { legend: { display: false }}}
            });
        }
        console.log("app.js: Gráficos de estadísticas generados/actualizados.");
    } catch (error) {
        console.error("Error al cargar datos para gráficos de estadísticas:", error);
    }
}


// --- LÓGICA DEL CALENDARIO (FASE SIGUIENTE) ---
async function inicializarOActualizarCalendario() {
    console.log("app.js: inicializarOActualizarCalendario called.");
    const calendarEl = document.getElementById('calendarioFullCalendar');
    if (!calendarEl) {
        console.error("Elemento del calendario no encontrado.");
        return;
    }

    // 1. Obtener todas las programaciones de Firestore
    // Esto implica una consulta de grupo de colección (collectionGroup)
    const programacionesEventos = [];
    try {
        const qProgramaciones = query(collectionGroup(db, 'programaciones'), orderBy('timestampCreacion', 'desc'));
        const snapshotProgramaciones = await getDocs(qProgramaciones);
        
        for (const progDoc of snapshotProgramaciones.docs) {
            const progData = progDoc.data();
            const requerimientoRef = progDoc.ref.parent.parent; // Referencia al documento padre (requerimiento)
            let reqData = { req: 'N/A', cliente: 'N/A' }; // Default
            if (requerimientoRef) {
                const reqSnap = await getDoc(requerimientoRef);
                if (reqSnap.exists()) {
                    reqData = reqSnap.data();
                }
            }

            // Combinar fecha y hora para FullCalendar (requiere que horaInicio/Fin sean válidas)
            const startDateTime = `${progData.fechaProgramada}T${progData.horaInicio || '00:00'}:00`;
            const endDateTime = `${progData.fechaProgramada}T${progData.horaFin || '23:59'}:00`;

            programacionesEventos.push({
                id: progDoc.id, // ID de la programación
                requerimientoId: requerimientoRef ? requerimientoRef.id : null,
                title: `REQ: ${reqData.req || '??'} - ${progData.tipoTarea || 'Tarea'} (${reqData.cliente || '??'})`,
                start: startDateTime,
                end: endDateTime,
                extendedProps: {
                    tecnicos: progData.tecnicosAsignados || [],
                    estado: progData.estadoProgramacion || '',
                    notas: progData.notasProgramacion || ''
                },
                // Puedes añadir colores basados en estado o técnico
                // backgroundColor: obtenerColorPorEstado(progData.estadoProgramacion), 
            });
        }
        logCargaMasiva(`Se cargaron ${programacionesEventos.length} programaciones para el calendario.`);

} catch (error) {
    console.error("CALENDARIO: Error obteniendo o procesando programaciones de Firestore:", error);
    // logCargaMasiva("CALENDARIO: Error cargando datos para el calendario.", true); // <--- LÍNEA COMENTADA O ELIMINADA

    calendarEl.innerHTML = "<p>Error al cargar datos para el calendario. Revisa la consola (F12).</p>";
    if (error.message && error.message.toLowerCase().includes("index")) {
        // Esta alerta es importante si el error es por el índice
        alert("Error de Firestore: El índice necesario para el calendario aún no está listo o falta. Por favor, créalo usando el enlace de la consola y espera a que se habilite.");
    }
    return; 
}


    // 2. Inicializar o actualizar FullCalendar
    if (calendarioFullCalendar) {
        calendarioFullCalendar.removeAllEvents();
        calendarioFullCalendar.addEventSource(programacionesEventos);
        // calendarioFullCalendar.refetchEvents(); // Otra forma si usas eventSources
    } else if (FullCalendar) {
        calendarioFullCalendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es', // Para español
            initialView: 'dayGridMonth', // Vista por defecto
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' // Añadida vista de lista
            },
            events: programacionesEventos,
            editable: false, // Poner a true si quieres drag & drop (requiere lógica de guardado)
            selectable: true, // Permite seleccionar fechas/horas (para crear eventos, requiere lógica)
            eventClick: function(info) {
                // Mostrar detalles del evento/programación
                let tecnicosStr = info.event.extendedProps.tecnicos ? info.event.extendedProps.tecnicos.join(', ') : 'No asignados';
                alert(
                    `Servicio: ${info.event.title}\n` +
                    `Fecha: ${info.event.start ? info.event.start.toLocaleDateString('es-CL') : 'N/A'}\n` +
                    `Hora: ${info.event.start ? info.event.start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''} - ${info.event.end ? info.event.end.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''}\n` +
                    `Técnicos: ${tecnicosStr}\n` +
                    `Estado: ${info.event.extendedProps.estado || 'N/A'}\n` +
                    `Notas: ${info.event.extendedProps.notas || ''}`
                );
                // Aquí podrías abrir el modal de edición de programaciones si lo deseas
                // gestionarProgramaciones(info.event.extendedProps.requerimientoId, "REQ del evento");
            },
            // Puedes añadir más opciones, como select para crear nuevas programaciones, etc.
        });
        calendarioFullCalendar.render();
    } else {
        console.error("FullCalendar no está cargado.");
        calendarEl.innerHTML = "<p>Error al cargar el calendario. Librería FullCalendar no encontrada.</p>";
    }
}


// --- LÓGICA DE CARGA MASIVA (COMENTADA - NECESITA REFACTORIZACIÓN COMPLETA) ---
/*
const csvFileInput = document.getElementById('csvFile');
const btnProcesarCsv = document.getElementById('btnProcesarCsv');
const cargaMasivaLog = document.getElementById('cargaMasivaLog');

if (btnProcesarCsv) {
    btnProcesarCsv.addEventListener('click', () => {
        alert("La carga masiva está deshabilitada y necesita ser rediseñada para la nueva estructura de datos con múltiples programaciones por servicio.");
        // handleFileUpload(); // La función antigua ya no es compatible
    });
}
// La función handleFileUpload y procesarYSubirDatosSimple anteriores quedan aquí comentadas
// ya que no son compatibles con la nueva estructura de requerimientos -> programaciones.
// Se necesitaría una lógica completamente nueva para el CSV.
*/


// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    mostrarVista('vista-entrada-requerimiento'); // Vista inicial
});

console.log("app.js: <<< Script execution finished.");

