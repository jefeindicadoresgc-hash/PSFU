import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-x8ZZvJXAOK7Q18PVWPybmfPZ7xDBNHo",
    authDomain: "tablero-pruebas.firebaseapp.com",
    databaseURL: "https://tablero-pruebas-default-rtdb.firebaseio.com",
    projectId: "tablero-pruebas"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let allFirebaseData = []; 
let currentViewMode = "normal";
let isAdmin = false;

// --- CARRUSEL SIMPSONS ---
let currentGifIndex = 1;
setInterval(() => {
    currentGifIndex = currentGifIndex >= 7 ? 1 : currentGifIndex + 1;
    const gifElement = document.getElementById('simpsonGif');
    if (gifElement) {
        gifElement.src = `MEDIA/GIF${currentGifIndex}.gif`;
    }
}, 3500);

// --- FUNCIONES DE FORMATEO Y LÓGICA DE NEGOCIO ---
function splitName(fullName) {
    if (!fullName) return { first: "", last: "" };
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    const first = parts.shift();
    const last = parts.join(" ");
    return { first, last };
}

function parseDateString(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return new Date((dateStr - (25567 + 2)) * 86400 * 1000);
    const str = String(dateStr);
    if (str.includes('-')) return new Date(str + 'T00:00:00');
    const parts = str.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    return new Date(str);
}

function esPrimeraOcasion(motivo) {
    if (!motivo) return "N";
    const numeros = String(motivo).replace(/,/g, '').match(/\d+/g);
    if (numeros && numeros.includes("10000")) return "Y";
    return "N";
}

function formatAsesor(asesorStr) {
    if (!asesorStr) return "";
    const match = asesorStr.match(/(0[12]\s*ASE)[-\s]+([A-ZÁÉÍÓÚÑ]+)/i);
    if (match) {
        return `${match[1].replace('-','').trim()} ${match[2]}`.toUpperCase();
    }
    return asesorStr.split(" ")[0].toUpperCase();
}

function updateDatalists() {
    const pfsuSet = new Set(), mejoraSet = new Set();
    const com1Set = new Set(), com2Set = new Set();

    allFirebaseData.forEach(row => {
        if (row.Comentario_PFSU) pfsuSet.add(row.Comentario_PFSU);
        if (row.Area_Mejora) mejoraSet.add(row.Area_Mejora);
        if (row.Comentarios_Atencion) com1Set.add(row.Comentarios_Atencion);
        if (row.Comentarios_NPS) com2Set.add(row.Comentarios_NPS);
    });

    const buildOptions = (set) => Array.from(set).map(val => `<option value="${val}">`).join('');
    
    const pfsuList = document.getElementById('list-pfsu');
    const mejoraList = document.getElementById('list-mejora');
    const com1List = document.getElementById('list-comentarios1');
    const com2List = document.getElementById('list-comentarios2');

    if (pfsuList) pfsuList.innerHTML = buildOptions(pfsuSet);
    if (mejoraList) mejoraList.innerHTML = buildOptions(mejoraSet);
    if (com1List) com1List.innerHTML = buildOptions(com1Set);
    if (com2List) com2List.innerHTML = buildOptions(com2Set);
}

// --- RENDERIZADO DE TABLA ---
function renderTable(dataArray) {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    
    let rowsHtml = "";

    const datosMostrar = dataArray.filter(row => currentViewMode === "normal" ? !row.descartado : row.descartado === true);

    datosMostrar.sort((a, b) => {
        if (!a.FechaCierre && !b.FechaCierre) return 0;
        if (!a.FechaCierre) return 1;
        if (!b.FechaCierre) return -1;
        return parseDateString(b.FechaCierre) - parseDateString(a.FechaCierre);
    });

    datosMostrar.forEach(row => {
        const { first, last } = splitName(row.Cliente);
        let rowClass = (row.calif || "").toLowerCase().includes("molesto") ? "row-molesto" :
                       (row.calif || "").toLowerCase().includes("dudoso") ? "row-dudoso" :
                       (row.calif || "").toLowerCase().includes("contento") ? "row-contento" :
                       (row.calif || "").toLowerCase().includes("excelente") ? "row-excelente" : "";
        if (!row.FechaCierre) rowClass += " opacity-75"; 

        const actionBtn = currentViewMode === "normal" 
            ? `<button class="btn-action" data-id="${row.id}" data-action="hide">X</button>`
            : `<button class="btn-action restore" data-id="${row.id}" data-action="restore">↩</button>`;

        const editAttr = isAdmin ? `contenteditable="true" class="editable-cell"` : "";

        const selContactado = `
            <select class="free-edit-select" data-id="${row.id}" data-field="Contactado">
                <option value=""></option>
                <option value="Si" ${row.Contactado === 'Si' ? 'selected' : ''}>Sí</option>
                <option value="No" ${row.Contactado === 'No' ? 'selected' : ''}>No</option>
            </select>`;
        
        const selLavado = `
            <select class="free-edit-select" data-id="${row.id}" data-field="Calificacion_Lavado">
                <option value=""></option>
                <option value="Bueno" ${row.Calificacion_Lavado === 'Bueno' ? 'selected' : ''}>Bueno</option>
                <option value="Malo" ${row.Calificacion_Lavado === 'Malo' ? 'selected' : ''}>Malo</option>
            </select>`;
            
        const selAtencion = `
            <select class="free-edit-select" data-id="${row.id}" data-field="Atencion_Entrega">
                <option value=""></option>
                <option value="Buena" ${row.Atencion_Entrega === 'Buena' ? 'selected' : ''}>Buena</option>
                <option value="Mala" ${row.Atencion_Entrega === 'Mala' ? 'selected' : ''}>Mala</option>
            </select>`;

        rowsHtml += `
            <tr class="${rowClass}" data-rowid="${row.id}">
                <td>${actionBtn}</td>
                <td class="col-no-importante">B20ABVE002</td>
                <td class="col-no-importante">Hyundai Coatza</td>
                <td class="col-no-importante">VERACRUZ</td>
                <td ${editAttr} data-field="VIN">${row.VIN || ""}</td>
                <td class="col-no-importante">C</td>
                <td class="col-no-importante">MANTENIMIENTO</td>
                <td ${editAttr} data-field="OrdenReparacion">${row.OrdenReparacion || ""}</td>
                <td ${editAttr} data-field="Cliente">${first}</td>
                <td ${editAttr} data-field="Cliente">${last}</td>
                <td ${editAttr} data-field="NombreExcel">${row.NombreExcel || ""}</td>
                <td ${editAttr} data-field="TelefonoExcel">${row.TelefonoExcel || ""}</td>
                <td class="col-no-importante">${row.TelefonoExcel || ""}</td>
                <td class="col-no-importante">${row.TelefonoExcel || ""}</td>
                <td class="col-no-importante" ${editAttr} data-field="EmailExcel">${row.EmailExcel || ""}</td>
                <td ${editAttr} data-field="Asesor">${formatAsesor(row.Asesor)}</td>
                <td class="col-no-importante"></td>
                <td ${editAttr} data-field="Vehiculo">${row.Vehiculo || ""}</td>
                <td class="col-no-importante">HMM</td>
                <td class="col-no-importante">H</td>
                <td class="col-no-importante"></td>
                <td class="col-no-importante">B20AB</td>
                <td class="col-no-importante">VE002</td>
                <td>${esPrimeraOcasion(row.Servicio)}</td>
                <td ${editAttr} data-field="AnioModelo">${row.AnioModelo || ""}</td>
                <td ${editAttr} data-field="FechaCierre">${row.FechaCierre || ""}</td>
                <td ${editAttr} data-field="MontoTotal">${row.MontoTotal || ""}</td>
                <td ${editAttr} data-field="Fecha">${row.Fecha || ""}</td>
                <td ${editAttr} data-field="Servicio">${row.Servicio || ""}</td>
                <td ${editAttr} data-field="calif">${row.calif || ""}</td>
                <td ${editAttr} data-field="comentarios">${row.comentarios || ""}</td>
                
                <!-- Campos CRM -->
                <td>${selContactado}</td>
                <td><input type="text" class="free-edit-input" list="list-pfsu" data-id="${row.id}" data-field="Comentario_PFSU" value="${row.Comentario_PFSU || ''}"></td>
                <td>${selLavado}</td>
                <td><input type="text" class="free-edit-input" list="list-mejora" data-id="${row.id}" data-field="Area_Mejora" value="${row.Area_Mejora || ''}"></td>
                <td>${selAtencion}</td>
                <td><input type="text" class="free-edit-input" list="list-comentarios1" data-id="${row.id}" data-field="Comentarios_Atencion" value="${row.Comentarios_Atencion || ''}"></td>
                <td><input type="number" class="free-edit-input" data-id="${row.id}" data-field="NPS" value="${row.NPS || ''}" min="0" max="10"></td>
                <td><input type="text" class="free-edit-input" list="list-comentarios2" data-id="${row.id}" data-field="Comentarios_NPS" value="${row.Comentarios_NPS || ''}"></td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;
}

// --- EVENTOS DE GUARDADO (CRM Y ADMIN) ---
document.getElementById('tableBody')?.addEventListener('change', async (e) => {
    if (e.target.classList.contains('free-edit-select') || e.target.classList.contains('free-edit-input')) {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        const value = e.target.value.trim();

        try {
            const updates = {};
            updates[`historial_completado/${id}/${field}`] = value;
            await update(ref(database), updates);
            
            const row = allFirebaseData.find(r => r.id === id);
            if (row) row[field] = value;
            
            updateDatalists();
        } catch (error) {
            alert("Error al guardar campo CRM: " + error.message);
        }
    }
});

document.getElementById('tableBody')?.addEventListener('focusout', async (e) => {
    if (isAdmin && e.target.tagName === 'TD' && e.target.isContentEditable) {
        const tr = e.target.closest('tr');
        const id = tr.dataset.rowid;
        const field = e.target.dataset.field;
        let newValue = e.target.innerText.trim();

        if (id && field) {
            try {
                if(field === "Cliente") {
                    const firstTd = tr.children[8].innerText.trim();
                    const lastTd = tr.children[9].innerText.trim();
                    newValue = `${firstTd} ${lastTd}`.trim();
                }
                const updates = {};
                updates[`historial_completado/${id}/${field}`] = newValue;
                await update(ref(database), updates);
                
                const row = allFirebaseData.find(r => r.id === id);
                if (row) row[field] = newValue;
            } catch (error) {
                alert("Error al guardar estructura base: " + error.message);
            }
        }
    }
});

// --- ACCIONES DE INTERFAZ Y CARGA EXCEL ---
document.getElementById('adminLockBtn')?.addEventListener('click', (e) => {
    if (!isAdmin) {
        const pin = prompt("PIN de Administrador:");
        if (pin === "2099") {
            isAdmin = true;
            e.target.textContent = "🔓 Edición DB Habilitada";
            e.target.classList.add("unlocked");
            aplicarFiltros(); 
        } else if (pin !== null) {
            alert("Acceso denegado, ¡multiplícate por cero!");
        }
    } else {
        isAdmin = false;
        e.target.textContent = "🔒 Desbloquear Edición DB";
        e.target.classList.remove("unlocked");
        aplicarFiltros(); 
    }
});

document.getElementById('excelUpload')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const loader = document.getElementById("loader");
    const tableContainer = document.getElementById("tableContainer");
    document.getElementById("loaderText").innerText = "Procesando Excel...";
    tableContainer.style.display = "none";
    loader.style.display = "flex";

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            const excelRowsByVin = {};
            rows.forEach((row, index) => {
                if (index === 0) return; 
                const vin = row[6]; 
                if (!vin) return;
                
                if (!excelRowsByVin[vin]) excelRowsByVin[vin] = [];
                excelRowsByVin[vin].push({
                    orden: row[0] || "",
                    nombre: row[1] || "",
                    tel: row[2] || "",
                    email: row[4] || "",
                    anio: row[10] || "",
                    fechaCierre: row[11] || "",
                    monto: parseFloat(row[13]) || 0 
                });
            });

            const resolvedExcelData = {};
            for (const vin in excelRowsByVin) {
                let group = excelRowsByVin[vin];
                const nGroup = group.filter(r => String(r.orden).toUpperCase().startsWith('N'));
                if (nGroup.length > 0) group = nGroup;
                group.sort((a, b) => b.monto - a.monto);
                resolvedExcelData[vin] = group[0];
            }

            const updates = {};
            let actualizados = 0;

            allFirebaseData.forEach(fbMatch => {
                const excelMatch = resolvedExcelData[fbMatch.VIN];
                if (excelMatch) {
                    updates[`historial_completado/${fbMatch.id}/OrdenReparacion`] = excelMatch.orden;
                    updates[`historial_completado/${fbMatch.id}/NombreExcel`] = excelMatch.nombre;
                    updates[`historial_completado/${fbMatch.id}/TelefonoExcel`] = excelMatch.tel;
                    updates[`historial_completado/${fbMatch.id}/EmailExcel`] = excelMatch.email;
                    updates[`historial_completado/${fbMatch.id}/AnioModelo`] = excelMatch.anio;
                    updates[`historial_completado/${fbMatch.id}/FechaCierre`] = excelMatch.fechaCierre;
                    updates[`historial_completado/${fbMatch.id}/MontoTotal`] = excelMatch.monto;
                    actualizados++;
                }
            });

            if (Object.keys(updates).length > 0) {
                await update(ref(database), updates);
                alert(`¡Excelente! Se actualizaron ${actualizados} registros.`);
                await fetchFirebaseData(); 
            } else {
                alert("No se encontraron coincidencias de VIN.");
                loader.style.display = "none";
                tableContainer.style.display = "block";
            }
        } catch (error) {
            alert("Error leyendo el Excel: " + error.message);
        }
        e.target.value = ''; 
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('tableBody')?.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.classList.contains('btn-action')) {
        const id = e.target.dataset.id;
        const isHiding = e.target.dataset.action === 'hide';
        if (confirm(isHiding ? "¿Descartar este registro?" : "¿Restaurar registro?")) {
            const updates = {};
            updates['historial_completado/' + id + '/descartado'] = isHiding;
            await update(ref(database), updates);
            const rowIndex = allFirebaseData.findIndex(r => r.id === id);
            if (rowIndex > -1) allFirebaseData[rowIndex].descartado = isHiding;
            aplicarFiltros(); 
        }
    }
});

document.getElementById('toggleColsBtn')?.addEventListener('click', (e) => {
    const hiddenCols = document.querySelectorAll('.col-no-importante');
    let isHidden = hiddenCols.length > 0 && hiddenCols[0].style.display === 'none';
    hiddenCols.forEach(col => col.style.display = isHidden ? '' : 'none');
    e.target.textContent = isHidden ? "Ocultar No Importantes" : "Mostrar No Importantes";
});

document.getElementById('toggleViewBtn')?.addEventListener('click', (e) => {
    if (currentViewMode === "normal") {
        currentViewMode = "ocultos";
        e.target.textContent = "Volver a Vista Normal";
    } else {
        currentViewMode = "normal";
        e.target.textContent = "Ver Ocultos";
    }
    aplicarFiltros();
});

// --- LÓGICA DE FILTROS ---
function aplicarFiltros() {
    const startDateElement = document.getElementById('startDate');
    const endDateElement = document.getElementById('endDate');
    
    if (!startDateElement || !endDateElement) return;

    const startDateStr = startDateElement.value;
    const endDateStr = endDateElement.value;

    if (!startDateStr || !endDateStr) {
        renderTable(allFirebaseData);
        return;
    }

    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);
    endDate.setHours(23, 59, 59, 999); 

    const filteredData = allFirebaseData.filter(row => {
        if (!row.FechaCierre) return false; 
        const rowDate = parseDateString(row.FechaCierre);
        return rowDate >= startDate && rowDate <= endDate;
    });

    renderTable(filteredData);
}

document.getElementById('filterBtn')?.addEventListener('click', () => {
    aplicarFiltros();
    const resetBtn = document.getElementById('resetBtn');
    if(resetBtn) resetBtn.style.display = 'inline-block';
});

document.getElementById('resetBtn')?.addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    aplicarFiltros();
    document.getElementById('resetBtn').style.display = 'none';
});

// --- EXPORTAR A EXCEL ---
document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;
    
    let datosExportar = allFirebaseData.filter(row => {
        if (currentViewMode === "normal" && row.descartado) return false;
        if (currentViewMode === "ocultos" && !row.descartado) return false;
        if (startDateStr && endDateStr && row.FechaCierre) {
            const sd = parseDateString(startDateStr);
            const ed = parseDateString(endDateStr);
            ed.setHours(23, 59, 59, 999);
            const rd = parseDateString(row.FechaCierre);
            if (rd < sd || rd > ed) return false;
        } else if (startDateStr && endDateStr && !row.FechaCierre) {
            return false;
        }
        return true;
    });

    const arrayParaExcel = datosExportar.map(row => {
        const { first, last } = splitName(row.Cliente);
        return {
            "Codigo de Dealer": "B20ABVE002",
            "Nombre del Dealer": "Hyundai Coatza",
            "Ciudad o Estado": "VERACRUZ",
            "VIN": row.VIN || "",
            "Tipo de Orden (W, C ó I)": "C",
            "Tipo de Operación": "MANTENIMIENTO",
            "ORDEN": row.OrdenReparacion || "",
            "Nombre": first,
            "Apellido": last,
            "Nombre Completo (DMS)": row.NombreExcel || "",
            "Telefono": row.TelefonoExcel || "",
            "Teléfono de contacto 2": row.TelefonoExcel || "",
            "Teléfono de contacto 3": row.TelefonoExcel || "",
            "E-mail del cliente": row.EmailExcel || "",
            "Nombre de Asesor": formatAsesor(row.Asesor),
            "RFC del Asesor": "",
            "Modelo del Auto": row.Vehiculo || "",
            "Subsidiario (HMM)": "HMM",
            "Marca (H)": "H",
            "Fecha de envio": "",
            "Codigo de Region (B20AB)": "B20AB",
            "Codigo unico Dealer": "VE002",
            "Y o N": esPrimeraOcasion(row.Servicio),
            "Año": row.AnioModelo || "",
            "F.Factura": row.FechaCierre || "",
            "Total": row.MontoTotal || "",
            "Fecha de Cita": row.Fecha || "",
            "Motivo": row.Servicio || "",
            "Calificación": row.calif || "",
            "Observaciones": row.comentarios || "",
            "CONTACTADO": row.Contactado || "",
            "Comentario de PFSU": row.Comentario_PFSU || "",
            "Calificacion de lavado": row.Calificacion_Lavado || "",
            "Area de mejora": row.Area_Mejora || "",
            "Atencion y entrega": row.Atencion_Entrega || "",
            "Comentarios Atencion": row.Comentarios_Atencion || "",
            "NPS": row.NPS || "",
            "Comentarios NPS": row.Comentarios_NPS || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(arrayParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "JDPower_Full");
    XLSX.writeFile(wb, "Reporte_JDPower_CRM.xlsx");
});

// --- INICIALIZACIÓN PRINCIPAL ---
async function fetchFirebaseData() {
    const loader = document.getElementById("loader");
    const tableContainer = document.getElementById("tableContainer");
    if(loader) loader.style.display = "flex";

    try {
        const dbRef = ref(database, 'historial_completado');
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            allFirebaseData = Object.keys(data).map(key => ({ ...data[key], id: key }));
            updateDatalists();
            aplicarFiltros();
            if(loader) loader.style.display = "none";
            if(tableContainer) tableContainer.style.display = "block";
        } else {
            if(loader) loader.innerHTML = "<p>D'oh! No hay datos en Firebase.</p>";
        }
    } catch (error) {
        console.error("Error:", error);
        if(loader) loader.innerHTML = `<p style="color:red;">Error de red: ${error.message}</p>`;
    }
}

// ARREGLO DE CARGA SEGURA: Garantiza que la función se dispare sin importar el tiempo de renderizado
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchFirebaseData);
} else {
    fetchFirebaseData();
}