/**
 * ProcessControl · Lógica Funcional
 * =====================================================
 * Módulos:
 *  1. Estado & Persistencia (localStorage)
 *  2. Utilidades de Fecha & Semáforo
 *  3. Renderizado del Dashboard
 *  4. Validación & Formulario
 *  5. Carga de Archivos (JSON / preparado para XLSX)
 *  6. Búsqueda & Filtros
 *  7. Inicialización
 */

'use strict';

/* ══════════════════════════════════════════════════
   1. ESTADO & PERSISTENCIA
══════════════════════════════════════════════════ */

const STORAGE_KEY = 'processcontrol_empresas';

/** Carga las empresas desde localStorage */
function cargarEmpresas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Guarda el array de empresas en localStorage */
function guardarEmpresas(empresas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empresas));
}

/** Genera un ID único basado en timestamp + random */
function generarId() {
  return `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ══════════════════════════════════════════════════
   2. UTILIDADES DE FECHA & SEMÁFORO
══════════════════════════════════════════════════ */

/**
 * Devuelve la fecha de hoy a las 00:00:00 (sin hora)
 * para evitar comparaciones incorrectas por zona horaria.
 */
function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parsea una cadena "YYYY-MM-DD" como fecha local (no UTC).
 * new Date("YYYY-MM-DD") interpreta en UTC y puede desfasar un día.
 */
function parseFecha(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calcula los días restantes hasta la fecha de fin.
 * Negativo → ya venció. 0 → vence hoy.
 */
function diasRestantes(fechaFinStr) {
  const fin   = parseFecha(fechaFinStr);
  const hoyMs = hoy().getTime();
  return Math.ceil((fin.getTime() - hoyMs) / (1000 * 60 * 60 * 24));
}

/**
 * Clasifica la empresa según el semáforo.
 * verde → fin ≤ 30 días desde hoy
 * rojo  → fin >  30 días desde hoy (o ya venció)
 * 
 * Regla de negocio:
 *  - "Procesos en Tiempo" = quedan ≤ 30 días (prioridad alta, actuar pronto)
 *  - "Procesos Excedidos" = quedan > 30 días  (menor urgencia)
 */
function clasificar(empresa) {
  const dias = diasRestantes(empresa.fechaFin);
  return dias <= 30 ? 'green' : 'red';
}

/**
 * Calcula el porcentaje de avance del proceso
 * desde fechaInicio hasta fechaFin.
 */
function calcularProgreso(empresa) {
  const inicio = parseFecha(empresa.fechaInicio).getTime();
  const fin    = parseFecha(empresa.fechaFin).getTime();
  const ahora  = hoy().getTime();
  if (fin === inicio) return 100;
  const pct = ((ahora - inicio) / (fin - inicio)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Formatea "YYYY-MM-DD" → "DD/MM/YYYY" para visualización */
function formatearFecha(str) {
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/* ══════════════════════════════════════════════════
   3. RENDERIZADO DEL DASHBOARD
══════════════════════════════════════════════════ */

/**
 * Construye el HTML de una tarjeta de proceso.
 * @param {Object} empresa - Objeto con los datos de la empresa
 * @returns {HTMLElement}
 */
function crearTarjeta(empresa) {
  const tipo      = clasificar(empresa);
  const dias      = diasRestantes(empresa.fechaFin);
  const progreso  = calcularProgreso(empresa);
  const llamada   = empresa.llamadaRealizada || false;

  // Texto descriptivo de días
  let diasTexto;
  if (dias < 0)      diasTexto = `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
  else if (dias === 0) diasTexto = 'Vence hoy';
  else                diasTexto = `${dias} día${dias !== 1 ? 's' : ''} restantes`;

  const card = document.createElement('div');
  card.className = `process-card ${tipo}${llamada ? ' llamada-realizada' : ''}`;
  card.dataset.id = empresa.id;

  card.innerHTML = `
    <!-- Cabecera: empresa + acciones -->
    <div class="card-top">
      <div>
        <div class="card-company">${escapeHtml(empresa.nombre)}</div>
        <div class="card-entrevistador">👤 ${escapeHtml(empresa.entrevistador)}</div>
      </div>
      <div class="card-actions">
        <span class="card-days ${tipo}">● ${diasTexto}</span>
        <button class="btn-delete" data-id="${empresa.id}" title="Eliminar registro">✕</button>
      </div>
    </div>

    <!-- Información de fechas y contacto -->
    <div class="card-info">
      <div class="card-info-item">
        <span class="info-label">Inicio</span>
        <span class="info-value">${formatearFecha(empresa.fechaInicio)}</span>
      </div>
      <div class="card-info-item">
        <span class="info-label">Fin</span>
        <span class="info-value">${formatearFecha(empresa.fechaFin)}</span>
      </div>
      <div class="card-info-item">
        <span class="info-label">Teléfono</span>
        <span class="info-value">${escapeHtml(empresa.telefono)}</span>
      </div>
      <div class="card-info-item">
        <span class="info-label">Correo</span>
        <span class="info-value">${escapeHtml(empresa.correo)}</span>
      </div>
    </div>

    <!-- Barra de progreso temporal -->
    <div class="card-progress-wrap">
      <div class="progress-label">
        <span>Progreso del proceso</span>
        <span>${progreso}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${tipo}" style="width: ${progreso}%"></div>
      </div>
    </div>

    <!-- Footer: toggle de llamada -->
    <div class="card-footer">
      <span class="call-label">
        <span class="call-icon">📞</span>
        ${llamada ? 'Llamada realizada' : 'Llamada pendiente'}
      </span>
      <label class="toggle-switch" title="Marcar llamada">
        <input type="checkbox" class="toggle-llamada" data-id="${empresa.id}" ${llamada ? 'checked' : ''} />
        <span class="toggle-track"></span>
      </label>
    </div>
  `;

  return card;
}

/**
 * Renderiza las listas filtradas según la búsqueda activa.
 * Aplica el semáforo y actualiza contadores.
 */
function renderizar(filtro = '') {
  const empresas    = cargarEmpresas();
  const listGreen   = document.getElementById('list-green');
  const listRed     = document.getElementById('list-red');
  const emptyGreen  = document.getElementById('empty-green');
  const emptyRed    = document.getElementById('empty-red');

  // Limpiar listas (excepto empty state)
  listGreen.innerHTML = '';
  listRed.innerHTML   = '';

  const termino = filtro.toLowerCase().trim();

  // Filtrar por búsqueda
  const filtradas = termino
    ? empresas.filter(e =>
        e.nombre.toLowerCase().includes(termino) ||
        e.entrevistador.toLowerCase().includes(termino) ||
        e.correo.toLowerCase().includes(termino)
      )
    : empresas;

  let cntGreen = 0;
  let cntRed   = 0;

  filtradas.forEach(empresa => {
    const tipo  = clasificar(empresa);
    const tarjeta = crearTarjeta(empresa);

    if (tipo === 'green') {
      listGreen.appendChild(tarjeta);
      cntGreen++;
    } else {
      listRed.appendChild(tarjeta);
      cntRed++;
    }
  });

  // Mostrar/ocultar empty states
  listGreen.appendChild(crearEmptyState(cntGreen, 'verde'));
  listRed.appendChild(crearEmptyState(cntRed, 'rojo'));

  if (cntGreen > 0) listGreen.querySelector('.empty-state')?.remove();
  if (cntRed   > 0) listRed.querySelector('.empty-state')?.remove();

  // Actualizar contadores en UI
  actualizarContadores(cntGreen, cntRed);
}

function crearEmptyState(count, color) {
  if (count > 0) return document.createDocumentFragment();
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `<span class="empty-icon">◎</span><p>Sin procesos ${color === 'verde' ? 'en tiempo' : 'excedidos'}</p>`;
  return div;
}

function actualizarContadores(green, red) {
  document.getElementById('count-green').textContent = green;
  document.getElementById('count-red').textContent   = red;
  document.getElementById('badge-green').textContent = green;
  document.getElementById('badge-red').textContent   = red;
}

/** Muestra la fecha de hoy en el header */
function mostrarFechaHoy() {
  const opciones = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  const texto    = new Date().toLocaleDateString('es-CO', opciones);
  // Capitalizar primera letra
  document.getElementById('today-date').textContent =
    texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ══════════════════════════════════════════════════
   4. VALIDACIÓN & FORMULARIO
══════════════════════════════════════════════════ */

/** Reglas de validación por campo */
const reglas = {
  nombre: {
    validate: v => v.trim().length >= 3,
    msg: 'Ingresa al menos 3 caracteres.'
  },
  entrevistador: {
    validate: v => v.trim().length >= 3,
    msg: 'Ingresa al menos 3 caracteres.'
  },
  'fecha-inicio': {
    validate: v => Boolean(v),
    msg: 'Selecciona una fecha de inicio.'
  },
  'fecha-fin': {
    validate: (v, form) => {
      if (!v) return false;
      const inicio = form.querySelector('#fecha-inicio').value;
      if (!inicio) return true; // ya será capturado por inicio
      return parseFecha(v) >= parseFecha(inicio);
    },
    msg: 'La fecha de fin debe ser igual o posterior al inicio.'
  },
  telefono: {
    validate: v => /^[+\d\s\-().]{7,20}$/.test(v.trim()),
    msg: 'Ingresa un número de teléfono válido.'
  },
  correo: {
    validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    msg: 'Ingresa un correo electrónico válido.'
  }
};

/**
 * Valida un campo individual.
 * @returns {boolean}
 */
function validarCampo(id, form) {
  const input  = form.querySelector(`#${id}`);
  const errEl  = form.querySelector(`#err-${id}`);
  const regla  = reglas[id];
  if (!regla || !input) return true;

  const valido = regla.validate(input.value, form);
  input.classList.toggle('error', !valido);
  if (errEl) errEl.textContent = valido ? '' : regla.msg;
  return valido;
}

/** Valida todo el formulario. Devuelve true si es válido. */
function validarFormulario(form) {
  const campos = Object.keys(reglas);
  return campos.map(id => validarCampo(id, form)).every(Boolean);
}

/** Inicializa la lógica del formulario manual */
function initFormulario() {
  const form = document.getElementById('empresa-form');

  // Validación on-blur para feedback inmediato
  Object.keys(reglas).forEach(id => {
    const el = form.querySelector(`#${id}`);
    if (el) {
      el.addEventListener('blur', () => validarCampo(id, form));
      el.addEventListener('input', () => {
        if (el.classList.contains('error')) validarCampo(id, form);
      });
    }
  });

  // Submit
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validarFormulario(form)) return;

    const empresas = cargarEmpresas();

    // Construir objeto empresa
    const nueva = {
      id:              generarId(),
      nombre:          form.querySelector('#nombre').value.trim(),
      entrevistador:   form.querySelector('#entrevistador').value.trim(),
      fechaInicio:     form.querySelector('#fecha-inicio').value,
      fechaFin:        form.querySelector('#fecha-fin').value,
      telefono:        form.querySelector('#telefono').value.trim(),
      correo:          form.querySelector('#correo').value.trim().toLowerCase(),
      llamadaRealizada:false,
      creadoEn:        new Date().toISOString()
    };

    // Evitar duplicados exactos (mismo nombre + fechas)
    const duplicado = empresas.some(e =>
      e.nombre.toLowerCase() === nueva.nombre.toLowerCase() &&
      e.fechaInicio === nueva.fechaInicio &&
      e.fechaFin === nueva.fechaFin
    );

    if (duplicado) {
      mostrarToast('⚠ Ya existe un registro con estos datos', true);
      return;
    }

    empresas.unshift(nueva); // más reciente primero
    guardarEmpresas(empresas);
    renderizar(document.getElementById('search-input').value);
    form.reset();
    // Limpiar errores
    Object.keys(reglas).forEach(id => {
      const el = form.querySelector(`#${id}`);
      if (el) el.classList.remove('error');
      const err = form.querySelector(`#err-${id}`);
      if (err) err.textContent = '';
    });

    mostrarToast(`"${nueva.nombre}" registrada correctamente ✓`);
  });
}

/* ══════════════════════════════════════════════════
   5. CARGA DE ARCHIVOS
══════════════════════════════════════════════════ */

function initCargaArchivo() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const feedback  = document.getElementById('upload-feedback');

  // Drag & drop
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const archivo = e.dataTransfer.files[0];
    if (archivo) procesarArchivo(archivo, feedback);
  });

  fileInput.addEventListener('change', () => {
    const archivo = fileInput.files[0];
    if (archivo) procesarArchivo(archivo, feedback);
    fileInput.value = ''; // reset para permitir recargar mismo archivo
  });
}

/**
 * Procesa un archivo JSON o XLSX (preparado).
 * Para XLSX requeriría SheetJS en producción.
 */
function procesarArchivo(archivo, feedbackEl) {
  feedbackEl.classList.remove('hidden', 'success', 'error');

  if (archivo.name.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const datos = JSON.parse(e.target.result);
        if (!Array.isArray(datos)) throw new Error('El JSON debe ser un array.');
        const resultado = importarDatos(datos);
        mostrarFeedback(feedbackEl, resultado);
      } catch (err) {
        mostrarFeedback(feedbackEl, { error: err.message });
      }
    };
    reader.readAsText(archivo);

  } else if (archivo.name.endsWith('.xlsx')) {
    // En producción: cargar SheetJS desde CDN o npm
    // y usar XLSX.read() para convertir a JSON.
    mostrarFeedback(feedbackEl, {
      error: 'Soporte XLSX preparado. Integra SheetJS (xlsx) para habilitar esta función.'
    });
  } else {
    mostrarFeedback(feedbackEl, { error: 'Formato no soportado. Usa .json o .xlsx' });
  }
}

/**
 * Importa un array de objetos al localStorage.
 * Mapea claves flexibles (nombre, company, empresa, etc.)
 */
function importarDatos(datos) {
  const empresas = cargarEmpresas();
  let importados = 0;
  let omitidos   = 0;

  datos.forEach(item => {
    // Normalizar claves
    const nombre        = item.nombre || item.company || item.empresa || '';
    const entrevistador = item.entrevistador || item.interviewer || item.responsable || '';
    const fechaInicio   = item.fechaInicio   || item.inicio      || item.startDate   || '';
    const fechaFin      = item.fechaFin      || item.fin         || item.endDate     || '';
    const telefono      = item.telefono      || item.phone       || item.tel         || '';
    const correo        = (item.correo       || item.email       || '').toLowerCase();

    // Validación mínima
    if (!nombre || !fechaFin) { omitidos++; return; }

    const duplicado = empresas.some(e =>
      e.nombre.toLowerCase() === nombre.toLowerCase() &&
      e.fechaFin === fechaFin
    );

    if (duplicado) { omitidos++; return; }

    empresas.unshift({
      id:              generarId(),
      nombre,
      entrevistador,
      fechaInicio:     fechaInicio || new Date().toISOString().split('T')[0],
      fechaFin,
      telefono,
      correo,
      llamadaRealizada:false,
      creadoEn:        new Date().toISOString()
    });

    importados++;
  });

  guardarEmpresas(empresas);
  renderizar();
  return { importados, omitidos };
}

function mostrarFeedback(el, resultado) {
  el.classList.remove('hidden');
  if (resultado.error) {
    el.className = 'upload-feedback error';
    el.textContent = `Error: ${resultado.error}`;
  } else {
    el.className = 'upload-feedback success';
    el.textContent = `✓ ${resultado.importados} empresa(s) importada(s). ${resultado.omitidos} omitida(s) por duplicado o datos incompletos.`;
  }
}

/* ══════════════════════════════════════════════════
   6. EVENTOS DEL DASHBOARD
══════════════════════════════════════════════════ */

/** Delegación de eventos para las tarjetas */
function initEventosDashboard() {
  const dashboard = document.querySelector('.dashboard');
  let idParaEliminar = null;

  // Delegación: toggle de llamada
  dashboard.addEventListener('change', e => {
    if (e.target.classList.contains('toggle-llamada')) {
      const id      = e.target.dataset.id;
      const empresas = cargarEmpresas();
      const empresa  = empresas.find(emp => emp.id === id);
      if (!empresa) return;

      empresa.llamadaRealizada = e.target.checked;
      guardarEmpresas(empresas);

      // Actualizar clase en la tarjeta sin re-renderizar todo
      const tarjeta = dashboard.querySelector(`.process-card[data-id="${id}"]`);
      if (tarjeta) {
        tarjeta.classList.toggle('llamada-realizada', empresa.llamadaRealizada);
        const label = tarjeta.querySelector('.call-label');
        if (label) {
          label.innerHTML = `
            <span class="call-icon">📞</span>
            ${empresa.llamadaRealizada ? 'Llamada realizada' : 'Llamada pendiente'}
          `;
        }
      }
    }
  });

  // Delegación: botón eliminar
  dashboard.addEventListener('click', e => {
    const btnDel = e.target.closest('.btn-delete');
    if (btnDel) {
      idParaEliminar = btnDel.dataset.id;
      const empresas = cargarEmpresas();
      const empresa  = empresas.find(emp => emp.id === idParaEliminar);
      if (empresa) {
        document.getElementById('modal-body').textContent =
          `¿Deseas eliminar el registro de "${empresa.nombre}"? Esta acción no se puede deshacer.`;
      }
      document.getElementById('modal-overlay').classList.remove('hidden');
    }
  });

  // Modal: confirmar eliminación
  document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    if (!idParaEliminar) return;
    const empresas   = cargarEmpresas().filter(e => e.id !== idParaEliminar);
    guardarEmpresas(empresas);
    renderizar(document.getElementById('search-input').value);
    cerrarModal();
    idParaEliminar = null;
    mostrarToast('Registro eliminado');
  });

  // Modal: cancelar
  document.getElementById('btn-modal-cancel').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  // Limpiar todo
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!cargarEmpresas().length) return;
    idParaEliminar = '__ALL__';
    document.getElementById('modal-body').textContent =
      '¿Deseas eliminar TODOS los registros? Esta acción no se puede deshacer.';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('btn-modal-confirm').addEventListener('click', function once() {
      if (idParaEliminar === '__ALL__') {
        guardarEmpresas([]);
        renderizar();
        cerrarModal();
        mostrarToast('Todos los registros eliminados');
        idParaEliminar = null;
      }
      this.removeEventListener('click', once);
    }, { once: true });
  });
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

/* ══════════════════════════════════════════════════
   7. BÚSQUEDA Y TABS
══════════════════════════════════════════════════ */

function initBusqueda() {
  const input = document.getElementById('search-input');
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => renderizar(input.value), 200);
  });
}

function initTabs() {
  const tabs    = document.querySelectorAll('.tab');
  const tabsMap = {
    manual:  document.getElementById('tab-manual'),
    archivo: document.getElementById('tab-archivo')
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      Object.values(tabsMap).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      tabsMap[btn.dataset.tab].classList.add('active');
    });
  });
}

/* ══════════════════════════════════════════════════
   UTILIDADES GENERALES
══════════════════════════════════════════════════ */

/** Escapa HTML para evitar XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Muestra una notificación tipo toast.
 * @param {string}  msg   - Mensaje a mostrar
 * @param {boolean} warn  - Si true, usa estilo de advertencia
 */
function mostrarToast(msg, warn = false) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  toast.style.background = warn ? 'var(--red-dim)' : '';
  toast.style.borderColor = warn ? 'rgba(239,68,68,.4)' : '';
  toast.style.color = warn ? 'var(--red)' : '';
  // Forzar reflow para reiniciar animación
  toast.getBoundingClientRect();
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
  setTimeout(() => toast.classList.add('hidden'), 3600);
}

/* ══════════════════════════════════════════════════
   8. INICIALIZACIÓN
══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  mostrarFechaHoy();
  initTabs();
  initFormulario();
  initCargaArchivo();
  initEventosDashboard();
  initBusqueda();
  renderizar(); // Carga inicial desde localStorage
});
