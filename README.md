# Bot de WhatsApp para informes diarios de prácticas

Hice este bot durante mis prácticas de ingeniería civil porque cada noche me tocaba sentarme a reconstruir de memoria lo que había hecho en el día para el informe. Ahora le mando audios y fotos por WhatsApp mientras trabajo, y cuando termino la jornada me devuelve un Word con formato académico, redactado y guardado en mi Google Drive.

Lo publico por si a alguien más le sirve. Montarlo no cuesta dinero ni requiere saber programar: corre sobre Google Apps Script y las capas gratuitas de la API de WhatsApp (Meta) y de Gemini. Es copiar un archivo, pegar cuatro claves y seguir los pasos de esta guía.

## Cómo funciona

```
Tú:   hola
Bot:  ¡Hola! 👋 Soy tu asistente de prácticas...   [🚀 Comenzar]
Tú:   [🚀 Comenzar]
Bot:  📝 Perfecto. Envíame un texto, una foto o un audio.
Tú:   🎤 (audio contando lo que hiciste)
Bot:  ✅ Audio transcrito y registrado.
      ¿Deseas agregar algo más?   [➕ Agregar más] [✅ Finalizar]
Tú:   📷 (foto de la obra)
Bot:  ✅ Imagen procesada y guardada como evidencia.
Tú:   [✅ Finalizar]
Bot:  📄 ¡Listo! Tu informe se guardó en Drive:
      INFORME DIARIO_09_06_2026.docx
```

El bot acepta tres tipos de mensaje. Los audios se transcriben con Gemini, que es lo que más uso: dictar toma un minuto y queda registrado con su hora. Las fotos se guardan en Drive y la IA les escribe una descripción; en el informe aparecen al final como evidencia fotográfica, con pie de figura. Los textos se registran tal cual los escribes.

Al tocar "Finalizar", Gemini redacta el cuerpo del informe en párrafos formales (tercera persona impersonal, sin inventar nada que no esté en el registro) y el script genera el `.docx`: portada con tus datos, desarrollo de actividades y evidencia fotográfica. El archivo queda en una subcarpeta con la fecha del día (por ejemplo `09/06/26`) dentro de la carpeta de Drive que configures.

Si finalizas varias veces el mismo día, el informe se regenera con todo lo registrado hasta ese momento. No se duplican archivos.

## Arquitectura

```
Tu WhatsApp ──→ WhatsApp Cloud API (Meta)
                     │ webhook
                     ▼
            Google Apps Script (24/7, sin servidor propio)
              ├──→ Gemini API: transcripción, visión y redacción
              ├──→ Google Sheets: registro crudo del día
              └──→ Google Drive: informe .docx + evidencias
```

Apps Script hace de servidor: recibe los mensajes que Meta le envía por webhook y responde llamando a la API de WhatsApp. Como vive en tu cuenta de Google, escribir en tu Drive no necesita credenciales adicionales.

## Requisitos

- Una cuenta de Google (para Apps Script, Drive y la clave de Gemini).
- Una cuenta de Facebook/Meta (para crear la app de WhatsApp en developers.facebook.com).
- WhatsApp en tu teléfono.

Todo dentro de las capas gratuitas. Para uso personal no vas a acercarte a los límites.

## Instalación

El orden importa: primero Gemini y el script (así tienes la URL del webhook), después Meta.

### 1. Clave de Gemini

Entra a [aistudio.google.com](https://aistudio.google.com) con tu cuenta de Google, clic en "Get API key" y crea una. Copia la clave (empieza con `AIza...`).

### 2. Crear el script

1. En [script.google.com](https://script.google.com) crea un proyecto nuevo, borra el contenido de `Código.gs` y pega el contenido completo de [`Code.gs`](Code.gs).
2. Edita la sección `CONFIGURACIÓN` al inicio del archivo: tu nombre, universidad, carpeta de Drive (opcional), zona horaria.
3. En ⚙️ Configuración del proyecto → "Propiedades de la secuencia de comandos", agrega estas cuatro:

   | Propiedad | Valor |
   |---|---|
   | `VERIFY_TOKEN` | Una palabra secreta que tú inventes, ej. `mi-bot-2026` |
   | `GEMINI_API_KEY` | La clave del paso 1 |
   | `WHATSAPP_TOKEN` | Escribe `pendiente` por ahora (se llena en el paso 3) |
   | `PHONE_NUMBER_ID` | Igual, `pendiente` por ahora |

4. Autoriza el script: en el editor selecciona la función `chequeo` y pulsa Ejecutar. Google te pedirá permisos; acepta pasando por "Configuración avanzada" → "Ir a... (no seguro)". Es tu propio script, el aviso es estándar. En el registro deberías ver `GEMINI: OK` y `Carpeta de informes: OK`.
5. Publícalo: Implementar → Nueva implementación → tipo "Aplicación web", ejecutar como **Yo**, acceso para **Cualquier usuario** (esto último es lo que más se olvida). Copia la URL que termina en `/exec`.

Cuando modifiques el código más adelante, no basta con guardar: ve a Implementar → Administrar implementaciones → editar → "Nueva versión". Si no, WhatsApp sigue hablando con el código viejo. Este detalle me costó una tarde.

### 3. App de WhatsApp en Meta

1. En [developers.facebook.com](https://developers.facebook.com) → Mis apps → Crear app. Caso de uso "Otro", tipo "Negocios".
2. En el panel de la app busca el producto WhatsApp y configúralo. Si te pide crear un portafolio comercial, créalo con cualquier nombre.
3. En WhatsApp → Configuración de la API copia dos cosas hacia las propiedades del script: el **token de acceso temporal** (a `WHATSAPP_TOKEN`) y el **identificador del número de teléfono** (a `PHONE_NUMBER_ID`). El token temporal caduca en 24 horas; el paso 5 lo resuelve.
4. En la sección "Para", agrega tu número personal de WhatsApp a la lista de destinatarios y verifica el código que te llega.
5. En WhatsApp → Configuración conecta el webhook: la URL `/exec` del paso anterior como URL de devolución de llamada, y tu `VERIFY_TOKEN` como token de verificación. Tras verificar, suscríbete al campo `messages`.

### 4. Probar

Escríbele "hola" al número de prueba de Meta desde tu WhatsApp. Debe responder con el botón de comenzar. Envía un audio, una foto, finaliza, y revisa tu Drive.

Un consejo: guarda el número del bot como contacto en tu teléfono con el nombre que quieras, porque el nombre público del número de prueba no se puede cambiar.

### 5. Token permanente

El token del paso 3 muere a las 24 horas. Para uno que no caduca:

1. En [business.facebook.com/settings](https://business.facebook.com/settings) → Usuarios → Usuarios del sistema, crea uno con rol Administrador.
2. Agrégale tu app como activo, con permiso "Administrar app".
3. Genera un token con caducidad "Nunca" y los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Reemplaza `WHATSAPP_TOKEN` en las propiedades del script.

## Personalización

Todo lo editable está en la sección `CONFIGURACIÓN` de [`Code.gs`](Code.gs):

| Constante | Qué controla |
|---|---|
| `REPORT_FOLDER_ID` | Carpeta de Drive destino (vacío = se crea una automáticamente) |
| `REPORT_PREFIX` | Nombre del archivo: `INFORME DIARIO_09_06_2026.docx` |
| `DAY_FOLDER_FORMAT` | Formato de la carpeta del día: `dd/MM/yy` → `09/06/26` |
| `FONT`, `FONT_SIZE`, `LINE_SPACING` | Tipografía del documento |
| `PORTADA` | Título, autor, universidad, facultad y ciudad de la portada |
| `TZ` | Zona horaria, ej. `America/Bogota` |

Los textos que envía el bot están en las funciones `handleMessage_`, `askNext_` y `finishReport_`, por si quieres cambiarle el tono. El prompt con el que Gemini redacta el informe está en `finishReport_`; ajustarlo cambia el estilo de la redacción.

## Problemas frecuentes

El bot no responde: en script.google.com abre "Ejecuciones" (menú izquierdo). Ahí aparece cada mensaje recibido con su error exacto. Los errores también quedan en una pestaña de la hoja de cálculo "Registro Bot Prácticas" de tu Drive.

Respondía y dejó de hacerlo: casi siempre es el token temporal caducado (paso 5), o que cambiaste código sin crear nueva versión de la implementación.

Error `(#131030) Recipient phone number not in allowed list`: falta agregar y verificar tu número como destinatario (paso 3.4).

El Word no se ve con la fuente configurada en la vista previa de Drive: normal, Google Docs no tiene todas las fuentes. Al abrirlo en Word se ve bien, porque la fuente queda declarada en el archivo.

Sincronizas Drive con tu PC y las carpetas de fecha dan error: cambia `DAY_FOLDER_FORMAT` a `'dd-MM-yy'`. Las barras no son válidas en nombres de carpeta de Windows ni macOS.

## Limitaciones

El número de prueba de Meta solo puede chatear con los números que registres como destinatarios (máximo 5). Para uso personal sobra; si quisieras un bot público tendrías que registrar un número propio en la misma app, lo cual exige un teléfono que no esté ya en WhatsApp.

La capa gratuita de Gemini tiene límites por minuto y por día. En uso normal (un puñado de audios y fotos al día) no se alcanzan.

Apps Script corta cada ejecución a los 6 minutos. Generar un informe con varias fotos toma menos de uno, así que en la práctica no es problema.

## Licencia

[MIT](LICENSE). Úsalo y modifícalo como quieras. Si lo montas y algo de esta guía no te funcionó, abre un issue.
