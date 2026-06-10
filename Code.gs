/**
 * ============================================================
 *  BOT DE WHATSAPP — INFORME DIARIO DE PRÁCTICAS
 * ============================================================
 *  Registra por WhatsApp lo que haces en tus prácticas (texto,
 *  fotos y audios) y genera automáticamente un informe Word
 *  (.docx) en tu Google Drive, organizado en carpetas por día.
 *
 *  Flujo: saludas → [🚀 Comenzar] → envías texto/fotos/audios →
 *  [➕ Agregar más] / [✅ Finalizar] → informe en Drive.
 *
 *  Instalación completa: ver README.md
 *  https://github.com/  (tu repositorio)
 *
 *  Además de la CONFIGURACIÓN de abajo, necesitas estas 4
 *  Propiedades del Script (⚙️ Configuración del proyecto):
 *    VERIFY_TOKEN     → palabra secreta que tú inventas (la misma que pondrás en Meta)
 *    WHATSAPP_TOKEN   → token de acceso de la app de Meta
 *    PHONE_NUMBER_ID  → "Identificador de número de teléfono" de Meta
 *    GEMINI_API_KEY   → clave de la API de Gemini (aistudio.google.com)
 * ============================================================
 */

// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURACIÓN — edita esta sección con tus datos         ║
// ╚══════════════════════════════════════════════════════════╝

// Carpeta de Drive donde se guardarán los informes:
//  · Opción A: pega aquí el ID de una carpeta tuya (la parte final de su URL,
//              p. ej. de https://drive.google.com/drive/folders/ABC123 → 'ABC123').
//  · Opción B: déjalo vacío ('') y se creará automáticamente una carpeta
//              llamada como REPORT_FOLDER_NAME en la raíz de tu Drive.
const REPORT_FOLDER_ID = '';
const REPORT_FOLDER_NAME = 'Informes Prácticas';

// Nombre del archivo generado: <REPORT_PREFIX>_DD_MM_AAAA.docx
const REPORT_PREFIX = 'INFORME DIARIO';

// Cada día se crea una subcarpeta con la fecha. 'dd/MM/yy' → "09/06/26".
// Si sincronizas Drive con tu PC (Drive para escritorio), usa 'dd-MM-yy':
// las barras no son válidas en carpetas de Windows/Mac.
const DAY_FOLDER_FORMAT = 'dd/MM/yy';
const EVIDENCE_FOLDER_NAME = 'Evidencias';

// Tipografía y formato del documento
const FONT = 'Century Gothic';
const FONT_SIZE = 12;
const LINE_SPACING = 2; // 2 = interlineado doble, 1 = sencillo, 1.5 = uno y medio

// Portada del informe. Deja un campo en '' para omitir esa línea.
const PORTADA = {
  titulo: 'INFORME DIARIO DE PRÁCTICAS',
  autor: 'Tu Nombre Completo',
  universidad: 'Tu Universidad',
  facultad: 'Tu Facultad o Programa',
  ciudad: 'Tu Ciudad'
};

// Zona horaria (lista completa:
// https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
const TZ = 'America/Bogota';

// --- Avanzado (normalmente no hace falta tocarlo) ---
const WA_API_VERSION = 'v21.0';
const GEMINI_MODEL = 'gemini-2.5-flash';
const SHEET_NAME = 'Registro Bot Prácticas';

// ╔══════════════════════════════════════════════════════════╗
// ║  FIN DE LA CONFIGURACIÓN — de aquí en adelante es código  ║
// ╚══════════════════════════════════════════════════════════╝

// ------------------------------------------------------------
// WEBHOOK (lo que WhatsApp llama)
// ------------------------------------------------------------

/** Verificación inicial del webhook (Meta hace un GET una sola vez). */
function doGet(e) {
  const p = e.parameter || {};
  if (p['hub.mode'] === 'subscribe' && p['hub.verify_token'] === getProp_('VERIFY_TOKEN')) {
    return ContentService.createTextOutput(p['hub.challenge']);
  }
  return ContentService.createTextOutput('Token de verificación incorrecto');
}

/** Recepción de mensajes (Meta hace un POST por cada mensaje). */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const value = data.entry && data.entry[0] && data.entry[0].changes &&
                  data.entry[0].changes[0] && data.entry[0].changes[0].value;
    const msg = value && value.messages && value.messages[0];

    if (msg) {
      // Evita procesar dos veces el mismo mensaje si Meta lo reintenta
      const cache = CacheService.getScriptCache();
      if (!cache.get('msg_' + msg.id)) {
        cache.put('msg_' + msg.id, '1', 21600);
        const contactName = (value.contacts && value.contacts[0] &&
                             value.contacts[0].profile && value.contacts[0].profile.name) || '';
        handleMessage_(msg, contactName);
      }
    }
  } catch (err) {
    logError_(err);
  }
  return ContentService.createTextOutput('OK');
}

// ------------------------------------------------------------
// LÓGICA DE CONVERSACIÓN
// ------------------------------------------------------------

function handleMessage_(msg, contactName) {
  const from = msg.from;

  // --- Botones ---
  if (msg.type === 'interactive') {
    const btn = msg.interactive && msg.interactive.button_reply && msg.interactive.button_reply.id;
    if (btn === 'BTN_START' || btn === 'BTN_ADD') {
      setState_(from, 'collecting');
      sendText_(from, '📝 Perfecto. Envíame lo que quieras registrar: un *texto*, una *foto* o un *audio*.');
    } else if (btn === 'BTN_FINISH') {
      finishReport_(from);
    }
    return;
  }

  // --- Si aún no ha comenzado: saludo + botón Comenzar ---
  if (getState_(from) !== 'collecting') {
    const saludo = contactName ? '¡Hola, ' + contactName + '! 👋' : '¡Hola! 👋';
    sendButtons_(from,
      saludo + ' Soy tu asistente de prácticas.\n\nCuando quieras, registramos las actividades de hoy para tu informe diario.',
      [{ id: 'BTN_START', title: '🚀 Comenzar' }]);
    return;
  }

  // --- Modo registro: procesar lo que envíe ---
  if (msg.type === 'text') {
    addEntry_('texto', msg.text.body, '');
    askNext_(from, '✅ Texto registrado.');

  } else if (msg.type === 'image') {
    const media = downloadMedia_(msg.image.id);
    const file = saveEvidence_(media.blob, 'foto', media.mime);
    const caption = (msg.image.caption || '').trim();
    let desc = '';
    try {
      desc = geminiDescribeImage_(media.blob, caption);
    } catch (err) { logError_(err); }
    const contenido = (caption ? caption + '\n' : '') + (desc || '(imagen guardada, descripción pendiente)');
    addEntry_('imagen', contenido, file.getId());
    askNext_(from, '✅ Imagen procesada y guardada como evidencia.');

  } else if (msg.type === 'audio') {
    const media = downloadMedia_(msg.audio.id);
    let txt = '';
    try {
      txt = geminiTranscribe_(media.blob);
    } catch (err) { logError_(err); }
    if (txt) {
      addEntry_('audio', txt, '');
      askNext_(from, '✅ Audio transcrito y registrado.');
    } else {
      const file = saveEvidence_(media.blob, 'audio', media.mime);
      addEntry_('audio', PENDING_AUDIO_MARK, file.getId());
      askNext_(from, '⚠️ Guardé tu audio, pero no pude transcribirlo en este momento. Lo reintentaré al generar el informe.');
    }

  } else {
    askNext_(from, '🤔 Por ahora solo puedo procesar *texto*, *imágenes* y *audios*.');
  }
}

const PENDING_AUDIO_MARK = '(audio pendiente de transcribir)';

/** Confirma y vuelve a ofrecer los botones Agregar / Finalizar. */
function askNext_(to, prefix) {
  sendButtons_(to, prefix + '\n\n¿Deseas agregar algo más al informe de hoy?', [
    { id: 'BTN_ADD', title: '➕ Agregar más' },
    { id: 'BTN_FINISH', title: '✅ Finalizar' }
  ]);
}

// ------------------------------------------------------------
// GENERACIÓN DEL INFORME
// ------------------------------------------------------------

function finishReport_(from) {
  const entries = getEntriesForToday_();
  if (entries.length === 0) {
    setState_(from, 'idle');
    sendButtons_(from, 'No registraste actividades hoy, así que no hay nada que informar 🙂', [
      { id: 'BTN_START', title: '🚀 Comenzar' }
    ]);
    return;
  }

  sendText_(from, '⏳ Generando tu informe, dame un momento...');

  // Reintenta transcribir audios que quedaron pendientes
  retryPendingAudios_(entries);

  // Pide a Gemini la redacción formal
  const material = entries.map(function (en, i) {
    return (i + 1) + '. [' + en.hora + ' · ' + en.tipo + '] ' + en.contenido;
  }).join('\n');

  let cuerpo;
  try {
    cuerpo = geminiGenerate_([{
      text:
        'Eres un asistente que redacta informes de prácticas estudiantiles.\n' +
        'Redacta ÚNICAMENTE el cuerpo del informe en español formal, en tercera persona impersonal ' +
        '("se realizó", "se observó"), en párrafos corridos.\n' +
        'No inventes actividades ni datos que no estén en el registro. ' +
        'No uses markdown, viñetas, títulos, saludos ni despedidas. ' +
        'Si hay imágenes registradas, menciónalas como evidencia adjunta.\n\n' +
        'Actividades registradas hoy, en orden cronológico:\n' + material
    }]);
  } catch (err) {
    logError_(err);
    // Plan B: si Gemini falla, el informe lleva el material crudo
    cuerpo = 'Actividades registradas durante la jornada:\n\n' +
      entries.map(function (en) { return '• ' + en.hora + ' — ' + en.contenido; }).join('\n\n');
  }

  const file = buildDocx_(cuerpo, entries);
  setState_(from, 'idle');

  const dayName = Utilities.formatDate(new Date(), TZ, DAY_FOLDER_FORMAT);
  sendText_(from,
    '📄 ¡Listo! Tu informe se guardó en Drive, en la carpeta del día *' + dayName + '*:\n\n' +
    '*' + file.getName() + '*\n' + file.getUrl() +
    '\n\nSi registras más cosas hoy y vuelves a finalizar, el informe se actualizará con todo lo del día. ¡Éxitos en tus prácticas! 💪');
}

/**
 * Crea el documento con formato académico (tipografía, interlineado
 * y portada configurables arriba) y lo exporta como .docx a Drive.
 */
function buildDocx_(cuerpo, entries) {
  const now = new Date();
  const dd = Utilities.formatDate(now, TZ, 'dd');
  const mm = Utilities.formatDate(now, TZ, 'MM');
  const yyyy = Utilities.formatDate(now, TZ, 'yyyy');
  const reportName = REPORT_PREFIX + '_' + dd + '_' + mm + '_' + yyyy;

  const doc = DocumentApp.create(reportName);
  const body = doc.getBody();

  // Página carta con márgenes de 1"
  body.setPageWidth(612).setPageHeight(792)
      .setMarginTop(72).setMarginBottom(72).setMarginLeft(72).setMarginRight(72);

  const baseAttrs = {};
  baseAttrs[DocumentApp.Attribute.FONT_FAMILY] = FONT;
  baseAttrs[DocumentApp.Attribute.FONT_SIZE] = FONT_SIZE;

  // Párrafo con el estilo base del documento
  function para(text, opts) {
    opts = opts || {};
    const p = body.appendParagraph(text || '');
    p.setAttributes(baseAttrs);
    p.setLineSpacing(LINE_SPACING);
    p.setSpacingAfter(0);
    p.setAlignment(opts.center ? DocumentApp.HorizontalAlignment.CENTER
                               : DocumentApp.HorizontalAlignment.LEFT);
    p.setIndentFirstLine(opts.indent ? 36 : 0); // 36 pt = 0,5"
    if (text) {
      p.editAsText().setBold(!!opts.bold).setItalic(!!opts.italic);
    }
    return p;
  }

  // ---------- PORTADA ----------
  // El doc nuevo trae un primer párrafo vacío: lo usamos para el título
  const titulo = body.getParagraphs()[0];
  titulo.setText(PORTADA.titulo || REPORT_PREFIX);
  titulo.setAttributes(baseAttrs);
  titulo.setLineSpacing(LINE_SPACING).setIndentFirstLine(0)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titulo.editAsText().setBold(true);

  para(''); para('');
  if (PORTADA.autor) {
    para('Elaborado por:', { center: true });
    para('', { center: true });
    para(PORTADA.autor, { center: true });
    para('', { center: true });
  }
  if (PORTADA.universidad) para(PORTADA.universidad, { center: true });
  if (PORTADA.facultad) para(PORTADA.facultad, { center: true });
  para(''); para(''); para(''); para('');
  if (PORTADA.ciudad) para(PORTADA.ciudad, { center: true });
  para(fechaLargaEs_(now), { center: true });

  body.appendPageBreak();

  // ---------- CUERPO ----------
  para('DESARROLLO DE ACTIVIDADES', { center: true, bold: true });
  para('');
  cuerpo.split(/\n\s*\n/).forEach(function (parTxt) {
    const t = parTxt.trim();
    if (t) para(t, { indent: true });
  });

  // ---------- EVIDENCIA FOTOGRÁFICA ----------
  const images = entries.filter(function (en) { return en.tipo === 'imagen' && en.fileId; });
  if (images.length > 0) {
    para('');
    para('EVIDENCIA FOTOGRÁFICA', { center: true, bold: true });
    para('');
    images.forEach(function (en, i) {
      try {
        const blob = DriveApp.getFileById(en.fileId).getBlob();
        const pImg = body.appendParagraph('');
        pImg.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        const img = pImg.appendInlineImage(blob);
        const maxW = 400;
        if (img.getWidth() > maxW) {
          const ratio = img.getHeight() / img.getWidth();
          img.setWidth(maxW).setHeight(Math.round(maxW * ratio));
        }
        const cap = para('Figura ' + (i + 1) + '. ' + en.contenido.split('\n')[0], { center: true, italic: true });
        cap.setLineSpacing(1); // los pies de figura van a espacio sencillo
        para('');
      } catch (err) { logError_(err); }
    });
  }

  doc.saveAndClose();

  // Exporta a .docx
  const exportUrl = 'https://docs.google.com/document/d/' + doc.getId() + '/export?format=docx';
  const docxBlob = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob().setName(reportName + '.docx');

  // Guarda en la carpeta del día y reemplaza un informe anterior, si existe
  const dayFolder = getDayFolder_();
  const olds = dayFolder.getFilesByName(reportName + '.docx');
  while (olds.hasNext()) olds.next().setTrashed(true);
  const out = dayFolder.createFile(docxBlob);

  // El Google Doc temporal ya no hace falta
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  return out;
}

/** "lunes, 9 de junio de 2026" sin depender del idioma del servidor. */
function fechaLargaEs_(d) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dia = Number(Utilities.formatDate(d, TZ, 'u')) % 7; // 1=lunes ... 7=domingo
  const num = Number(Utilities.formatDate(d, TZ, 'd'));
  const mes = Number(Utilities.formatDate(d, TZ, 'M')) - 1;
  const anio = Utilities.formatDate(d, TZ, 'yyyy');
  return dias[dia] + ', ' + num + ' de ' + meses[mes] + ' de ' + anio;
}

// ------------------------------------------------------------
// REGISTRO DEL DÍA (hoja de cálculo)
// ------------------------------------------------------------

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { id = null; }
  }
  if (!id) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(getReportsFolder_());
    props.setProperty('SHEET_ID', ss.getId());
  }
  let sheet = ss.getSheetByName('Registro');
  if (!sheet) {
    sheet = ss.getSheets()[0].setName('Registro');
    sheet.appendRow(['Fecha', 'Hora', 'Tipo', 'Contenido', 'FileId']);
  }
  return sheet;
}

function addEntry_(tipo, contenido, fileId) {
  const now = new Date();
  getSheet_().appendRow([
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    Utilities.formatDate(now, TZ, 'HH:mm'),
    tipo, contenido, fileId || ''
  ]);
}

function getEntriesForToday_() {
  const sheet = getSheet_();
  const hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    let fecha = rows[i][0];
    if (fecha instanceof Date) fecha = Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd');
    if (String(fecha) === hoy) {
      out.push({ row: i + 1, hora: String(rows[i][1]), tipo: rows[i][2], contenido: rows[i][3], fileId: rows[i][4] });
    }
  }
  return out;
}

function retryPendingAudios_(entries) {
  const sheet = getSheet_();
  entries.forEach(function (en) {
    if (en.tipo === 'audio' && en.contenido === PENDING_AUDIO_MARK && en.fileId) {
      try {
        const blob = DriveApp.getFileById(en.fileId).getBlob();
        const txt = geminiTranscribe_(blob);
        if (txt) {
          en.contenido = txt;
          sheet.getRange(en.row, 4).setValue(txt);
        }
      } catch (err) { logError_(err); }
    }
  });
}

// ------------------------------------------------------------
// CARPETAS EN DRIVE
// ------------------------------------------------------------

/** Carpeta principal de informes (por ID, o por nombre si no configuraste ID). */
function getReportsFolder_() {
  if (REPORT_FOLDER_ID) return DriveApp.getFolderById(REPORT_FOLDER_ID);
  return getOrCreateFolder_(DriveApp.getRootFolder(), REPORT_FOLDER_NAME);
}

/** Subcarpeta del día (según DAY_FOLDER_FORMAT) dentro de la carpeta principal. */
function getDayFolder_() {
  const name = Utilities.formatDate(new Date(), TZ, DAY_FOLDER_FORMAT);
  return getOrCreateFolder_(getReportsFolder_(), name);
}

function getEvidenceFolder_() {
  return getOrCreateFolder_(getDayFolder_(), EVIDENCE_FOLDER_NAME);
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function saveEvidence_(blob, prefix, mime) {
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a' }[mime] || '';
  const name = prefix + '_' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HH-mm-ss') + ext;
  return getEvidenceFolder_().createFile(blob.setName(name));
}

// ------------------------------------------------------------
// WHATSAPP (envío y descarga)
// ------------------------------------------------------------

function waSend_(payload) {
  const resp = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + WA_API_VERSION + '/' + getProp_('PHONE_NUMBER_ID') + '/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + getProp_('WHATSAPP_TOKEN') },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  if (resp.getResponseCode() >= 300) {
    logError_(new Error('Error al enviar a WhatsApp: ' + resp.getContentText()));
  }
}

function sendText_(to, text) {
  waSend_({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } });
}

function sendButtons_(to, bodyText, buttons) {
  waSend_({
    messaging_product: 'whatsapp', to: to, type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: buttons.map(function (b) { return { type: 'reply', reply: { id: b.id, title: b.title } }; }) }
    }
  });
}

/** Descarga una imagen/audio enviado por WhatsApp. */
function downloadMedia_(mediaId) {
  const token = getProp_('WHATSAPP_TOKEN');
  const meta = JSON.parse(UrlFetchApp.fetch(
    'https://graph.facebook.com/' + WA_API_VERSION + '/' + mediaId,
    { headers: { Authorization: 'Bearer ' + token } }).getContentText());
  const mime = String(meta.mime_type || '').split(';')[0].trim();
  const blob = UrlFetchApp.fetch(meta.url, { headers: { Authorization: 'Bearer ' + token } })
    .getBlob().setContentType(mime);
  return { blob: blob, mime: mime };
}

// ------------------------------------------------------------
// GEMINI (interpretación de contenido)
// ------------------------------------------------------------

function geminiGenerate_(parts) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL +
              ':generateContent?key=' + getProp_('GEMINI_API_KEY');
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: parts }] }),
    muteHttpExceptions: true
  });
  const json = JSON.parse(resp.getContentText());
  const text = json.candidates && json.candidates[0] && json.candidates[0].content &&
               json.candidates[0].content.parts &&
               json.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
  if (!text) throw new Error('Gemini no respondió: ' + resp.getContentText().slice(0, 400));
  return text.trim();
}

function geminiDescribeImage_(blob, caption) {
  return geminiGenerate_([
    { text: 'Describe brevemente, en español formal y en 2 o 3 frases, qué se observa en esta imagen, ' +
            'como evidencia para un informe de prácticas estudiantiles.' +
            (caption ? ' El estudiante la acompañó con esta nota: "' + caption + '".' : '') +
            ' Devuelve solo la descripción.' },
    { inline_data: { mime_type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } }
  ]);
}

function geminiTranscribe_(blob) {
  return geminiGenerate_([
    { text: 'Transcribe fielmente este audio en español. Devuelve únicamente la transcripción, sin comentarios.' },
    { inline_data: { mime_type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } }
  ]);
}

// ------------------------------------------------------------
// ESTADO, CONFIGURACIÓN Y ERRORES
// ------------------------------------------------------------

function getState_(user) {
  return PropertiesService.getScriptProperties().getProperty('state_' + user) || 'idle';
}

function setState_(user, state) {
  PropertiesService.getScriptProperties().setProperty('state_' + user, state);
}

function getProp_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Falta la propiedad del script: ' + key);
  return v;
}

function logError_(err) {
  console.error(err);
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    let sheet = ss.getSheetByName('Errores');
    if (!sheet) sheet = ss.insertSheet('Errores');
    sheet.appendRow([new Date(), String(err && err.message || err), String(err && err.stack || '')]);
  } catch (e) { /* sin hoja todavía: solo consola */ }
}

/**
 * EJECÚTAME UNA VEZ desde el editor (botón ▶ Ejecutar) para:
 *  1) Autorizar los permisos del script.
 *  2) Verificar que las 4 propiedades estén configuradas.
 *  3) Probar el acceso a la carpeta de Drive y la conexión con Gemini.
 */
function chequeo() {
  ['VERIFY_TOKEN', 'WHATSAPP_TOKEN', 'PHONE_NUMBER_ID', 'GEMINI_API_KEY'].forEach(function (k) {
    Logger.log(k + ': ' + (PropertiesService.getScriptProperties().getProperty(k) ? 'OK ✅' : 'FALTA ❌'));
  });
  Logger.log('Carpeta de informes: "' + getReportsFolder_().getName() + '" OK ✅');
  getSheet_();
  Logger.log('Hoja de registro: OK ✅');
  try {
    Logger.log('Gemini dice: ' + geminiGenerate_([{ text: 'Responde solo: hola' }]));
  } catch (e) {
    Logger.log('Gemini: ERROR ❌ → ' + e.message);
  }
}
