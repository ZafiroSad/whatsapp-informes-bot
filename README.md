# 📋 Bot de WhatsApp para Informes Diarios de Prácticas

Un chatbot de WhatsApp que registra lo que haces en tus prácticas estudiantiles —**texto, fotos y audios**— y genera automáticamente un **informe Word (.docx) con formato académico** en tu Google Drive, organizado en carpetas por fecha.

**Costo total: $0.** Sin servidores, sin tarjeta de crédito. Funciona 24/7 sobre Google Apps Script.

## ✨ ¿Qué hace?

```
👤  hola
🤖  ¡Hola! 👋 Soy tu asistente de prácticas...   [🚀 Comenzar]
👤  [🚀 Comenzar]
🤖  📝 Perfecto. Envíame un texto, una foto o un audio.
👤  🎤 (audio contando lo que hiciste hoy)
🤖  ✅ Audio transcrito y registrado.
    ¿Deseas agregar algo más?   [➕ Agregar más] [✅ Finalizar]
👤  📷 (foto de la obra/laboratorio/oficina)
🤖  ✅ Imagen procesada y guardada como evidencia.   [➕] [✅]
👤  [✅ Finalizar]
🤖  📄 ¡Listo! Tu informe se guardó en Drive:
    INFORME DIARIO_09_06_2026.docx
```

- 🎤 **Audios** → se transcriben automáticamente (Gemini).
- 📷 **Fotos** → se describen con IA y se insertan en el informe como *evidencia fotográfica* con pie de figura.
- ✍️ **Textos** → se registran tal cual.
- 📄 Al finalizar, la IA redacta un **informe formal en párrafos** (tercera persona impersonal) con todo el material del día.
- 🗂️ El Word se guarda en Drive dentro de una **subcarpeta con la fecha del día** (`09/06/26`), junto con las evidencias.
- 📃 El documento incluye **portada académica** (autor, universidad, facultad, ciudad y fecha), tipografía y formato configurables.
- 🔁 Si finalizas varias veces el mismo día, el informe se **regenera con todo lo del día** (no se duplica).

## 🏗️ Arquitectura

```
Tu WhatsApp ──→ WhatsApp Cloud API (Meta, gratis)
                     │ webhook
                     ▼
            Google Apps Script (gratis, 24/7)
              ├──→ Gemini API (gratis): transcripción, visión y redacción
              ├──→ Google Sheets: registro crudo del día
              └──→ Google Drive: informe .docx + evidencias
```

## 📦 Requisitos

| Qué | Para qué | Costo |
|---|---|---|
| Cuenta de Google | Apps Script, Drive y clave de Gemini | Gratis |
| Cuenta de Facebook/Meta | La API de WhatsApp (developers.facebook.com) | Gratis |
| Un WhatsApp en tu teléfono | Chatear con el bot | — |

No necesitas saber programar: es copiar, pegar y seguir los pasos.

---

# 🚀 Instalación

## Paso 1 — Clave de Gemini (2 min)

1. Entra a **[aistudio.google.com](https://aistudio.google.com)** con tu cuenta de Google.
2. Clic en **"Get API key"** → **"Create API key"**.
3. Copia la clave (empieza con `AIza...`).

## Paso 2 — Crear el script (10 min)

1. Entra a **[script.google.com](https://script.google.com)** → **+ Nuevo proyecto**.
2. Borra el contenido de `Código.gs` y pega el contenido completo de [`Code.gs`](Code.gs) de este repositorio.
3. **Edita la sección `CONFIGURACIÓN`** al inicio del archivo: tu nombre, universidad, carpeta de Drive (opcional), zona horaria, etc.
4. Ve a ⚙️ **Configuración del proyecto** → **Propiedades de la secuencia de comandos** → agrega estas 4:

   | Propiedad | Valor |
   |---|---|
   | `VERIFY_TOKEN` | Una palabra secreta que tú inventes, ej: `mi-bot-2026` |
   | `GEMINI_API_KEY` | La clave del Paso 1 |
   | `WHATSAPP_TOKEN` | Escribe `pendiente` (se llena en el Paso 3) |
   | `PHONE_NUMBER_ID` | Escribe `pendiente` (se llena en el Paso 3) |

5. **Autoriza el script**: en el editor, selecciona la función `chequeo` y pulsa **▶ Ejecutar** → "Revisar permisos" → tu cuenta → "Configuración avanzada" → "Ir a... (no seguro)" → **Permitir**. (Es tu propio script; es seguro.)
   - Deberías ver `GEMINI: OK ✅` y `Carpeta de informes: OK ✅` en el registro.
6. **Publica como aplicación web**: **Implementar** → **Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** ⚠️ importante
   - **Implementar** y copia la URL que termina en `/exec`.

> ⚠️ **Cada vez que modifiques el código**: Implementar → **Administrar implementaciones** → ✏️ → Versión: **"Nueva versión"** → Implementar. Si no, WhatsApp seguirá usando el código viejo.

## Paso 3 — App de WhatsApp en Meta (15 min)

1. Entra a **[developers.facebook.com](https://developers.facebook.com)** → **Mis apps** → **Crear app**.
2. Caso de uso: **Otro** → Tipo: **Negocios** → ponle nombre → Crear.
3. Busca el producto **WhatsApp** → **Configurar** (si pide crear un portafolio comercial, créalo con cualquier nombre).
4. En **WhatsApp → Configuración de la API**:
   - Copia el **token de acceso temporal** → pégalo en la propiedad `WHATSAPP_TOKEN` del script. *(Caduca en 24 h; en el Paso 5 lo haces permanente.)*
   - Copia el **Identificador del número de teléfono** → pégalo en `PHONE_NUMBER_ID`.
5. En la sección **"Para"**: **Administrar lista de números** → agrega **tu número personal** de WhatsApp → verifica el código que te llega.
6. En **WhatsApp → Configuración** (webhook):
   - **URL de devolución de llamada**: la URL `/exec` del Paso 2.6
   - **Token de verificación**: tu `VERIFY_TOKEN`
   - **Verificar y guardar** ✅
   - En **Campos de webhook** → **Administrar** → suscríbete a **`messages`**.

## Paso 4 — ¡Probar! 🎉

Escribe **"hola"** desde tu WhatsApp al número de prueba de Meta (aparece en "Configuración de la API"). El bot debe responder con el botón **🚀 Comenzar**.

💡 *Tip: guarda el número del bot como contacto en tu teléfono con el nombre que quieras (ej. "Asistente Prácticas 🤖").*

## Paso 5 — Token permanente (para que no caduque cada 24 h)

1. Entra a **[business.facebook.com/settings](https://business.facebook.com/settings)**.
2. **Usuarios → Usuarios del sistema** → **Agregar** → rol: **Administrador**.
3. En el usuario creado: **Agregar activos** → **Apps** → tu app → activa **Administrar app**.
4. **Generar token nuevo** → tu app → Caducidad: **Nunca** → permisos `whatsapp_business_messaging` y `whatsapp_business_management` → Generar.
5. Reemplaza `WHATSAPP_TOKEN` en las propiedades del script con ese token.

---

# 🎨 Personalización

Todo está en la sección `CONFIGURACIÓN` al inicio de [`Code.gs`](Code.gs):

| Constante | Qué controla |
|---|---|
| `REPORT_FOLDER_ID` | Carpeta de Drive destino (vacío = se crea una automáticamente) |
| `REPORT_PREFIX` | Nombre del archivo: `INFORME DIARIO_09_06_2026.docx` |
| `DAY_FOLDER_FORMAT` | Formato de la carpeta del día: `dd/MM/yy` → `09/06/26` |
| `FONT`, `FONT_SIZE`, `LINE_SPACING` | Tipografía del documento |
| `PORTADA` | Título, autor, universidad, facultad y ciudad de la portada |
| `TZ` | Zona horaria (ej. `America/Bogota`, `America/Mexico_City`) |

Los textos que envía el bot están en las funciones `handleMessage_`, `askNext_` y `finishReport_` — edítalos a tu gusto.

# 🛠️ Solución de problemas

- **El bot no responde** → en script.google.com abre **Ejecuciones** (menú izquierdo): ahí ves cada mensaje recibido y el error exacto. También se crea una pestaña *Errores* en la hoja de cálculo *Registro Bot Prácticas* de tu Drive.
- **Respondía y dejó de hacerlo** → casi siempre es el token temporal caducado (Paso 5) o que cambiaste código sin crear **nueva versión** de la implementación.
- **`(#131030) Recipient phone number not in allowed list`** → te faltó agregar y verificar tu número como destinatario (Paso 3.5).
- **El Word no se ve con la fuente configurada en la vista previa de Drive** → es normal: Google Docs no tiene todas las fuentes. Al abrirlo en Microsoft Word se ve correctamente.
- **Sincronizas Drive con tu PC y las carpetas de fecha fallan** → cambia `DAY_FOLDER_FORMAT` a `'dd-MM-yy'` (las barras no son válidas en carpetas de Windows/Mac).

# ⚠️ Limitaciones

- El **número de prueba** de Meta solo puede chatear con hasta **5 números** que tú registres — perfecto para uso personal. Para un número público "de verdad" hay que registrar un número propio en la misma app de Meta.
- La capa gratuita de Gemini tiene límites de uso por minuto/día, de sobra para uso personal.
- Apps Script limita cada ejecución a 6 minutos — suficiente incluso para informes con varias fotos.

# 📄 Licencia

[MIT](LICENSE) — úsalo, modifícalo y compártelo libremente.

---

*Creado por un estudiante, para estudiantes que quieren dedicar su tiempo a las prácticas y no a transcribir lo que hicieron.* ✏️
