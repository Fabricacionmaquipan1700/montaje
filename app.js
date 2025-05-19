// --- IMPORTS Y CONFIGURACIÓN DE FIREBASE ---
console.log("app.js: >>> Script execution started.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    orderBy, query, serverTimestamp, getDoc, where, collectionGroup, writeBatch
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKyWnVlkKxQUVdNdIpM1s3YTEXFQyyBC0", // Reemplaza con tu API Key real
    authDomain: "montaje-14a4f.firebaseapp.com",
    projectId: "montaje-14a4f",
    storageBucket: "montaje-14a4f.firebasestorage.app",
    messagingSenderId: "258283681762",
    appId: "1:258283681762:web:af3adaafb3c322564dabbb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const requerimientosCollectionRef = collection(db, "requerimientos");

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

// --- ELEMENTOS DEL DOM ---
const formRequerimiento = document.getElementById('formRequerimiento');
const tablaRequerimientosBody = document.querySelector('#tablaRequerimientos tbody');
const vistaEntradaTitulo = document.querySelector('#vista-entrada-requerimiento h2');

const modalProgramaciones = document.getElementById('modalGestionProgramaciones');
const modalTituloRequerimiento = document.getElementById('modalTituloRequerimiento');
const formAddProgramacion = document.getElementById('formAddProgramacion');
const listaProgramacionesContainer = document.getElementById('listaProgramacionesContainer');
const currentRequerimientoIdInput = document.getElementById('currentRequerimientoId');
const botonGuardarProgramacion = formAddProgramacion ? formAddProgramacion.querySelector('button[type="submit"]') : null;
const tituloFormProgramacion = formAddProgramacion ? formAddProgramacion.previousElementSibling : null; // Asumiendo que el H4 está justo antes


console.log("app.js: Firebase initialized and DOM elements selected.");

// --- MANEJO DE VISTAS ---
const vistas = ['vista-entrada-requerimiento', 'vista-visualizacion', 'vista-planificacion', 'vista-graficos'];
let calendarioFullCalendar = null;
let datosOriginalesRequerimientos = [];
let ordenActual = { columna: 'fechaRecepcion', direccion: 'desc', columnaIndiceDOM: 0 };

function mostrarVista(idVista) {
    console.log(`app.js: ---> mostrarVista called with idVista = ${idVista}`);
    vistas.forEach(vistaIdEnArray => {
        const el = document.getElementById(vistaIdEnArray);
        if (el) el.style.display = (vistaIdEnArray === idVista) ? 'block' : 'none';
        else console.warn(`app.js: Elemento de vista con ID '${vistaIdEnArray}' no encontrado.`);
    });

    if (idVista === 'vista-visualizacion') cargarRequerimientos();
    if (idVista === 'vista-graficos') cargarDatosParaGraficosEstadisticas();
    if (idVista === 'vista-planificacion') inicializarOActualizarCalendario();
    if (idVista === 'vista-entrada-requerimiento' && formRequerimiento && !formRequerimiento.dataset.editingId) {
        if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
        formRequerimiento.reset();
    }
}
window.mostrarVista = mostrarVista;

async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    if (!tablaRequerimientosBody) {
        console.error("Error: El elemento tablaRequerimientosBody no fue encontrado.");
        return;
    }
    const NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS = 10;
    tablaRequerimientosBody.innerHTML = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">Cargando...</td></tr>`;

    try {
        const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc")); // Carga inicial por timestamp
        const querySnapshot = await getDocs(q);
        datosOriginalesRequerimientos = [];
        querySnapshot.forEach(docSnap => datosOriginalesRequerimientos.push({ id: docSnap.id, ...docSnap.data() }));
        
        // Aplicar el ordenamiento actual (que por defecto podría ser 'fechaRecepcion' o el último usado)
        ordenarYRenderizarDatos(ordenActual.columna, ordenActual.direccion, ordenActual.columnaIndiceDOM, true);

    } catch (error) {
        console.error("Error al cargar requerimientos:", error);
        tablaRequerimientosBody.innerHTML = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">Error al cargar datos.</td></tr>`;
    }
}

function actualizarIndicadoresDeOrdenVisual(columnaIndiceActivo, direccionActual) {
    const cabeceras = document.querySelectorAll('#tablaRequerimientos thead th[onclick]');
    cabeceras.forEach((th, index) => {
        let textoBase = th.dataset.originalText;
        if (!textoBase) {
            textoBase = th.textContent.replace(/ ↓| ↑| ⇅/g, '').trim();
            th.dataset.originalText = textoBase;
        }
        if (index === columnaIndiceActivo) {
            th.innerHTML = `${textoBase} ${direccionActual === 'asc' ? '↑' : '↓'}`;
        } else {
            th.innerHTML = `${textoBase} <span class="sort-arrow">⇅</span>`;
        }
    });
}

function ordenarTablaPorColumna(columnaIndiceDOM, nombreColumna) {
    let nuevaDireccion = (ordenActual.columna === nombreColumna && ordenActual.direccion === 'asc') ? 'desc' : 'asc';
    ordenarYRenderizarDatos(nombreColumna, nuevaDireccion, columnaIndiceDOM);
}
window.ordenarTablaPorColumna = ordenarTablaPorColumna;

function ordenarYRenderizarDatos(nombreColumna, direccion, columnaIndiceDOM, esCargaInicial = false) {
    ordenActual = { columna: nombreColumna, direccion: direccion, columnaIndiceDOM: columnaIndiceDOM };
    const factor = direccion === 'asc' ? 1 : -1;
    const datosCopia = [...datosOriginalesRequerimientos];

    datosCopia.sort((a, b) => {
        let valA = a[nombreColumna];
        let valB = b[nombreColumna];
        if (nombreColumna === 'fechaRecepcion' || nombreColumna === 'fechaTerminoServicio') {
            valA = valA ? new Date(valA + 'T00:00:00Z').getTime() : (direccion === 'asc' ? Infinity : -Infinity);
            valB = valB ? new Date(valB + 'T00:00:00Z').getTime() : (direccion === 'asc' ? Infinity : -Infinity);
        } else if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase(); valB = valB.toLowerCase();
        } else { // Fallback para números o tipos mixtos (simplificado)
            if (valA === null || typeof valA === "undefined") valA = direccion === 'asc' ? Infinity : -Infinity;
            if (valB === null || typeof valB === "undefined") valB = direccion === 'asc' ? Infinity : -Infinity;
        }
        if (valA < valB) return -1 * factor;
        if (valA > valB) return 1 * factor;
        return 0;
    });
    renderizarTablaRequerimientos(datosCopia);
    actualizarIndicadoresDeOrdenVisual(columnaIndiceDOM, direccion);
}

function renderizarTablaRequerimientos(datos) {
    if (!tablaRequerimientosBody) return;
    const NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS = 10;
    let html = '';
    if (!datos || datos.length === 0) {
        html = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">No hay servicios registrados.</td></tr>`;
    } else {
        datos.forEach(data => {
            html += `
                <tr data-id="${data.id}">
                    <td>${formatearFechaDesdeYYYYMMDD(data.fechaRecepcion)}</td>
                    <td>${data.req || ''}</td>
                    <td>${data.cliente || ''}</td>
                    <td>${data.asunto ? (data.asunto.length > 30 ? data.asunto.substring(0,27)+'...' : data.asunto) : ''}</td>
                    <td>${data.localidad || ''}</td>
                    <td>${data.estatusRequerimiento || ''}</td>
                    <td>${formatearFechaDesdeYYYYMMDD(data.fechaTerminoServicio)}</td>
                    <td>${data.solicitante || ''}</td>
                    <td>
                        <button class="action-button edit" onclick="window.editarRequerimiento('${data.id}')">Editar</button>
                        <button class="action-button delete" onclick="window.eliminarRequerimiento('${data.id}')">Eliminar</button>
                    </td>
                    <td>
                        <button class="action-button" onclick="window.gestionarProgramaciones('${data.id}', '${data.req || 'Servicio'}')">Programar</button>
                    </td>
                </tr>
            `;
        });
    }
    tablaRequerimientosBody.innerHTML = html;
    const buscador = document.getElementById('buscadorServicios');
    if (buscador) buscador.value = "";
}

function formatearFechaDesdeYYYYMMDD(fechaString) {
    if (!fechaString || !/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) return '';
    const dateObj = new Date(fechaString + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) return 'Fecha Inv.';
    return dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

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
            fechaTerminoServicio: document.getElementById('fechaTerminoServicio').value || null,
        };

        if (!requerimientoData.req || !requerimientoData.cliente || !requerimientoData.fechaRecepcion) {
            alert("Los campos Fecha de Recepción, N° REQ/OT y Cliente son obligatorios."); return;
        }
        try {
            if (idRequerimiento) {
                await updateDoc(doc(db, "requerimientos", idRequerimiento), requerimientoData);
                alert('Servicio actualizado con éxito!');
                delete formRequerimiento.dataset.editingId;
            } else {
                requerimientoData.timestamp = serverTimestamp();
                await addDoc(requerimientosCollectionRef, requerimientoData);
                alert('Servicio guardado con éxito!');
            }
            formRequerimiento.reset();
            if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
            datosOriginalesRequerimientos = []; // Forzar recarga
            ordenActual = { columna: 'fechaRecepcion', direccion: 'desc', columnaIndiceDOM: 0 }; // Resetear orden
            mostrarVista('vista-visualizacion');
        } catch (error) {
            console.error("Error al guardar/actualizar servicio:", error);
            alert('Error al guardar el servicio. Ver consola.');
        }
    });
}

async function editarRequerimiento(id) {
    try {
        const docSnap = await getDoc(doc(db, "requerimientos", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (formRequerimiento) {
                formRequerimiento.reset();
                Object.keys(data).forEach(key => {
                    const input = document.getElementById(key);
                    if (input) input.value = data[key] || '';
                });
                document.getElementById('fechaTerminoServicio').value = data.fechaTerminoServicio || ''; // Específico para este campo
                formRequerimiento.dataset.editingId = id;
                if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = `Editando Servicio REQ: ${data.req || id}`;
                mostrarVista('vista-entrada-requerimiento');
            } else alert("Error: Formulario no encontrado.");
        } else alert("Documento no encontrado para editar.");
    } catch(error) {
        console.error("Error al obtener documento para editar:", error);
        alert("Error al cargar datos para editar.");
    }
}
window.editarRequerimiento = editarRequerimiento;

function filtrarTablaServicios() {
    const filtro = document.getElementById('buscadorServicios').value.toUpperCase();
    const filas = tablaRequerimientosBody.getElementsByTagName('tr');
    for (let i = 0; i < filas.length; i++) {
        const filaActual = filas[i];
        if (filaActual.cells.length > 1) { // Asegurar que no es una fila de "cargando" o "no hay datos"
            let visible = false;
            for (let j = 0; j < filaActual.cells.length - 2; j++) { // No buscar en columnas de acciones
                if (filaActual.cells[j].textContent.toUpperCase().indexOf(filtro) > -1) {
                    visible = true; break;
                }
            }
            filaActual.style.display = visible ? "" : "none";
        }
    }
}
window.filtrarTablaServicios = filtrarTablaServicios;

async function eliminarRequerimiento(id) {
    if (confirm('¿Estás seguro de eliminar este servicio y TODAS sus programaciones asociadas?')) {
        const batch = writeBatch(db);
        try {
            batch.delete(doc(db, "requerimientos", id));
            const programacionesSnap = await getDocs(collection(db, "requerimientos", id, "programaciones"));
            programacionesSnap.forEach(progDoc => batch.delete(progDoc.ref));
            await batch.commit();
            alert('Servicio y sus programaciones eliminados.');
            datosOriginalesRequerimientos = datosOriginalesRequerimientos.filter(item => item.id !== id);
            ordenarYRenderizarDatos(ordenActual.columna, ordenActual.direccion, ordenActual.columnaIndiceDOM);
        } catch (error) {
            console.error("Error al eliminar servicio y programaciones:", error);
            alert('Error al eliminar.');
        }
    }
}
window.eliminarRequerimiento = eliminarRequerimiento;

// --- GESTIÓN DE PROGRAMACIONES (MODAL) ---
function poblarCheckboxesTecnicos() {
    const container = document.getElementById('modalTecnicosCheckboxContainer');
    if (!container) { console.error("Contenedor de checkboxes para técnicos no encontrado."); return; }
    container.innerHTML = '';
    if (!LISTA_TECNICOS_PREDEFINIDOS || LISTA_TECNICOS_PREDEFINIDOS.length === 0) {
        container.innerHTML = '<p>No hay técnicos predefinidos.</p>'; return;
    }
    LISTA_TECNICOS_PREDEFINIDOS.forEach(tecnico => {
        const labelEl = document.createElement('label');
        const checkboxEl = document.createElement('input');
        checkboxEl.type = 'checkbox'; checkboxEl.name = 'modalTecnicos'; checkboxEl.value = tecnico;
        const tecnicoIdSanitized = tecnico.replace(/[^a-zA-Z0-9-_]/g, '');
        checkboxEl.id = `tec-check-${tecnicoIdSanitized}-${Math.random().toString(36).substr(2, 5)}`;
        labelEl.appendChild(checkboxEl);
        labelEl.appendChild(document.createTextNode(` ${tecnico}`));
        labelEl.htmlFor = checkboxEl.id;
        container.appendChild(labelEl);
    });
}

function abrirModalProgramaciones(requerimientoId, reqNombre) {
    if (!currentRequerimientoIdInput || !modalTituloRequerimiento || !formAddProgramacion || !modalProgramaciones) {
        alert("Error al abrir gestor de programaciones: faltan elementos."); return;
    }
    currentRequerimientoIdInput.value = requerimientoId;
    modalTituloRequerimiento.textContent = `Gestionar Programaciones para REQ: ${reqNombre}`;
    formAddProgramacion.reset();
    delete formAddProgramacion.dataset.editingProgramacionId; // Asegurar modo NUEVO por defecto
    if(botonGuardarProgramacion) botonGuardarProgramacion.textContent = 'Guardar Programación';
    if(tituloFormProgramacion) tituloFormProgramacion.textContent = 'Añadir Nueva Programación';


    document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked').forEach(cb => cb.checked = false);
    poblarCheckboxesTecnicos();
    cargarProgramacionesExistentes(requerimientoId);
    modalProgramaciones.style.display = 'block';
}
window.gestionarProgramaciones = abrirModalProgramaciones;

function cerrarModalProgramaciones() {
    if(modalProgramaciones) modalProgramaciones.style.display = 'none';
    delete formAddProgramacion.dataset.editingProgramacionId; // Limpiar estado de edición al cerrar
    if(botonGuardarProgramacion) botonGuardarProgramacion.textContent = 'Guardar Programación';
    if(tituloFormProgramacion) tituloFormProgramacion.textContent = 'Añadir Nueva Programación';
}
window.cerrarModalProgramaciones = cerrarModalProgramaciones;

async function cargarProgramacionesExistentes(requerimientoId) {
    if (!listaProgramacionesContainer) return;
    listaProgramacionesContainer.innerHTML = '<p>Cargando programaciones...</p>';
    const q = query(collection(db, "requerimientos", requerimientoId, "programaciones"), orderBy("fechaProgramada", "desc"), orderBy("horaInicio", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        let html = '<ul>';
        if (querySnapshot.empty) {
            html = '<p>No hay programaciones para este servicio.</p>';
        } else {
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
                        <div class="programacion-actions">
                            <button class="action-button edit" onclick="window.editarProgramacion('${requerimientoId}', '${docSnap.id}')">Editar</button>
                            <button class="action-button delete" onclick="window.eliminarProgramacion('${requerimientoId}', '${docSnap.id}')">X</button>
                        </div>
                    </li>`;
            });
            html += '</ul>';
        }
        listaProgramacionesContainer.innerHTML = html;
    } catch (error) {
        console.error("Error cargando programaciones:", error);
        listaProgramacionesContainer.innerHTML = '<p>Error al cargar programaciones.</p>';
    }
}

async function editarProgramacion(requerimientoId, programacionId) {
    if (!formAddProgramacion) { alert("Error: Formulario de programación no encontrado."); return; }
    try {
        const progSnap = await getDoc(doc(db, "requerimientos", requerimientoId, "programaciones", programacionId));
        if (progSnap.exists()) {
            const data = progSnap.data();
            formAddProgramacion.reset(); // Limpiar antes de poblar
            document.getElementById('modalFechaProgramada').value = data.fechaProgramada || '';
            document.getElementById('modalHoraInicio').value = data.horaInicio || '';
            document.getElementById('modalHoraFin').value = data.horaFin || '';
            document.getElementById('modalTipoTarea').value = data.tipoTarea || '';
            document.getElementById('modalEstadoProgramacion').value = data.estadoProgramacion || 'Programado';
            document.getElementById('modalNotasProgramacion').value = data.notasProgramacion || '';
            document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]').forEach(cb => {
                cb.checked = data.tecnicosAsignados && data.tecnicosAsignados.includes(cb.value);
            });
            formAddProgramacion.dataset.editingProgramacionId = programacionId;
            currentRequerimientoIdInput.value = requerimientoId; // Asegurar que el ID del requerimiento padre esté
            if(botonGuardarProgramacion) botonGuardarProgramacion.textContent = 'Actualizar Programación';
            if(tituloFormProgramacion) tituloFormProgramacion.textContent = 'Editando Programación';
            formAddProgramacion.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else alert("Error: Programación no encontrada para editar.");
    } catch (error) {
        console.error("Error al cargar datos de programación para editar:", error);
        alert("Error al cargar la programación. Ver consola.");
    }
}
window.editarProgramacion = editarProgramacion;

if (formAddProgramacion) {
    formAddProgramacion.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requerimientoId = currentRequerimientoIdInput.value;
        if (!requerimientoId) { alert("Error: ID de requerimiento no encontrado."); return; }
        const programacionIdParaEditar = formAddProgramacion.dataset.editingProgramacionId;
        const tecnicosAsignados = Array.from(document.querySelectorAll('#modalTecnicosCheckboxContainer input:checked')).map(cb => cb.value);
        if (tecnicosAsignados.length === 0) { alert("Debe seleccionar al menos un técnico."); return; }

        const programacionData = {
            fechaProgramada: document.getElementById('modalFechaProgramada').value,
            horaInicio: document.getElementById('modalHoraInicio').value,
            horaFin: document.getElementById('modalHoraFin').value,
            tipoTarea: document.getElementById('modalTipoTarea').value,
            tecnicosAsignados: tecnicosAsignados,
            estadoProgramacion: document.getElementById('modalEstadoProgramacion').value,
            notasProgramacion: document.getElementById('modalNotasProgramacion').value.trim(),
        };
        if (!programacionData.fechaProgramada || !programacionData.horaInicio || !programacionData.horaFin || !programacionData.tipoTarea) {
            alert("Fecha, Hora Inicio, Hora Fin y Tipo de Tarea son obligatorios."); return;
        }
        if (programacionData.horaFin <= programacionData.horaInicio) {
            alert("La Hora Fin debe ser posterior a la Hora Inicio."); return;
        }
        try {
            if (programacionIdParaEditar) {
                programacionData.timestampModificacion = serverTimestamp();
                await updateDoc(doc(db, "requerimientos", requerimientoId, "programaciones", programacionIdParaEditar), programacionData);
                alert('Programación actualizada con éxito!');
            } else {
                programacionData.timestampCreacion = serverTimestamp();
                await addDoc(collection(db, "requerimientos", requerimientoId, "programaciones"), programacionData);
                alert('Programación guardada con éxito!');
            }
            delete formAddProgramacion.dataset.editingProgramacionId;
            if(botonGuardarProgramacion) botonGuardarProgramacion.textContent = 'Guardar Programación';
            if(tituloFormProgramacion) tituloFormProgramacion.textContent = 'Añadir Nueva Programación';
            formAddProgramacion.reset();
            document.querySelectorAll('#modalTecnicosCheckboxContainer input:checked').forEach(cb => cb.checked = false);
            cargarProgramacionesExistentes(requerimientoId);
            if (document.getElementById('vista-planificacion').style.display === 'block') inicializarOActualizarCalendario();
        } catch (error) {
            console.error("Error al guardar/actualizar programación:", error);
            alert('Error al procesar la programación.');
        }
    });
}

async function eliminarProgramacion(requerimientoId, programacionId) {
    if (confirm('¿Estás seguro de eliminar esta programación?')) {
        try {
            await deleteDoc(doc(db, "requerimientos", requerimientoId, "programaciones", programacionId));
            alert("Programación eliminada.");
            cargarProgramacionesExistentes(requerimientoId);
            if (document.getElementById('vista-planificacion').style.display === 'block') inicializarOActualizarCalendario();
        } catch (error) {
            console.error("Error al eliminar programación:", error);
            alert("Error al eliminar programación.");
        }
    }
}
window.eliminarProgramacion = eliminarProgramacion;

// --- LÓGICA DE GRÁFICOS (ESTADÍSTICAS) ---
let graficoEstatusReq = null, graficoCanal = null, graficoTiempo1raProg = null, graficoTiempoTotal = null;
function diferenciaEnDias(fechaInicioStr, fechaFinStr) {
    if (!fechaInicioStr || !fechaFinStr) return null;
    const inicio = new Date(fechaInicioStr + 'T00:00:00Z'), fin = new Date(fechaFinStr + 'T00:00:00Z');
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin < inicio) return null;
    return Math.ceil((fin - inicio) / (1000 * 3600 * 24));
}
async function cargarDatosParaGraficosEstadisticas() {
    try {
        const reqsSnap = await getDocs(query(requerimientosCollectionRef, orderBy("timestamp", "desc")));
        const dataParaGraficos = [];
        for (const reqDoc of reqsSnap.docs) {
            const reqData = { id: reqDoc.id, ...reqDoc.data() };
            const progsSnap = await getDocs(query(collection(db, "requerimientos", reqDoc.id, "programaciones"), orderBy("fechaProgramada", "asc"), orderBy("horaInicio", "asc")));
            reqData.primeraFechaProgramada = progsSnap.empty ? null : progsSnap.docs[0].data().fechaProgramada;
            dataParaGraficos.push(reqData);
        }
        const crearOActualizarGrafico = (ctxId, graficoExistente, config) => {
            const ctx = document.getElementById(ctxId)?.getContext('2d');
            if (!ctx) return null;
            if (graficoExistente) graficoExistente.destroy();
            return new Chart(ctx, config);
        };
        const conteoEstatus = dataParaGraficos.reduce((acc, c) => { if(c.estatusRequerimiento) acc[c.estatusRequerimiento] = (acc[c.estatusRequerimiento] || 0) + 1; return acc; }, {});
        graficoEstatusReq = crearOActualizarGrafico('graficoEstatusRequerimiento', graficoEstatusReq, { type: 'pie', data: { labels: Object.keys(conteoEstatus), datasets: [{ data: Object.values(conteoEstatus), backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#27ae60','#f39c12'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top'}}} });
        const conteoCanales = dataParaGraficos.reduce((acc, c) => { if(c.canalEntrada) acc[c.canalEntrada] = (acc[c.canalEntrada] || 0) + 1; return acc; }, {});
        graficoCanal = crearOActualizarGrafico('graficoCanalEntrada', graficoCanal, { type: 'bar', data: { labels: Object.keys(conteoCanales), datasets: [{ label: 'Serv. por Canal', data: Object.values(conteoCanales), backgroundColor: '#36A2EB' }] }, options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true}}, plugins: { legend: { display: false }}} });
        const tiempos1raProg = dataParaGraficos.map(r => diferenciaEnDias(r.fechaRecepcion, r.primeraFechaProgramada)).filter(d => d !== null);
        const prom1raProg = tiempos1raProg.length ? (tiempos1raProg.reduce((a,b)=>a+b,0)/tiempos1raProg.length).toFixed(1) : 0;
        graficoTiempo1raProg = crearOActualizarGrafico('graficoTiempoPrimeraProgramacion', graficoTiempo1raProg, { type: 'bar', data: { labels: ['Prom. (días)'], datasets: [{ label: 'Recep. a 1ra Prog.', data: [prom1raProg], backgroundColor: ['#FF9F40'] }] }, options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true, title: {display:true, text:'Días Prom.'}}}, plugins: { legend: { display: false }}} });
        const tiemposTotal = dataParaGraficos.filter(r => r.estatusRequerimiento==='Resuelto').map(r => diferenciaEnDias(r.fechaRecepcion, r.fechaTerminoServicio)).filter(d => d !== null);
        const promTotal = tiemposTotal.length ? (tiemposTotal.reduce((a,b)=>a+b,0)/tiemposTotal.length).toFixed(1) : 0;
        graficoTiempoTotal = crearOActualizarGrafico('graficoTiempoTotalServicio', graficoTiempoTotal, { type: 'bar', data: { labels: ['Prom. (días)'], datasets: [{ label: 'Recep. a Término (Resueltos)', data: [promTotal], backgroundColor: ['#4BC0C0'] }] }, options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true, title: {display:true, text:'Días Prom.'}}}, plugins: { legend: { display: false }}} });
    } catch (error) { console.error("Error al cargar datos para gráficos:", error); }
}

// --- LÓGICA DEL CALENDARIO ---
function obtenerDetallesDeFechaHora(dateObjStart, dateObjEnd) {
    const formatYYYYMMDD = (date) => {
        if (!date) return null;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const formatHHMM = (date) => {
        if (!date) return null;
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    let horaFinCalc = null;
    if (dateObjEnd) {
        horaFinCalc = formatHHMM(dateObjEnd);
    } else if (dateObjStart) { // Si no hay fin, asume 1 hora de duración para el cálculo si es necesario
        const tempEndDate = new Date(dateObjStart.getTime() + 60 * 60 * 1000);
        horaFinCalc = formatHHMM(tempEndDate);
    }
    return {
        fechaProgramada: formatYYYYMMDD(dateObjStart),
        horaInicio: formatHHMM(dateObjStart),
        horaFin: horaFinCalc
    };
}

async function inicializarOActualizarCalendario() {
    const calendarEl = document.getElementById('calendarioFullCalendar');
    if (!calendarEl) { console.error("Elemento #calendarioFullCalendar NO encontrado."); return; }
    calendarEl.innerHTML = '<p>Cargando calendario y programaciones...</p>';
    if (typeof FullCalendar === 'undefined' || !FullCalendar.Calendar) {
        calendarEl.innerHTML = "<p>Error: Librería FullCalendar no cargada.</p>"; return;
    }
    const programacionesParaEventos = [];
    try {
        const qProgramaciones = query(collectionGroup(db, 'programaciones'), orderBy('timestampCreacion', 'desc'));
        const snapshotProgramaciones = await getDocs(qProgramaciones);
        for (const progDoc of snapshotProgramaciones.docs) {
            const progData = progDoc.data();
            const requerimientoRef = progDoc.ref.parent.parent;
            let reqDataParaTitulo = { req: '?', cliente: '?' };
            if (requerimientoRef) {
                const reqSnap = await getDoc(requerimientoRef);
                if (reqSnap.exists()) { const d = reqSnap.data(); reqDataParaTitulo = { req: d.req || '?', cliente: d.cliente || '?' }; }
            }
            let startDateTime = progData.fechaProgramada && progData.horaInicio ? `${progData.fechaProgramada}T${progData.horaInicio}` : null;
            if (!startDateTime) continue;
            let endDateTime = progData.fechaProgramada && progData.horaFin ? `${progData.fechaProgramada}T${progData.horaFin}` : null;
             if (!endDateTime) { // Si no hay horaFin explícita, calcular una por defecto o dejar que FullCalendar la maneje
                const tempStartDate = new Date(startDateTime);
                if (!isNaN(tempStartDate.getTime())) {
                    tempStartDate.setHours(tempStartDate.getHours() + 1); // Asumir 1 hora
                    endDateTime = tempStartDate.toISOString().substring(0,16); // YYYY-MM-DDTHH:MM
                }
            }
            programacionesParaEventos.push({
                id: progDoc.id,
                requerimientoId: requerimientoRef ? requerimientoRef.id : null,
                title: `REQ:${reqDataParaTitulo.req} (${reqDataParaTitulo.cliente}) - ${progData.tipoTarea || 'Tarea'} [Téc: ${progData.tecnicosAsignados ? progData.tecnicosAsignados.join(', ') : 'S/A'}]`,
                start: startDateTime,
                end: endDateTime,
                allDay: false, // Asegurarse de que no sean eventos de todo el día si tienen horas
                extendedProps: { ...progData, reqNombre: reqDataParaTitulo.req, clienteNombre: reqDataParaTitulo.cliente, requerimientoId: requerimientoRef ? requerimientoRef.id : null },
            });
        }
    } catch (error) {
        console.error("Error obteniendo programaciones para calendario:", error);
        calendarEl.innerHTML = "<p>Error al cargar datos para el calendario.</p>";
        if (error.message?.toLowerCase().includes("index")) alert("Error de Firestore: Falta un índice. Revisa la consola para crearlo.");
        return;
    }
    if (calendarioFullCalendar) calendarioFullCalendar.destroy();
    try {
        calendarioFullCalendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es', initialView: 'timeGridWeek', editable: true, selectable: true,
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
            events: programacionesParaEventos, contentHeight: 'auto', nowIndicator: true, slotMinTime: "07:00:00", slotMaxTime: "21:00:00",
            eventClick: function(info) {
                const { id: programacionId, extendedProps } = info.event;
                if (!extendedProps.requerimientoId || !programacionId) {
                    alert("Error: No se pudo identificar la programación o el servicio asociado."); return;
                }
                abrirModalProgramaciones(extendedProps.requerimientoId, extendedProps.reqNombre || 'Servicio');
                editarProgramacion(extendedProps.requerimientoId, programacionId);
            },
            eventDrop: async function(info) {
                const { id: programacionId, extendedProps, start, end } = info.event;
                if (!extendedProps.requerimientoId || !programacionId) { info.revert(); alert("Error al mover."); return; }
                const { fechaProgramada, horaInicio, horaFin } = obtenerDetallesDeFechaHora(start, end);
                if (!fechaProgramada || !horaInicio) { info.revert(); alert("Fechas inválidas al mover."); return; }
                try {
                    await updateDoc(doc(db, "requerimientos", extendedProps.requerimientoId, "programaciones", programacionId), {
                        fechaProgramada, horaInicio, horaFin, timestampModificacion: serverTimestamp()
                    });
                    alert(`Programación REQ:${extendedProps.reqNombre} actualizada.`);
                    // Opcional: actualizar título del evento si depende de la hora
                    info.event.setProp('title', `REQ:${extendedProps.reqNombre} (${extendedProps.clienteNombre || ''}) - ${extendedProps.tipoTarea || 'Tarea'} [Téc: ${extendedProps.tecnicosAsignados ? extendedProps.tecnicosAsignados.join(', ') : 'S/A'}]`);
                } catch (error) { console.error("Error al actualizar tras arrastrar:", error); info.revert(); alert("Error al guardar cambio."); }
            },
            eventResize: async function(info) {
                const { id: programacionId, extendedProps, start, end } = info.event;
                if (!extendedProps.requerimientoId || !programacionId) { info.revert(); alert("Error al redimensionar."); return; }
                const { fechaProgramada, horaInicio, horaFin } = obtenerDetallesDeFechaHora(start, end);
                if (!fechaProgramada || !horaInicio || !horaFin) { info.revert(); alert("Fechas inválidas al redimensionar."); return; }
                try {
                    await updateDoc(doc(db, "requerimientos", extendedProps.requerimientoId, "programaciones", programacionId), {
                        fechaProgramada, horaInicio, horaFin, timestampModificacion: serverTimestamp()
                    });
                    alert(`Programación REQ:${extendedProps.reqNombre} redimensionada.`);
                } catch (error) { console.error("Error al actualizar tras redimensionar:", error); info.revert(); alert("Error al guardar cambio."); }
            }
        });
        calendarioFullCalendar.render();
    } catch (e) { console.error("Error CRÍTICO al inicializar FullCalendar:", e); if (calendarEl) calendarEl.innerHTML = "<p>Error fatal al inicializar calendario.</p>"; }
}

// --- LÓGICA DE CARGA MASIVA (COMENTADA) ---
const btnProcesarCsv = document.getElementById('btnProcesarCsv');
if (btnProcesarCsv) {
    btnProcesarCsv.addEventListener('click', () => alert("Carga masiva deshabilitada y necesita rediseño."));
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    if (!modalProgramaciones) console.error("Elemento modalGestionProgramaciones no encontrado.");
    if (!formAddProgramacion) console.warn("Elemento formAddProgramacion no encontrado.");
    mostrarVista('vista-entrada-requerimiento'); // Vista inicial
});

console.log("app.js: <<< Script execution finished.");
