// --- IMPORTS Y CONFIGURACIÓN DE FIREBASE ---
console.log("app.js: >>> Script execution started.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    orderBy, query, serverTimestamp, getDoc, where, collectionGroup, writeBatch
    // limit // <--- COMENTADO SI NO SE USA DIRECTAMENTE O CAUSA CONFLICTOS.
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
let todosLosRecursosTecnicos = []; // Aunque no se usa activamente con las vistas estándar del calendario, se mantiene por si se reintroduce la lógica de recursos.

// Variable para almacenar el estado actual del ordenamiento de la tabla
let ordenActual = {
    columna: 'timestamp', // Columna por defecto para ordenar al cargar (p.ej., la que usa Firebase)
    direccion: 'desc', // Dirección por defecto
    columnaIndiceDOM: -1 // Para saber qué cabecera resaltar
};
let datosOriginalesRequerimientos = []; // Para guardar los datos originales y reordenar sin llamar a Firebase


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
        cargarRequerimientos(); // Esto ahora usará renderizarTablaRequerimientos con los datos ya ordenados o los cargará y ordenará.
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


// Modificar cargarRequerimientos para guardar los datos y luego renderizar
async function cargarRequerimientos() {
    console.log("app.js: cargarRequerimientos called.");
    if (!tablaRequerimientosBody) {
        console.error("Error: El elemento tablaRequerimientosBody no fue encontrado en el DOM.");
        tablaRequerimientosBody.innerHTML = `<tr><td colspan="10">Error crítico: Tabla no encontrada.</td></tr>`;
        return;
    }
    const NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS = 10; // Asegúrate que este número sea correcto para el colspan
    tablaRequerimientosBody.innerHTML = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">Cargando...</td></tr>`;

    try {
        // Siempre consultamos a Firebase ordenado por timestamp la primera vez o si no hay datos locales
        // if (datosOriginalesRequerimientos.length === 0) { // Cargar solo si no hay datos o se fuerza recarga
            const q = query(requerimientosCollectionRef, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            
            datosOriginalesRequerimientos = []; // Limpiar datos anteriores para asegurar que son los más recientes
            if (!querySnapshot.empty) {
                querySnapshot.forEach(docSnap => {
                    datosOriginalesRequerimientos.push({ id: docSnap.id, ...docSnap.data() });
                });
            }
        // }
        
        // Aplicar el ordenamiento actual (que podría ser el de por defecto 'timestamp', 'desc')
        ordenarYRenderizarDatos(ordenActual.columna, ordenActual.direccion, ordenActual.columnaIndiceDOM, true);


    } catch (error) {
        console.error("Error al cargar requerimientos:", error);
        tablaRequerimientosBody.innerHTML = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">Error al cargar datos.</td></tr>`;
    }
}
// window.cargarRequerimientos = cargarRequerimientos; // Asegúrate que siga siendo global si se llama desde HTML directamente en algún punto no visible aquí.


function actualizarIndicadoresDeOrdenVisual(columnaIndiceActivo, direccionActual) {
    const cabeceras = document.querySelectorAll('#tablaRequerimientos thead th[onclick]');
    cabeceras.forEach((th, index) => {
        let textoBase = th.textContent.replace(/ ↓| ↑| ⇅/g, '').trim(); // Quitar flechas anteriores
        if (th.getAttribute('data-original-text')) { // Usar el texto original guardado si existe
            textoBase = th.getAttribute('data-original-text');
        } else {
            th.setAttribute('data-original-text', textoBase); // Guardar el texto original la primera vez
        }

        if (index === columnaIndiceActivo) {
            th.innerHTML = `${textoBase} ${direccionActual === 'asc' ? '↑' : '↓'}`;
        } else {
            th.innerHTML = `${textoBase} <span class="sort-arrow">⇅</span>`; // Usar span para mejor control si es necesario
        }
    });
}


function ordenarTablaPorColumna(columnaIndiceDOM, nombreColumna) {
    let nuevaDireccion;
    if (ordenActual.columna === nombreColumna) {
        nuevaDireccion = ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        nuevaDireccion = 'asc'; // Por defecto ascendente al cambiar de columna
    }
    ordenarYRenderizarDatos(nombreColumna, nuevaDireccion, columnaIndiceDOM);
}
window.ordenarTablaPorColumna = ordenarTablaPorColumna; // Hacerla global para los onclick

function ordenarYRenderizarDatos(nombreColumna, direccion, columnaIndiceDOM, esCargaInicial = false) {
    if (!esCargaInicial) { // Solo actualizar el estado si no es la carga inicial que ya tiene un estado
        ordenActual.columna = nombreColumna;
        ordenActual.direccion = direccion;
        ordenActual.columnaIndiceDOM = columnaIndiceDOM;
    }

    const factor = direccion === 'asc' ? 1 : -1;
    const datosCopia = [...datosOriginalesRequerimientos]; // Siempre ordenar sobre una copia de los originales

    datosCopia.sort((a, b) => {
        let valA = a[nombreColumna];
        let valB = b[nombreColumna];

        // Manejo específico para fechas y números
        if (nombreColumna === 'fechaRecepcion' || nombreColumna === 'fechaTerminoServicio') {
            valA = valA ? new Date(valA).getTime() : 0; // Convertir a timestamp o usar 0/Infinity si está vacío
            valB = valB ? new Date(valB).getTime() : 0;
            // Para fechas vacías, podrías querer que siempre vayan al final o al principio
            if (!a[nombreColumna]) valA = direccion === 'asc' ? Infinity : -Infinity;
            if (!b[nombreColumna]) valB = direccion === 'asc' ? Infinity : -Infinity;
        } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            // No necesita conversión, directo a la comparación
        } else { // Fallback para tipos mixtos o no manejados (considerar nulos o undefined)
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return -1 * factor;
        if (valA > valB) return 1 * factor;
        return 0;
    });

    renderizarTablaRequerimientos(datosCopia);
    if (columnaIndiceDOM !== -1) { // Solo actualizar flechas si no es la carga inicial sin orden específico de usuario
      actualizarIndicadoresDeOrdenVisual(columnaIndiceDOM, direccion);
    } else if (esCargaInicial && nombreColumna === 'timestamp' && direccion === 'desc') {
        // Para la carga inicial por timestamp, podríamos querer no mostrar flechas o una por defecto.
        // O encontrar el índice de 'F. Recepción' si es la representación de 'timestamp' y marcarla.
        const thRecepcion = Array.from(document.querySelectorAll('#tablaRequerimientos thead th[onclick]'))
                               .findIndex(th => th.getAttribute('onclick').includes("'fechaRecepcion'"));
        if (thRecepcion !== -1) {
            actualizarIndicadoresDeOrdenVisual(thRecepcion, 'desc');
        } else {
            actualizarIndicadoresDeOrdenVisual(-1, ''); // Limpiar todas
        }
    }
}


// NUEVA función para renderizar la tabla (separada de la obtención de datos)
function renderizarTablaRequerimientos(datos) {
    if (!tablaRequerimientosBody) { return; }
    const NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS = 10; // Asegúrate que este número sea correcto
    let html = '';
    if (!datos || datos.length === 0) {
        html = `<tr><td colspan="${NUMERO_COLUMNAS_TABLA_REQUERIMIENTOS}">No hay servicios registrados.</td></tr>`;
    } else {
        datos.forEach(data => { // Ahora 'data' ya incluye el 'id'
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
    // Limpiar el buscador cuando se recarga/reordena la tabla
    const buscador = document.getElementById('buscadorServicios');
    if (buscador) buscador.value = "";
}
// --- FUNCIONES AUXILIARES ---
function formatearFechaDesdeYYYYMMDD(fechaString) {
    if (!fechaString || !/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
        return ''; // Retorna vacío si no hay fecha o el formato es incorrecto
    }
    // La fecha ya viene como YYYY-MM-DD, que es un formato que Date.parse puede entender
    // Para asegurar consistencia UTC, podemos añadir T00:00:00Z
    const dateObj = new Date(fechaString + 'T00:00:00Z');
    // Verificar si la fecha es válida después de parsearla
    if (isNaN(dateObj.getTime())) return 'Fecha Inv.'; // Si la fecha es inválida

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
            fechaTerminoServicio: document.getElementById('fechaTerminoServicio').value || null, // Guardar null si está vacío
        };

        if (!requerimientoData.req || !requerimientoData.cliente || !requerimientoData.fechaRecepcion) {
            alert("Los campos Fecha de Recepción, N° REQ/OT y Cliente son obligatorios.");
            return;
        }

        try {
            if (idRequerimiento) {
                const docRef = doc(db, "requerimientos", idRequerimiento);
                // No actualizar timestamp al editar, o añadir un campo 'timestampModificacion' si es necesario
                await updateDoc(docRef, requerimientoData);
                alert('Servicio actualizado con éxito!');
                delete formRequerimiento.dataset.editingId;
            } else {
                requerimientoData.timestamp = serverTimestamp(); // Solo para nuevos requerimientos
                await addDoc(requerimientosCollectionRef, requerimientoData);
                alert('Servicio guardado con éxito! Ahora puedes añadir programaciones desde "Ver Servicios".');
            }
            formRequerimiento.reset();
            if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = 'Registrar Nuevo Servicio';
            datosOriginalesRequerimientos = []; // Forzar recarga desde Firebase la próxima vez que se muestre la vista
            ordenActual = { columna: 'timestamp', direccion: 'desc', columnaIndiceDOM: -1 }; // Resetear orden
            mostrarVista('vista-visualizacion');
        } catch (error) {
            console.error("Error al guardar/actualizar servicio:", error);
            alert('Error al guardar el servicio. Ver consola.');
        }
    });
} else {
    console.warn("Elemento formRequerimiento no encontrado al cargar la página.");
}

// SE ELIMINÓ LA SEGUNDA DEFINICIÓN REDUNDANTE DE cargarRequerimientos() DE AQUÍ

async function editarRequerimiento(id) {
    const docRef = doc(db, "requerimientos", id);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (formRequerimiento) {
                formRequerimiento.reset(); // Limpia el formulario
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
                document.getElementById('fechaTerminoServicio').value = data.fechaTerminoServicio || '';


                formRequerimiento.dataset.editingId = id; // Marcar que estamos editando
                if(vistaEntradaTitulo) vistaEntradaTitulo.textContent = `Editando Servicio REQ: ${data.req || id}`;
                mostrarVista('vista-entrada-requerimiento'); // Cambiar a la vista del formulario
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
    // Usar los datos actualmente renderizados (que ya están ordenados) para el filtrado visual
    // O, si se prefiere, filtrar sobre datosOriginalesRequerimientos y luego re-renderizar.
    // Para simplicidad y performance en el cliente, filtramos lo que ya está en el DOM.
    const tabla = document.getElementById('tablaRequerimientos');
    const filas = tabla.getElementsByTagName('tr');

    // Empezar desde 1 para saltar la fila de cabeceras (<tr><th>...</th></tr>)
    for (let i = 1; i < filas.length; i++) { // Asumiendo que la primera fila es la cabecera
        const filaActual = filas[i];
        const celdas = filaActual.getElementsByTagName('td');
        let visible = false;
        // Iterar sobre todas las celdas EXCEPTO las de acciones y programaciones
        for (let j = 0; j < celdas.length - 2; j++) { // Ajustar el -2 si cambia el número de columnas de acción
            const celda = celdas[j];
            if (celda) {
                const textoCelda = celda.textContent || celda.innerText;
                if (textoCelda.toUpperCase().indexOf(filtro) > -1) {
                    visible = true;
                    break; // Si una celda coincide, la fila es visible
                }
            }
        }
        filaActual.style.display = visible ? "" : "none";
    }
}
window.filtrarTablaServicios = filtrarTablaServicios;


async function eliminarRequerimiento(id) {
    if (confirm('¿Estás seguro de eliminar este servicio y TODAS sus programaciones asociadas? Esta acción no se puede deshacer.')) {
        const batch = writeBatch(db);
        try {
            // Eliminar el requerimiento principal
            const reqDocRef = doc(db, "requerimientos", id);
            batch.delete(reqDocRef);

            // Eliminar todas las subcolecciones de programaciones (si las hubiera)
            // Esto requiere listar primero las programaciones para este requerimiento
            const programacionesRef = collection(db, "requerimientos", id, "programaciones");
            const programacionesSnap = await getDocs(programacionesRef);
            programacionesSnap.forEach(progDoc => {
                batch.delete(progDoc.ref);
            });

            await batch.commit();
            alert('Servicio y sus programaciones eliminados con éxito.');
            datosOriginalesRequerimientos = datosOriginalesRequerimientos.filter(item => item.id !== id); // Actualizar datos locales
            ordenarYRenderizarDatos(ordenActual.columna, ordenActual.direccion, ordenActual.columnaIndiceDOM); // Re-renderizar
            // Si se prefiere siempre recargar de Firebase:
            // cargarRequerimientos();
        } catch (error) {
            console.error("Error al eliminar servicio y sus programaciones:", error);
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
    container.innerHTML = ''; // Limpiar existentes

    if (!LISTA_TECNICOS_PREDEFINIDOS || LISTA_TECNICOS_PREDEFINIDOS.length === 0) {
        container.innerHTML = '<p>No hay técnicos predefinidos en la lista.</p>';
        return;
    }

    LISTA_TECNICOS_PREDEFINIDOS.forEach(tecnico => {
        const labelEl = document.createElement('label');
        const checkboxEl = document.createElement('input');

        checkboxEl.type = 'checkbox';
        checkboxEl.name = 'modalTecnicos'; // Importante para agruparlos
        checkboxEl.value = tecnico;
        // Crear un ID único y válido para el checkbox y el label's 'for'
        const tecnicoIdSanitized = tecnico.replace(/[^a-zA-Z0-9-_]/g, ''); // Sanitizar para ID
        checkboxEl.id = `tec-check-${tecnicoIdSanitized}-${Math.random().toString(36).substr(2, 5)}`; // Añadir aleatorio para unicidad

        labelEl.appendChild(checkboxEl);
        labelEl.appendChild(document.createTextNode(` ${tecnico}`)); // Espacio antes del nombre
        labelEl.htmlFor = checkboxEl.id; // Conectar label con checkbox
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
    formAddProgramacion.reset(); // Limpiar el formulario de añadir programación

    // Desmarcar checkboxes de técnicos
    document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked').forEach(cb => {
        cb.checked = false;
    });

    poblarCheckboxesTecnicos(); // Siempre repoblar por si la lista de técnicos cambia dinámicamente (aunque aquí es fija)

    cargarProgramacionesExistentes(requerimientoId);
    modalProgramaciones.style.display = 'block';
}
window.gestionarProgramaciones = abrirModalProgramaciones; // Hacer global

function cerrarModalProgramaciones() {
    if(modalProgramaciones) modalProgramaciones.style.display = 'none';
}
window.cerrarModalProgramaciones = cerrarModalProgramaciones; // Hacer global

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
            timestampCreacion: serverTimestamp() // Para ordenar/auditar
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
            // Desmarcar checkboxes
            document.querySelectorAll('#modalTecnicosCheckboxContainer input[name="modalTecnicos"]:checked').forEach(cb => {
                cb.checked = false;
            });
            cargarProgramacionesExistentes(requerimientoId); // Recargar la lista
            // Si el calendario está visible, considerar actualizarlo también
            if (document.getElementById('vista-planificacion').style.display === 'block') {
                inicializarOActualizarCalendario();
            }
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
    const q = query(programacionesRef, orderBy("timestampCreacion", "desc")); // O por fechaProgramada

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
            cargarProgramacionesExistentes(requerimientoId); // Recargar lista en modal
            // Si el calendario está visible, considerar actualizarlo también
             if (document.getElementById('vista-planificacion').style.display === 'block') {
                inicializarOActualizarCalendario();
            }
        } catch (error) {
            console.error("Error al eliminar programación:", error);
            alert("Error al eliminar programación.");
        }
    }
}
window.eliminarProgramacion = eliminarProgramacion; // Hacer global


// --- LÓGICA DE GRÁFICOS (ESTADÍSTICAS) ---
let graficoEstatusReq = null;
let graficoCanal = null;
let graficoTiempo1raProg = null;
let graficoTiempoTotal = null;

function diferenciaEnDias(fechaInicioStr, fechaFinStr) {
    if (!fechaInicioStr || !fechaFinStr) return null;
    const inicio = new Date(fechaInicioStr + 'T00:00:00Z');
    const fin = new Date(fechaFinStr + 'T00:00:00Z');
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null;
    const diffTiempo = fin.getTime() - inicio.getTime();
    if (diffTiempo < 0) return null; // Fecha fin no puede ser antes que inicio
    return Math.ceil(diffTiempo / (1000 * 3600 * 24));
}

async function cargarDatosParaGraficosEstadisticas() {
    console.log("app.js: cargarDatosParaGraficosEstadisticas called.");
    try {
        const requerimientosSnapshot = await getDocs(query(requerimientosCollectionRef, orderBy("timestamp", "desc")));
        const dataParaGraficos = [];

        for (const reqDoc of requerimientosSnapshot.docs) {
            const reqData = reqDoc.data();
            reqData.id = reqDoc.id;

            const progRef = collection(db, "requerimientos", reqDoc.id, "programaciones");
            // Para Firestore Web SDK v9, no usamos limit(1) directamente en query, sino que obtenemos y tomamos el primero.
            const qPrimeraProg = query(progRef, orderBy("fechaProgramada", "asc"), orderBy("timestampCreacion", "asc"));

            let primeraFechaProgramada = null;
            try {
                const primerasProgSnapshot = await getDocs(qPrimeraProg);
                if (!primerasProgSnapshot.empty) {
                    // Tomar el primer documento de la instantánea ordenada
                    primeraFechaProgramada = primerasProgSnapshot.docs[0].data().fechaProgramada;
                }
            } catch (e) {
                // No es crítico si un requerimiento no tiene programaciones, solo se omite para ese cálculo.
                console.warn(`No se pudo obtener programaciones para ${reqData.req || reqData.id} o no tiene: ${e.message}`);
            }

            dataParaGraficos.push({
                ...reqData,
                primeraFechaProgramada: primeraFechaProgramada
            });
        }

        // Gráfico por Estatus de Requerimiento
        const conteoEstatus = dataParaGraficos.reduce((acc, curr) => {
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
                    datasets: [{ data: Object.values(conteoEstatus), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#27ae60', '#f39c12', '#c0392b'] }] // Añadí más colores por si hay más estados
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top'}}}
            });
        }

        // Gráfico por Canal de Entrada
        const conteoCanales = dataParaGraficos.reduce((acc, curr) => {
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

        // Gráfico Tiempo Promedio Recepción a 1ra Programación
        const tiemposRecepcionAProgramacion = [];
        dataParaGraficos.forEach(req => {
            if (req.fechaRecepcion && req.primeraFechaProgramada) {
                const diff = diferenciaEnDias(req.fechaRecepcion, req.primeraFechaProgramada);
                if (diff !== null && diff >= 0) {
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
            graficoTiempo1raProg = new Chart(ctxTiempo1Prog, {
                type: 'bar',
                data: {
                    labels: ['Promedio (días)'],
                    datasets: [{
                        label: 'Tiempo Recepción a 1ra Programación',
                        data: [promedioTiempo1Prog.toFixed(1)],
                        backgroundColor: ['#FF9F40']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: {y: {beginAtZero: true, title: { display: true, text: 'Días Promedio' }}}, plugins: { legend: { display: false }}}
            });
        }

        // Gráfico Tiempo Promedio Recepción a Término Servicio
        const tiemposRecepcionATermino = [];
        dataParaGraficos.forEach(req => {
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


// --- LÓGICA DEL CALENDARIO (VISTAS ESTÁNDAR - SIN RECURSOS) ---
async function inicializarOActualizarCalendario() {
    console.log("CALENDARIO: Iniciando inicializarOActualizarCalendario (Vistas Estándar)...");
    const calendarEl = document.getElementById('calendarioFullCalendar');
    if (!calendarEl) {
        console.error("CALENDARIO: Elemento #calendarioFullCalendar NO encontrado en el DOM.");
        return;
    }

    calendarEl.innerHTML = '<p>Cargando calendario y programaciones...</p>'; // Mensaje de carga

    if (typeof FullCalendar === 'undefined' || !FullCalendar || !FullCalendar.Calendar) {
        console.error("CALENDARIO: FullCalendar no está definido o no es accesible. Revisa la etiqueta <script> en index.html y asegúrate que se cargue antes que app.js o que esté disponible globalmente.");
        calendarEl.innerHTML = "<p>Error: Librería FullCalendar no cargada o inaccesible.</p>";
        return;
    }
    console.log("CALENDARIO: FullCalendar está definido.");

    const programacionesParaEventos = [];
    try {
        console.log("CALENDARIO: Intentando obtener programaciones desde Firestore usando collectionGroup...");
        // Usar collectionGroup para obtener todas las 'programaciones' de todos los 'requerimientos'
        const qProgramaciones = query(collectionGroup(db, 'programaciones'), orderBy('timestampCreacion', 'desc'));
        const snapshotProgramaciones = await getDocs(qProgramaciones);
        console.log(`CALENDARIO: Se encontraron ${snapshotProgramaciones.docs.length} documentos de programaciones.`);

        if (snapshotProgramaciones.empty) {
            console.log("CALENDARIO: No se encontraron programaciones en la base de datos.");
        }

        for (const progDoc of snapshotProgramaciones.docs) {
            const progData = progDoc.data();
            // El documento padre (requerimiento) se puede obtener de la referencia del documento de programación
            const requerimientoRef = progDoc.ref.parent.parent; // progDoc.ref -> programacionRef.parent -> programacionesCollectionRef.parent -> requerimientoDocRef
            let reqDataParaTitulo = { req: '?', cliente: '?' }; // Valores por defecto

            if (requerimientoRef) {
                try {
                    const reqSnap = await getDoc(requerimientoRef);
                    if (reqSnap.exists()) {
                        const rData = reqSnap.data();
                        reqDataParaTitulo.req = rData.req || '?'; // Usar '?' si el campo req no existe
                        reqDataParaTitulo.cliente = rData.cliente || '?';
                    } else {
                        console.warn(`CALENDARIO: Documento de requerimiento padre (ID: ${requerimientoRef.id}) no encontrado para programación ${progDoc.id}`);
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
                continue; // Saltar esta programación si no tiene fecha/hora de inicio
            }

            if (progData.fechaProgramada && progData.horaFin) {
                endDateTime = `${progData.fechaProgramada}T${progData.horaFin}`;
            } else { // Si no hay horaFin, podemos omitirla o asumir una duración (FullCalendar puede manejar eventos sin fin)
                console.warn(`CALENDARIO: Programación ${progDoc.id} sin horaFin. El evento podría no tener duración visible en algunas vistas o asumir una por defecto.`);
                // Opcional: calcular una hora de fin por defecto, por ejemplo, 1 hora después del inicio
                try {
                    const startDateObj = new Date(startDateTime);
                    if(isNaN(startDateObj.getTime())) throw new Error("Fecha de inicio inválida para calcular fin");
                    startDateObj.setHours(startDateObj.getHours() + 1);
                    // Formato YYYY-MM-DDTHH:MM:SS
                    endDateTime = startDateObj.toISOString().substring(0, 19);
                } catch (e) {
                     console.error(`CALENDARIO: Error calculando horaFin para ${progDoc.id}`, e);
                     endDateTime = startDateTime; // Como fallback, o dejarlo null/undefined
                }
            }

            const tecnicosTexto = progData.tecnicosAsignados && progData.tecnicosAsignados.length > 0 ?
                                  progData.tecnicosAsignados.join(', ') : 'S/A'; // Sin Asignar

            programacionesParaEventos.push({
                id: progDoc.id, // ID de la programación
                requerimientoId: requerimientoRef ? requerimientoRef.id : null, // ID del requerimiento padre
                title: `REQ:${reqDataParaTitulo.req} (${reqDataParaTitulo.cliente}) - ${progData.tipoTarea || 'Tarea'} [Téc: ${tecnicosTexto}]`,
                start: startDateTime,
                end: endDateTime,
                extendedProps: { // Propiedades personalizadas para mostrar en el clic o para lógica adicional
                    tecnicosOriginales: progData.tecnicosAsignados || [], // Guardar la lista original de técnicos
                    estado: progData.estadoProgramacion || '',
                    notas: progData.notasProgramacion || '',
                    reqNombre: reqDataParaTitulo.req,
                    clienteNombre: reqDataParaTitulo.cliente,
                    tipoTareaOriginal: progData.tipoTarea
                },
                // backgroundColor: getColorForEstado(progData.estadoProgramacion), // Opcional: color según estado
                // borderColor: getColorForEstado(progData.estadoProgramacion)
            });
        }

        console.log(`CALENDARIO: Se procesaron ${programacionesParaEventos.length} eventos para el calendario.`);

    } catch (error) {
        console.error("CALENDARIO: Error obteniendo o procesando programaciones de Firestore:", error);
        if (calendarEl) {
             calendarEl.innerHTML = "<p>Error al cargar datos para el calendario. Revisa la consola (F12).</p>";
        }
        // Si el error es de índice de Firestore (común con collectionGroup la primera vez)
        if (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("índice"))) {
            alert("Error de Firestore: El índice necesario para el calendario aún no está listo o falta. Por favor, créalo usando el enlace que podría aparecer en la consola de errores del navegador y espera a que se habilite (puede tardar unos minutos).");
        }
        return; // No continuar si hay error
    }

    if (calendarioFullCalendar) {
        console.log("CALENDARIO: Destruyendo calendario existente...");
        calendarioFullCalendar.destroy();
        calendarioFullCalendar = null;
    }

    try {
        console.log("CALENDARIO: Creando nueva instancia de FullCalendar (Vistas Estándar).");
        calendarioFullCalendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es', // Para idioma español
            initialView: 'timeGridWeek', // Vista inicial
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' // Botones de vistas
            },
            views: { // Personalizar texto de botones si es necesario
                timeGridDay: { buttonText: 'Día' },
                timeGridWeek: { buttonText: 'Semana' },
                dayGridMonth: { buttonText: 'Mes' },
                listWeek: { buttonText: 'Lista' }
            },
            editable: false, // Los eventos no se pueden arrastrar ni redimensionar
            selectable: true, // Permitir seleccionar rangos de fechas/horas (para posible creación de eventos)
            events: programacionesParaEventos, // Aquí van los eventos cargados
            contentHeight: 'auto', // Altura se ajusta al contenido
            nowIndicator: true, // Muestra un indicador de la hora actual
            slotMinTime: "07:00:00", // Hora de inicio de la cuadrícula
            slotMaxTime: "21:00:00", // Hora de fin de la cuadrícula
            slotEventOverlap: false, // Evitar que los eventos se superpongan visualmente si tienen el mismo recurso (no aplica aquí sin recursos)

            eventClick: function(info) { // Manejador de clic en un evento
                const evento = info.event;
                const props = evento.extendedProps;
                alert(
                    `Servicio REQ: ${props.reqNombre || (evento.title.match(/REQ:([^ ]+)/) ? evento.title.match(/REQ:([^ ]+)/)[1] : '?')}\n` +
                    `Cliente: ${props.clienteNombre || (evento.title.match(/\(([^)]+)\)/) ? evento.title.match(/\(([^)]+)\)/)[1] : '?') }\n` +
                    `Tarea: ${props.tipoTareaOriginal || (evento.title.split(' - ')[1] ? evento.title.split(' - ')[1].split(' [')[0] : '?')}\n` + // Ajuste para extraer la tarea
                    `Fecha: ${evento.start ? evento.start.toLocaleDateString('es-CL') : 'N/A'}\n` +
                    `Hora: ${evento.start ? evento.start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''} - ${evento.end ? evento.end.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit'}) : ''}\n` +
                    `Técnicos: ${props.tecnicosOriginales ? props.tecnicosOriginales.join(', ') : 'No asignados'}\n` +
                    `Estado: ${props.estado || 'N/A'}\n` +
                    `Notas: ${props.notas || ''}`
                );
                // Aquí podrías abrir el modal de edición de programación si lo implementas
                // window.gestionarProgramaciones(evento.extendedProps.requerimientoId, evento.extendedProps.reqNombre);
                // Y luego cargar los datos de este evento específico en el modal.
            },
            // Opcional: Manejador para seleccionar un rango de fechas/horas
            // select: function(selectInfo) {
            //     alert('Seleccionado desde ' + selectInfo.startStr + ' hasta ' + selectInfo.endStr);
            //     // Aquí podrías abrir el modal para crear una nueva programación con estas fechas preseleccionadas
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
} else {
    // console.warn("Botón de carga masiva (btnProcesarCsv) no encontrado. Normal si la sección está comentada.");
}


// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired.");
    // Comprobaciones adicionales para elementos del DOM del modal
    if (!modalProgramaciones) console.error("Elemento modalGestionProgramaciones no encontrado.");
    if (!formAddProgramacion) console.warn("Elemento formAddProgramacion no encontrado. El listener no se añadirá.");

    // Inicializar la vista de 'entrada-requerimiento' o la que prefieras por defecto
    mostrarVista('vista-entrada-requerimiento');
    // O si quieres la tabla de visualización por defecto:
    // mostrarVista('vista-visualizacion');
});

console.log("app.js: <<< Script execution finished.");
