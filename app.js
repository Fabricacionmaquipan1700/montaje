// --- IMPORTS Y CONFIGURACIÓN DE FIREBASE ---
console.log("app.js: >>> Script execution started.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, serverTimestamp, getDoc, where, collectionGroup, writeBatch
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
                const docRef = await addDoc(requerimientosCollectionRef, requerimientoData);
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

async function eliminarRequerimiento(id) {
    if (confirm('¿Estás seguro de eliminar este servicio y TODAS sus programaciones asociadas? Esta acción no se puede deshacer.')) {
        try {
            // TODO: Implementar eliminación de subcolección 'programaciones' (idealmente con Cloud Function)
            // Por ahora, solo eliminamos el requerimiento principal.
            console.warn(`Eliminando requerimiento ${id}. Sus programaciones quedarán huérfanas si no se eliminan por separado.`);
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
function abrirModalProgramaciones(requerimientoId, reqNombre) {
    if (!currentRequerimientoIdInput || !modalTituloRequerimiento || !formAddProgramacion || !modalProgramaciones || !listaProgramacionesContainer) {
        console.error("Error: Elementos del modal de programaciones no encontrados en el DOM.");
        alert("Error al abrir el gestor de programaciones. Faltan elementos en la página.");
        return;
    }
    currentRequerimientoIdInput.value = requerimientoId;
    modalTituloRequerimiento.textContent = `Gestionar Programaciones para REQ: ${reqNombre}`;
    formAddProgramacion.reset();
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
         if (programacionData.horaFin <= programacionData.horaInicio) {
            alert("La Hora Fin debe ser posterior a la Hora Inicio.");
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

async function cargarDatosParaGraficosEstadisticas() {
    console.log("app.js: cargarDatosParaGraficosEstadisticas called.");
    try {
        const querySnapshot = await getDocs(requerimientosCollectionRef);
        const requerimientos = [];
        querySnapshot.forEach(doc => { requerimientos.push(doc.data()); });

        const conteoEstatus = requerimientos.reduce((acc, curr) => {
            if(curr.estatusRequerimiento) acc[curr.estatusRequerimiento] = (acc[curr.estatusRequerimiento] || 0) + 1;
            return acc;
        }, {});
        const ctxEstatus = document.getElementById('graficoEstatusRequerimiento')?.getContext('2d');
        if (ctxEstatus) {
            if (graficoEstatusReq) graficoEstatusReq.destroy();
            graficoEstatusReq = new Chart(ctxEstatus, {
                type: 'pie',
                data: {
                    labels: Object.keys(conteoEstatus),
                    datasets: [{ data: Object.values(conteoEstatus), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#27ae60', '#f39c12'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top'}}}
            });
        }

        const conteoCanales = requerimientos.reduce((acc, curr) => {
            if(curr.canalEntrada) acc[curr.canalEntrada] = (acc[curr.canalEntrada] || 0) + 1;
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
    } catch (error) {
        console.error("Error al cargar datos para gráficos de estadísticas:", error);
    }
}

// --- LÓGICA DEL CALENDARIO ---
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
        // Esta consulta asume que tienes un índice compuesto para 'programaciones' ordenado por 'timestampCreacion' desc.
        // Si no lo tienes, Firestore te dará un error en la consola con un enlace para crearlo.
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
                continue; // Omitir este evento si no tiene información esencial de inicio
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
                                  progData.tecnicosAsignados.join(', ') : 'S/A'; // S/A = Sin Asignar

            programacionesParaEventos.push({
                id: progDoc.id, 
                requerimientoId: requerimientoRef ? requerimientoRef.id : null,
                title: `REQ:${reqDataParaTitulo.req} (${reqDataParaTitulo.cliente || ''}) - ${progData.tipoTarea || 'Tarea'} [Téc: ${tecnicosTexto}]`, // Título del evento
                start: startDateTime,
                end: endDateTime,
                extendedProps: { // Propiedades personalizadas
                    tecnicosOriginales: progData.tecnicosAsignados || [], 
                    estado: progData.estadoProgramacion || '',
                    notas: progData.notasProgramacion || '',
                    reqNombre: reqDataParaTitulo.req,
                    clienteNombre: reqDataParaTitulo.cliente,
                    tipoTareaOriginal: progData.tipoTarea
                },
                // Puedes añadir colores basados en estado o técnico si lo deseas más adelante
                // backgroundColor: obtenerColorPorEstado(progData.estadoProgramacion), 
                // textColor: 'white',
            });
        }
        
        console.log(`CALENDARIO: Se procesaron ${programacionesParaEventos.length} eventos para el calendario.`);

    } catch (error) {
        console.error("CALENDARIO: Error obteniendo o procesando programaciones de Firestore:", error);
        if (calendarEl) {
             calendarEl.innerHTML = "<p>Error al cargar datos para el calendario. Revisa la consola (F12).</p>";
        }
        // La alerta por índice faltante
        if (error.message && error.message.toLowerCase().includes("index")) {
            alert("Error de Firestore: El índice necesario para el calendario aún no está listo o falta. Por favor, créalo usando el enlace que aparece en la consola y espera a que se habilite.");
        }
        return; 
    }

    // Destruir calendario anterior si existe, para asegurar una reinicialización limpia
    if (calendarioFullCalendar) {
        console.log("CALENDARIO: Destruyendo calendario existente...");
        calendarioFullCalendar.destroy();
        calendarioFullCalendar = null; // Importante para que se cree uno nuevo
    }
    
    try {
        console.log("CALENDARIO: Creando nueva instancia de FullCalendar (Vistas Estándar).");
        calendarioFullCalendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es', // Español
            initialView: 'timeGridWeek', // Vista semanal con horas por defecto
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' // Vistas estándar
            },
            views: { // Personalizar texto de botones si quieres
                timeGridDay: { buttonText: 'Día' },
                timeGridWeek: { buttonText: 'Semana' },
                dayGridMonth: { buttonText: 'Mes' },
                listWeek: { buttonText: 'Lista' }
            },
            editable: false,  // Los eventos no se pueden arrastrar ni redimensionar
            selectable: true, // Permite seleccionar rangos de tiempo (para futuro "crear evento")
            events: programacionesParaEventos, // Aquí se pasan los eventos
            contentHeight: 'auto', // Ajustar altura al contenido
            nowIndicator: true, // Muestra una línea en la hora actual
            slotEventOverlap: false, // Evita que los eventos se dibujen uno encima de otro visualmente

            eventClick: function(info) { // Lo que sucede al hacer clic en un evento
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
                // Podrías abrir el modal de edición de la programación aquí si lo deseas:
                // if (evento.extendedProps.requerimientoId && evento.id) {
                //    abrirModalParaEditarProgramacion(evento.extendedProps.requerimientoId, evento.id);
                // }
            },
            // Podrías añadir un callback 'select' para crear nuevas programaciones
            // select: function(selectInfo) {
            //    alert('Seleccionado desde ' + selectInfo.startStr + ' hasta ' + selectInfo.endStr);
            //    // Aquí podrías abrir el modal para añadir una nueva programación,
            //    // pre-llenando las fechas y horas con selectInfo.start y selectInfo.end
            // }
        });
        calendarioFullCalendar.render();
        console.log("CALENDARIO: Calendario (Vistas Estándar) renderizado.");
    } catch (e) {
        console.error("CALENDARIO: Error CRÍTICO al inicializar FullCalendar:", e);
        if (calendarEl) calendarEl.innerHTML = "<p>Error fatal al inicializar el calendario. Revisa la consola.</p>";
    }
}

// --- LÓGICA DE CARGA MASIVA (COMENTADA - NECESITA REFACTORIZACIÓN COMPLETA) ---
const csvFileInput = document.getElementById('csvFile');
const btnProcesarCsv = document.getElementById('btnProcesarCsv');
if (btnProcesarCsv) {
    btnProcesarCsv.addEventListener('click', () => {
        alert("La carga masiva está actualmente deshabilitada y necesita ser rediseñada para la nueva estructura de datos con múltiples programaciones por servicio.");
    });
}
/*
// Funciones anteriores de carga masiva simple (handleFileUpload, procesarYSubirDatosSimple)
// irían aquí si se descomentaran, pero necesitan ser completamente reescritas.
*/

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    // Comprobar si los elementos del modal existen antes de añadir listeners o manipularlos
    if (formAddProgramacion) {
        // El listener ya está arriba, esto es solo para asegurar que no se añada otro si se refactoriza
    } else {
        console.warn("El formulario para añadir programaciones (formAddProgramacion) no se encontró en el DOM.");
    }
    const closeModalButton = document.querySelector('#modalGestionProgramaciones .close-button');
    if (closeModalButton) {
        // El onclick ya está en el HTML, pero si no, se añadiría aquí.
    } else {
        console.warn("Botón para cerrar modal de programaciones no encontrado.");
    }
    
    mostrarVista('vista-entrada-requerimiento');
});

console.log("app.js: <<< Script execution finished.");
