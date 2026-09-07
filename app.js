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
let currentViewMode = "normal"; // Puede ser "normal" o "ocultos"

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
    if (dateStr.includes('-')) return new Date(dateStr + 'T00:00:00');
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    return new Date(dateStr);
}

// Validación matemática estricta para 10,000
function esPrimeraOcasion(motivo) {
    if (!motivo) return "N";
    // Eliminamos comas para limpiar la cadena (ej. "10,000" -> "10000")
    const textoLimpio = String(motivo).replace(/,/g, '');
    // Extraemos secuencias numéricas continuas
    const numeros = textoLimpio.match(/\d+/g);
    if (numeros && numeros.includes("10000")) {
        return "Y";
    }
    return "N";
}

function renderTable(dataArray) {
    const tableBody = document.getElementById("tableBody");
    let rowsHtml = "";

    // Filtramos según la vista actual antes de dibujar
    const datosMostrar = dataArray.filter(row => {
        if (currentViewMode === "normal") return !row.descartado;
        return row.descartado === true; // Vista de ocultos
    });

    datosMostrar.forEach(row => {
        const { first, last } = splitName(row.Cliente);
        
        let calif = (row.calif || "").toLowerCase();
        let rowClass = "";
        if (calif.includes("molesto")) rowClass = "row-molesto";
        else if (calif.includes("dudoso")) rowClass = "row-dudoso";
        else if (calif.includes("contento")) rowClass = "row-contento";
        else if (calif.includes("excelente")) rowClass = "row-excelente";

        const primeraOcasion = esPrimeraOcasion(row.Servicio);
        const actionBtn = currentViewMode === "normal" 
            ? `<button class="btn-action" data-id="${row.id}" data-action="hide">X</button>`
            : `<button class="btn-action restore" data-id="${row.id}" data-action="restore">↩</button>`;

        rowsHtml += `
            <tr class="${rowClass}">
                <td>${actionBtn}</td>
                <td>B20ABVE002</td>
                <td>Hyundai Coatza</td>
                <td>VERACRUZ</td>
                <td>${row.VIN || ""}</td>
                <td>C</td>
                <td>MANTENIMIENTO</td>
                <td class="col-vacia"></td>
                <td>${first}</td>
                <td>${last}</td>
                <td class="col-vacia"></td>
                <td class="col-vacia"></td>
                <td class="col-vacia"></td>
                <td class="col-vacia"></td>
                <td>${row.Asesor || ""}</td>
                <td class="col-vacia"></td>
                <td>${row.Vehiculo || ""}</td>
                <td>HMM</td>
                <td>H</td>
                <td class="col-vacia"></td>
                <td>B20AB</td>
                <td>VE002</td>
                <td>${primeraOcasion}</td>
                <td class="col-vacia"></td>
                <td class="col-vacia"></td>
                <td class="col-vacia"></td>
                <td>${row.Fecha || ""}</td>
                <td>${row.Servicio || ""}</td>
                <td>${row.calif || ""}</td>
                <td>${row.comentarios || ""}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;
}

async function loadData() {
    const loader = document.getElementById("loader");
    const tableContainer = document.getElementById("tableContainer");

    try {
        const dbRef = ref(database, 'historial_completado');
        const snapshot = await get(dbRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Mapeamos el ID real de Firebase para poder actualizarlo después
            allFirebaseData = Object.keys(data).map(key => {
                return { ...data[key], id: key };
            });
            
            renderTable(allFirebaseData);
            loader.style.display = "none";
            tableContainer.style.display = "block";
            setupDoubleClickEvents();
        } else {
            loader.innerHTML = "<p>No hay datos en Firebase.</p>";
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// Lógica para descartar/restaurar en Firebase
document.getElementById('tableBody').addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.classList.contains('btn-action')) {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        const isHiding = action === 'hide';
        const msg = isHiding ? "¿Descartar este registro del reporte?" : "¿Restaurar este registro a la tabla principal?";
        
        if (confirm(msg)) {
            try {
                // Actualiza el nodo específico en Firebase
                const updates = {};
                updates['historial_completado/' + id + '/descartado'] = isHiding;
                await update(ref(database), updates);

                // Actualiza la memoria local
                const rowIndex = allFirebaseData.findIndex(r => r.id === id);
                if (rowIndex > -1) {
                    allFirebaseData[rowIndex].descartado = isHiding;
                }
                
                // Aplicar filtros de fecha actuales si existen
                aplicarFiltros(); 
            } catch (error) {
                alert("Error al comunicar con Firebase: " + error.message);
            }
        }
    }
});

// Colapso de columnas con Doble Clic
function setupDoubleClickEvents() {
    const headers = document.querySelectorAll('#tableHeaders th');
    headers.forEach((th, index) => {
        th.addEventListener('dblclick', () => {
            th.classList.toggle('collapsed-col');
            const rows = document.querySelectorAll('#tableBody tr');
            rows.forEach(row => {
                const td = row.children[index];
                if (td) td.classList.toggle('collapsed-col');
            });
        });
    });
}

// Botón: Ver Ocultos / Volver
document.getElementById('toggleViewBtn').addEventListener('click', (e) => {
    if (currentViewMode === "normal") {
        currentViewMode = "ocultos";
        e.target.textContent = "Volver a Vista Normal";
        e.target.style.backgroundColor = "#e74c3c"; // Rojo
    } else {
        currentViewMode = "normal";
        e.target.textContent = "Ver Ocultos";
        e.target.style.backgroundColor = "#f39c12"; // Naranja
    }
    aplicarFiltros();
});

// Filtros de fecha centralizados
function aplicarFiltros() {
    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;

    if (!startDateStr || !endDateStr) {
        renderTable(allFirebaseData);
        return;
    }

    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);
    endDate.setHours(23, 59, 59, 999); 

    const filteredData = allFirebaseData.filter(row => {
        if (!row.Fecha) return false;
        const rowDate = parseDateString(row.Fecha);
        return rowDate >= startDate && rowDate <= endDate;
    });

    renderTable(filteredData);
}

document.getElementById('filterBtn').addEventListener('click', () => {
    aplicarFiltros();
    document.getElementById('resetBtn').style.display = 'inline-block';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    aplicarFiltros();
    document.getElementById('resetBtn').style.display = 'none';
});

// Exportar a Excel a partir de datos crudos (ignora colapsos y UI)
document.getElementById('exportExcelBtn').addEventListener('click', () => {
    // Tomamos solo los datos visibles según el filtro y vista actual
    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;
    
    let datosExportar = allFirebaseData.filter(row => {
        if (currentViewMode === "normal" && row.descartado) return false;
        if (currentViewMode === "ocultos" && !row.descartado) return false;
        
        if (startDateStr && endDateStr && row.Fecha) {
            const sd = parseDateString(startDateStr);
            const ed = parseDateString(endDateStr);
            ed.setHours(23, 59, 59, 999);
            const rd = parseDateString(row.Fecha);
            if (rd < sd || rd > ed) return false;
        }
        return true;
    });

    // Mapeo exacto de las columnas de JD Power
    const arrayParaExcel = datosExportar.map(row => {
        const { first, last } = splitName(row.Cliente);
        return {
            "Codigo de Dealer": "B20ABVE002",
            "Nombre del Dealer [Nombre comercial NO razon Social]": "Hyundai Coatza",
            "Ciudad o Estado": "VERACRUZ",
            "VIN": row.VIN || "",
            "Tipo de Orden (W, C ó I)": "C",
            "Tipo de Operación": "MANTENIMIENTO",
            "Número de Orden": "",
            "Nombre del Cliente": first,
            "Apellido del cliente": last,
            "Teléfono de contacto del cliente 1 [10 digitos]": "",
            "Teléfono de contacto del cliente 2 [10 digitos]": "",
            "Teléfono de contacto del cliente 3 [10 digitos]": "",
            "E-mail del cliente": "",
            "Nombre de Asesor de Servicio": row.Asesor || "",
            "RFC del Asesor": "",
            "Modelo del Auto": row.Vehiculo || "",
            "Subsidiario (HMM)": "HMM",
            "Marca (H)": "H",
            "Fecha de envio": "",
            "Codigo de Region (B20AB)": "B20AB",
            "Codigo unico Dealer": "VE002",
            "Cliente de 1era ocasión (Y ó N)": esPrimeraOcasion(row.Servicio),
            "Año modelo del vehiculo": "",
            "Fecha de cierre de (Orden de Reparación)": "",
            "Monto total pagado en la RO": "",
            "Fecha de Cita": row.Fecha || "",
            "Motivo": row.Servicio || "",
            "Calificación": row.calif || "",
            "Obserservaciones": row.comentarios || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(arrayParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "JDPower");
    XLSX.writeFile(wb, "Reporte_HyundaiCoatza.xlsx");
});

document.getElementById('toggleColsBtn').addEventListener('click', (e) => {
    const emptyCols = document.querySelectorAll('.col-vacia');
    let isHidden = emptyCols[0].style.display === 'none';
    emptyCols.forEach(col => col.style.display = isHidden ? '' : 'none');
    e.target.textContent = isHidden ? "Ocultar Columnas Vacías" : "Mostrar Columnas Vacías";
});

document.addEventListener("DOMContentLoaded", loadData);