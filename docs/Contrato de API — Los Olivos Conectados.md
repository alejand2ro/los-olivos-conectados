# Contrato de API — Los Olivos Conectados

Este documento define el **contrato de la API REST**: qué endpoints existen, qué reciben y qué devuelven. Es la interfaz que conecta el frontend (Angular/Ionic) con el backend (Node.js), independientemente de cómo se organice el código internamente.

Describe el **MVP acordado**; cada ruta debe contrastarse con el código para conocer su estado de implementación. `docs/decisiones-mvp.md` registra las decisiones de alcance. El push geográfico de RF-21 queda fuera de esta versión; el cálculo exacto del marcador público y el mecanismo de actualización del panel siguen pendientes de definición técnica.

---

## Convenciones generales

- **Formato:** las respuestas son JSON. Las peticiones usan JSON salvo la subida de evidencias y la creación de reportes cuya descripción sea un archivo de audio, que usan `multipart/form-data`.
- **Autenticación:** el login devuelve un JWT firmado con HS256 que vence en una hora. Las rutas protegidas reciben `Authorization: Bearer <token>`. La clave de firma proviene de `JWT_SECRET` en el entorno del backend.
- **Paginación de listados implementados:** `pagina` es un entero entre 1 y 1 000 000 (predeterminado `1`), con 20 elementos por página. La respuesta incluye `resultados`, `pagina`, `tamano_pagina`, `total` y `total_paginas`. Se ordena por fecha descendente y después por `id` descendente para resolver empates. Si no hay elementos, `resultados` es `[]`, `total` y `total_paginas` son `0`. Una página posterior a la última devuelve `resultados: []` y conserva el total. Un valor inválido devuelve `400` con el formato de error general.
- **Errores:** toda respuesta de error sigue la misma forma:

  ```json
  { "error": "mensaje descriptivo del problema" }
  ```
- **Estados:** la API devuelve códigos estables (`recibido`, `en_revision`, `en_proceso`, `resuelto`) y nombres visibles separados (`Recibido`, `En revisión`, `En proceso`, `Resuelto`). Las peticiones envían el código. Los nombres pueden cambiar sin alterar el contrato.
- **Fechas:** todos los instantes se devuelven en ISO 8601 con zona UTC (`Z`); el esquema nuevo usa columnas con zona horaria.
- **Ubicaciones:** las coordenadas exactas solo salen en respuestas protegidas para el autor o cuentas autorizadas. Las respuestas públicas de alertas y mapa usan una posición aproximada y estable; la cuadrícula, cercana a 200 m, aún requiere una especificación técnica antes de implementarse.
- **Códigos de estado usados:**

  | Código | Significado en este sistema |
  | --- | --- |
  | 200 | Operación exitosa (consulta o actualización). |
  | 201 | Recurso creado exitosamente. |
  | 400 | Datos inválidos o incompletos en el request. |
  | 401 | No autenticado (falta token o es inválido). |
  | 403 | Autenticado pero sin permiso para esa acción (ej. un vecino intentando acceder al panel de Autoridad). |
  | 409 | Conflicto con un recurso existente (por ejemplo, correo ya registrado). |
  | 404 | Recurso no encontrado. |

---

## Módulo: Usuarios (RF-01 a RF-05)

### `POST /usuarios/registro`

Crea una cuenta pública con rol `vecino` o `comerciante`, con los mismos permisos iniciales. `nombre`, `correo`, `contrasena`, `rol` y `zona_id` (zona de residencia) son obligatorios; `telefono` es opcional. `consentimiento_privacidad_aceptado` y `compromiso_sos_aceptado` deben ser `true`. `autoridad` y `administrador` no pueden seleccionarse aquí; tampoco se acepta `rol_id` del cliente (RF-01, RF-04). El primer Administrador se crea mediante el procedimiento privado descrito abajo. El backend normaliza el correo (quita espacios alrededor y convierte a minúsculas), comprueba que la zona exista y guarda la contraseña con Argon2id. La contraseña y su hash nunca se devuelven. El alias de chat se genera con un código aleatorio neutral, independiente del `id` del usuario; se regenera si ya existe. La contraseña admite entre 8 y 128 caracteres.

**Request body:**

```json
{
  "nombre": "Carlos Mendoza",
  "correo": "carlos@correo.com",
  "contrasena": "********",
  "rol": "vecino",
  "telefono": "999888777",
  "zona_id": 3,
  "modo_accesibilidad": false,
  "compromiso_sos_aceptado": true,
  "consentimiento_privacidad_aceptado": true
}
```

**Response 201:**

```json
{
  "id": 15,
  "nombre": "Carlos Mendoza",
  "correo": "carlos@correo.com",
  "alias_chat": "Usuario-8C2F71A4D90B",
  "rol": "vecino",
  "zona_id": 3
}
```

**Response 400:** datos inválidos o incompletos, zona inexistente, rol público no permitido, `rol_id` enviado por el cliente, o falta de cualquiera de los dos consentimientos. Cuerpo JSON: `{ "error": "Descripción del problema" }`.

**Response 409:** el correo normalizado ya está registrado. Cuerpo JSON: `{ "error": "El correo ya está registrado" }`.

---

### `POST /usuarios/login`

**Request body:**

```json
{ "correo": "carlos@correo.com", "contrasena": "********" }
```

**Response 200:**

```json
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": 15, "nombre": "Carlos Mendoza", "rol": "vecino", "zona_id": 3 }
}
```

**Response 401:** `{ "error": "Credenciales inválidas" }` tanto si el correo no existe como si la contraseña es incorrecta. La respuesta no indica cuál falló. El token contiene el identificador del usuario y la respuesta nunca incluye la contraseña ni su hash.

El inicio de sesión del MVP usa correo y contraseña; el teléfono no sustituye al correo.
El mismo endpoint permite acceder a cuentas internas: `usuario.rol` es `autoridad` o `administrador` y `usuario.zona_id` puede ser `null`. El frontend dirige cada rol a su espacio; el JWT identifica al usuario, mientras que cada operación protegida comprueba sus permisos en el servidor.

---

### `GET /usuarios/perfil`

*(requiere token)* Devuelve los datos del usuario autenticado. `telefono` es un dato privado del propio usuario y puede ser `string` o `null`; no se incluye en las respuestas públicas.
Para Autoridad y Administrador, `zona_id` y `alias_chat` pueden ser `null`.

**Response 200:**

```json
{
  "id": 15,
  "nombre": "Carlos Mendoza",
  "correo": "carlos@correo.com",
  "telefono": "999888777",
  "rol": "vecino",
  "zona_id": 3,
  "alias_chat": "Usuario-8C2F71A4D90B",
  "modo_accesibilidad": false
}
```

---

### `PATCH /usuarios/perfil`

*(requiere token)* Actualiza únicamente `telefono` (`string` de hasta 20 caracteres o `null` para quitarlo) y `modo_accesibilidad` (`boolean`). El teléfono se guarda sin espacios en los extremos; una cadena vacía equivale a `null`. Debe enviarse al menos uno. Cualquier otro campo, incluidos `rol`, `zona_id`, `correo`, `contrasena` e `id`, se rechaza con `400`.

**Request body (solo los campos a cambiar):**

```json
{ "telefono": null, "modo_accesibilidad": true }
```

**Response 200:** el perfil actualizado, incluida la propiedad privada `telefono`, con la misma forma que `GET /usuarios/perfil`. **Response 400:** cuerpo inválido o campo no permitido. **Response 401:** token ausente, inválido o vencido. **Response 404:** cuenta inexistente.

---

### `POST /usuarios/autoridad`

*(requiere token de un Administrador vigente)* Crea una cuenta de Autoridad — no existe autorregistro para este rol (RF-04). El servidor verifica el JWT y consulta el rol actual del usuario en PostgreSQL; un token emitido antes de retirar el rol de Administrador no conserva el permiso. El cuerpo admite **solo** `nombre`, `correo` y `contrasena`, sin `rol`, `rol_id`, `zona_id`, `usuario_id` ni consentimientos públicos. El correo se normaliza, la contraseña de 8 a 128 caracteres se guarda con el mismo Argon2id del registro y no se devuelve.

**Request body:**

```json
{ "nombre": "Autoridad de ejemplo", "correo": "autoridad@ejemplo.invalid", "contrasena": "********" }
```

**Response 201:**

```json
{ "id": 16, "nombre": "Autoridad de ejemplo", "correo": "autoridad@ejemplo.invalid", "alias_chat": null, "rol": "autoridad", "zona_id": null }
```

**Response 400:** cuerpo o campos inválidos. **Response 401:** token ausente, inválido o vencido. **Response 403:** la cuenta del token no tiene actualmente el rol Administrador. **Response 409:** correo duplicado. **Response 500:** `{ "error": "No se pudo crear la cuenta de Autoridad" }`. Nunca se devuelve contraseña ni hash.

### Creación privada del primer Administrador

No existe ruta HTTP para esta operación. Desde una terminal interactiva situada en `backend/`, con las variables `DB_*` configuradas para la base de destino, el operador ejecuta `npm run crear:primer-administrador`. El procedimiento muestra la base de destino, solicita nombre, correo, contraseña oculta y repetición, y exige escribir `CREAR` antes de guardar. No recibe la contraseña por argumentos ni la imprime. Busca el rol por nombre, usa el mismo Argon2id del registro y crea una cuenta interna sin zona ni alias de chat. Dentro de una transacción crea `public.inicio_administrador` como marcador único con fecha y referencia a la cuenta; comprueba también que no exista ya ningún Administrador. Repetirlo se rechaza, incluso si el rol de esa cuenta cambia después. Este procedimiento está preparado y probado solo en una base temporal; **no se ha ejecutado en la base principal**.

---

## Módulo: Reportes (RF-06 a RF-11)

### `POST /reportes`

*(requiere token)* Crea un **reporte normal**. El `usuario_id` se toma del token, nunca del body. Son obligatorios tipo, coordenadas reales y descripción en texto o audio (RF-09, RF-11). `zona_id` identifica la **zona del incidente**, distinta de la zona de residencia: si se omite, se propone la de la cuenta; el usuario puede enviar otra. El sistema no deduce la zona de las coordenadas.

**Estado de implementación:** el backend acepta `application/json` con descripción escrita (cuerpo máximo de 64 KiB) y `multipart/form-data` con descripción por audio. Rechaza `usuario_id`, `descripcion_audio_url` y otros campos ajenos a cada variante. Las coordenadas deben ser números finitos dentro de los rangos de latitud −90 a 90 y longitud −180 a 180; no se generan coordenadas por defecto.

**Request JSON con descripción escrita:**

```json
{
  "tipo_incidente_id": 1,
  "zona_id": 3,
  "descripcion_texto": "Intento de robo cerca del parque",
  "latitud": -11.9823,
  "longitud": -77.0645,
  "nivel_gravedad_id": 2
}
```

**Alternativa con descripción de audio (implementada):** el mismo `POST /reportes` recibe `multipart/form-data` con exactamente un archivo `archivo_descripcion_audio` y los campos de texto `tipo_incidente_id`, `zona_id` (opcional), `latitud`, `longitud` y `nivel_gravedad_id`. Puede incluir `descripcion_texto` complementaria de hasta 5000 caracteres. Los identificadores son enteros positivos y las coordenadas son números decimales válidos en sus rangos. El cliente **no** envía `descripcion_audio_url` ni `usuario_id`.

El archivo debe ser **WAV RIFF con PCM firmado de 16 bits, mono, 16 kHz**, con duración real calculada a partir de sus muestras de **1 a 60 segundos** y un tamaño máximo de **3 MiB**. El backend inspecciona los bytes y la estructura del archivo: no confía en el nombre, la extensión, el MIME ni una duración declarada por el cliente. La interfaz graba en el formato disponible del navegador y prepara ese WAV antes de subirlo. Si el navegador no puede prepararlo, se ofrece descripción escrita.

El backend guarda el archivo en un directorio **privado, no publicado por HTTP**, configurable mediante `REPORTES_AUDIO_DIR` (por defecto `backend/private-audio` al iniciar desde `backend/`). Usa un nombre aleatorio, permisos restrictivos cuando el sistema los admite y registra en `reportes.descripcion_audio_url` una referencia interna `privado/reportes-audio/<uuid>.wav`, no una URL pública. Si falla la creación del reporte, elimina el archivo recién guardado. El autor puede reproducirlo mediante `GET /reportes/:id/audio` con JWT.

**Response 201:**

```json
{ "id": 42, "estado_codigo": "recibido", "estado_nombre": "Recibido", "fecha_creacion": "2026-09-23T22:10:00Z" }
```

La creación guarda también el primer registro de `historial_estados` con estado `recibido`, atribuido al autor mediante el trigger del esquema. No crea alerta. **Response 400:** cuerpo inválido, campos no permitidos, tipo, gravedad o zona inexistentes, o falta descripción o coordenadas válidas (RF-09, RF-11). **Response 401:** token ausente, inválido o vencido. **Response 404:** cuenta del token inexistente. **Response 413:** `{ "error": "El audio supera 3 MiB" }`. **Response 415:** `{ "error": "Se requiere audio WAV PCM mono de 16 kHz" }` u otro error de estructura/duración del audio. **Response 500:** `{ "error": "No se pudo crear el reporte" }` ante fallo de almacenamiento o base de datos.

---

### `POST /reportes/:id/evidencias`

*(requiere token del autor, `multipart/form-data`)* Sube **una fotografía o un video por petición** a un reporte ya creado. Este adjunto es distinto del audio que describe el reporte durante su creación. El backend obtiene al usuario del JWT y comprueba que sea el autor. No se aceptan adjuntos en nombre de otra cuenta.

**Request:** campos `archivo` (binario), `tipo_archivo` (`foto` o `video`) y `clave_carga` (UUID estable generado por el cliente para ese archivo). El reintento conserva la misma clave: si la primera carga se guardó pero se perdió su respuesta, el servidor devuelve el mismo registro sin duplicarlo. La clave se limita al reporte y no permite elegir una ruta de almacenamiento. Se rechazan campos adicionales, incluidos `url_archivo` y `usuario_id`.

**Límites:** máximo **4 fotografías y 1 video** por reporte, 5 archivos en total. Cada foto JPEG o PNG debe ocupar hasta **5 MiB** y tener hasta 20 millones de píxeles; el backend decodifica y vuelve a codificar la imagen, la reduce a un máximo de 4096 × 4096 píxeles y elimina metadatos como EXIF. Cada video debe ser **MP4 con pista H.264**, hasta **20 MiB** y **120 segundos**; el backend comprueba su estructura y pistas con un analizador de medios. El nombre, la extensión y el MIME declarados por el cliente no demuestran el formato. El audio adjunto como evidencia posterior sigue pendiente; la nota de voz descriptiva pertenece a `POST /reportes`.

Los binarios se guardan en `REPORTES_EVIDENCIAS_DIR` (por defecto `backend/private-evidencias` al arrancar desde `backend/`), fuera de recursos HTTP públicos, con un nombre aleatorio. `evidencias.url_archivo` guarda una **referencia interna** `privado/evidencias/<clave_carga>-<uuid-servidor>.<ext>`, no una URL física o pública. Si falla el registro en PostgreSQL, se elimina el archivo recién escrito. El límite de cantidad se comprueba en una transacción con bloqueo del reporte para evitar cargas simultáneas que lo superen.

**Response 201:** `url_archivo` es la ruta protegida del API para consultar el binario, no la ruta privada de almacenamiento.

```json
{ "id": 8, "reporte_id": 42, "tipo_archivo": "foto", "url_archivo": "/reportes/42/evidencias/8/archivo" }
```

**Response 400:** archivo, formato, clave o campos inválidos. **Response 401:** token ausente, inválido o vencido. **Response 403:** el reporte pertenece a otra cuenta. **Response 404:** reporte inexistente. **Response 409:** se alcanzó el límite de fotos o videos. **Response 413:** archivo demasiado grande. **Response 500:** `{ "error": "No se pudo gestionar la evidencia" }` ante fallos de almacenamiento o base de datos.

### `GET /reportes/:id/evidencias/:evidenciaId/archivo`

*(requiere token del autor)* Devuelve los bytes de una evidencia guardada con `Content-Type` comprobado por el servidor, `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. El autor puede consultarla; las cuentas ajenas reciben `403`. La autorización futura de Autoridad y Administrador requiere definir su alcance de gestión. El cliente debe enviar el JWT mediante `Authorization`; una etiqueta `<img>` o `<video>` con la ruta como `src` no adjunta ese encabezado por sí sola. **Response 404:** reporte, evidencia o archivo no disponible.

### `GET /reportes/:id/audio`

*(requiere token del autor)* Entrega el audio descriptivo WAV guardado en `POST /reportes`. Responde `audio/wav` con `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. El cliente solicita el binario con `Authorization: Bearer <token>` y puede crear una URL local de objeto para reproducirlo; nunca coloca el JWT en la URL. **Response 401:** token ausente, inválido o vencido. **Response 403:** reporte ajeno. **Response 404:** reporte inexistente, sin audio o archivo no disponible. La referencia interna de almacenamiento nunca se devuelve.

---

### `GET /reportes/:id`

*(requiere token — solo el autor en el MVP actual)* Detalle completo de un reporte, incluyendo coordenadas exactas y evidencias. Nunca es un detalle público. El acceso futuro de Autoridad y Administrador dependerá de permisos de gestión aún no implementados.

**Response 200:**

```json
{
  "id": 42,
  "tipo_incidente": "Robo",
  "zona_id": 3,
  "zona_nombre": "Zona de ejemplo",
  "descripcion_texto": "Intento de robo cerca del parque",
  "descripcion_audio_url": null,
  "latitud": -11.9823,
  "longitud": -77.0645,
  "nivel_gravedad": "Media",
  "estado_codigo": "en_revision",
  "estado_nombre": "En revisión",
  "verificado": false,
  "es_sos": false,
  "fecha_creacion": "2026-09-23T22:10:00.000Z",
  "evidencias": [
    { "id": 8, "tipo_archivo": "foto", "url_archivo": "/reportes/42/evidencias/8/archivo", "fecha_subida": "2026-09-23T22:15:00.000Z" }
  ]
}
```

`descripcion_texto` y `tipo_incidente` pueden ser `null` en SOS; `descripcion_audio_url` vale `null` cuando no hay audio y, cuando existe, es `/reportes/:id/audio`, no una ruta física. Las evidencias se ordenan por fecha de subida e ID. **Response 401:** token ausente, inválido o vencido. **Response 403:** reporte ajeno. **Response 404:** reporte inexistente. **Response 500:** `{ "error": "No se pudo consultar el reporte" }`.

---

### `GET /reportes/:id/estado`

*(requiere token, solo el autor)* Consulta el estado y la línea de tiempo real del reporte (RF-28, RF-29). El historial se ordena por `fecha_cambio` e `id` ascendentes; incluye el registro inicial `recibido` creado por el trigger. No se infieren etapas faltantes.

**Response 200:**

```json
{
  "estado_codigo": "en_revision",
  "estado_nombre": "En revisión",
  "historial": [
    { "estado_codigo": "recibido", "estado_nombre": "Recibido", "fecha": "2026-09-23T22:10:00.000Z", "comentario": null },
    { "estado_codigo": "en_revision", "estado_nombre": "En revisión", "fecha": "2026-09-23T23:05:00.000Z", "comentario": "Revisión iniciada" }
  ]
}
```

**Response 401:** token ausente, inválido o vencido. **Response 403:** reporte ajeno. **Response 404:** reporte inexistente. **Response 500:** `{ "error": "No se pudo consultar el reporte" }`.

---

### `GET /reportes/mios?pagina=1`

*(requiere token)* Lista solo los reportes del autor autenticado, incluidos los no verificados. El identificador del autor se obtiene del token y no se acepta como filtro del cliente. Cada detalle completo se obtiene mediante `GET /reportes/:id`.

**Response 200:**

```json
{
  "resultados": [
    {
      "id": 42,
      "tipo_incidente": "Robo",
      "zona_id": 3,
      "estado_codigo": "recibido",
      "estado_nombre": "Recibido",
      "verificado": false,
      "es_sos": false,
      "fecha_creacion": "2026-09-23T22:10:00.000Z"
    }
  ],
  "pagina": 1,
  "tamano_pagina": 20,
  "total": 1,
  "total_paginas": 1
}
```

`tipo_incidente` puede ser `null` en SOS. No se envía la identidad de otros autores. **Response 400:** paginación inválida o parámetro no permitido. **Response 401:** token ausente, inválido o vencido. **Response 500:** `{ "error": "No se pudieron consultar tus reportes" }`.

---

## Módulo: SOS (RF-12 a RF-14)

### `POST /sos`

*(requiere token)* Crea sin formulario adicional un reporte de emergencia con `es_sos = true`, gravedad `Alta`, estado `recibido` y zona inicial de la cuenta. Tipo y descripción pueden ser `null` **solo en SOS**. Exige coordenadas reales: si faltan, la interfaz permite reintentar o elegir el punto manualmente, sin inventarlas. Crea el estado inicial atribuido al autor y los avisos internos a Autoridad.

**Request body:**

```json
{ "latitud": -11.9823, "longitud": -77.0645 }
```

**Response 201:**

```json
{ "id": 50, "estado_codigo": "recibido", "estado_nombre": "Recibido", "aviso_autoridad_registrado": true }
```

`aviso_autoridad_registrado` confirma la persistencia del aviso, **no** que alguien lo haya leído. Un panel de Autoridad abierto debe mostrarlo automáticamente, con señal visual y sin recarga; el transporte técnico está pendiente. Si no hay panel abierto, queda pendiente en la bandeja. Los vecinos no reciben aviso por un SOS pendiente: lo reciben por zona después de la verificación (cambio de RF-14). **Response 400:** ubicación ausente o inválida.

---

## Módulo: Panel de Autoridad (RF-15 a RF-19)

*(Todos los endpoints de este módulo requieren token con rol `autoridad` o `administrador`.)*

### `GET /reportes?vista=hoy|todos|graves&pagina=1`

Lista de reportes según la vista solicitada (RF-17). El filtrado ocurre en el servidor mediante consultas indexadas (ver documento de diseño de BD), no en el frontend.

**Response 200:**

```json
{
  "total": 34,
  "pagina": 1,
  "resultados": [
    { "id": 42, "tipo_incidente": "Robo", "nivel_gravedad": "Media", "estado_codigo": "recibido", "estado_nombre": "Recibido", "verificado": false, "es_sos": false, "fecha_creacion": "2026-09-23T22:10:00Z" }
  ]
}
```

---

### `PATCH /reportes/:id/estado`

Cambia el estado del reporte. El cambio y la nueva fila de `historial_estados` se guardan en una transacción; se registra una notificación interna al autor (RF-19, RF-30). El usuario común no puede modificar ni borrar el historial.

**Request body:**

```json
{ "estado_nuevo": "en_proceso", "comentario": "Patrulla asignada, en camino" }
```

**Response 200:**

```json
{ "id": 42, "estado_codigo": "en_proceso", "estado_nombre": "En proceso" }
```

**Response 403:** si quien llama no tiene rol de Autoridad/Administrador.

---

### `PATCH /reportes/:id/verificar`

Marca el reporte como verificado (RF-18), registra por separado quién verificó y cuándo, y crea una sola `alerta` pública (RF-20) con avisos internos por zona a vecinos. Estos cambios se guardan juntos. Un SOS pendiente no aparece en el feed público.

**Response 200:**

```json
{ "id": 42, "verificado": true, "alerta_generada": true, "alerta_id": 9 }
```

---

### `PATCH /reportes/:id/zona`

Corrige la zona del **incidente** durante la revisión, sin cambiar la zona de residencia del autor ni las coordenadas exactas. **Request JSON:** `{ "zona_id": 4 }`. **Response 200:** `{ "id": 42, "zona_id": 4 }`. Requiere acceso de gestión de Autoridad o Administrador; las reglas de auditoría de esta corrección se precisarán antes de implementarla.

---

## Módulo: Catálogos

### `GET /catalogos`

Consulta las opciones necesarias para registro y formularios: zonas, roles públicos (`vecino`, `comerciante`), tipos de incidente, niveles de gravedad y estados con `codigo` estable y `nombre` visible. No requiere token. El endpoint no concede permisos para crear roles protegidos.

**Response 200 (JSON):**

```json
{
  "zonas": [
    { "id": 7, "nombre": "Urbanización Villa Sol", "descripcion": "Descripción de la zona" }
  ],
  "roles_publicos": [
    { "id": 3, "nombre": "vecino" },
    { "id": 8, "nombre": "comerciante" }
  ],
  "tipos_incidente": [
    { "id": 2, "nombre": "Robo", "icono": "icon-robo.svg" }
  ],
  "niveles_gravedad": [
    { "id": 4, "nombre": "Baja", "orden": 1, "color": "#4CAF50" }
  ],
  "estados_reporte": [
    { "id": 6, "codigo": "recibido", "nombre": "Recibido", "orden": 1 }
  ]
}
```

Las cinco claves superiores siempre están presentes y contienen arreglos, incluso si un catálogo está vacío. Cada elemento tiene exactamente los campos mostrados; `descripcion`, `icono` y `color` pueden ser `null`. Los `id` y el contenido de los arreglos del ejemplo son ilustrativos y proceden de la base, nunca se fijan en el código. Zonas y tipos se ordenan por nombre y después por `id`; roles públicos se ordenan `vecino`, `comerciante`; gravedad y estados se ordenan por `orden` y después por `id`. **Response 500:** `{ "error": "No se pudieron consultar los catálogos" }`.

---

## Módulo: Alertas y Mapa (RF-20 a RF-27)

### `GET /alertas?pagina=1&zona_id=`

Feed público de alertas verificadas, ordenado por `fecha_publicacion` descendente e `id` descendente (RF-22). No requiere token. `zona_id` es un identificador positivo opcional de la zona del incidente; omitido o vacío consulta todas las zonas. Una zona inexistente devuelve lista vacía. Se exige tanto `reportes.verificado = true` como su registro de verificación. No se devuelven autor, descripción privada, evidencias ni coordenadas exactas.

**Response 200:**

```json
{
  "resultados": [
    { "id": 9, "tipo_incidente": "Robo", "zona": "Urbanización Villa Sol", "fecha_publicacion": "2026-09-23T23:10:00.000Z" }
  ],
  "pagina": 1,
  "tamano_pagina": 20,
  "total": 1,
  "total_paginas": 1
}
```

`tipo_incidente` puede ser `null` en un SOS verificado. **Response 400:** paginación, zona o parámetro inválido. **Response 500:** `{ "error": "No se pudieron consultar las alertas" }`.

---

### `GET /alertas/:id`

Detalle **público** de una alerta verificada: tipo de incidente (si existe), zona, fecha y marcador aproximado estable. No incluye autor, coordenadas exactas, descripción privada ni evidencias del reporte protegido. **Response 404:** alerta inexistente o aún no verificada.

---

### `GET /mapa/incidentes?tipo=&desde=&hasta=`

Mapa **público** (RF-24, RF-25): devuelve únicamente alertas verificadas. Cada posición se aproxima de forma estable sobre una cuadrícula cercana a 200 m; el cálculo exacto sigue pendiente de documentar. No devuelve coordenadas reales ni marcadores de reportes pendientes.

**Response 200:**

```json
[
  {
    "alerta_id": 9,
    "tipo_incidente": "Robo",
    "zona": "Sector 4",
    "icono": "icon-robo.svg",
    "latitud_aproximada": -11.982,
    "longitud_aproximada": -77.064,
    "verificado": true
  }
]
```

Las coordenadas del ejemplo son **ilustrativas**; no definen el algoritmo de aproximación.

### `GET /mapa/mis-reportes?tipo=&desde=&hasta=`

*(requiere token)* Marcadores de los reportes propios, incluso no verificados, con coordenadas exactas y marca `verificado`. El detalle protegido se consulta en `GET /reportes/:id`.

### `GET /mapa/gestion?tipo=&desde=&hasta=`

*(requiere token de Autoridad o Administrador)* Marcadores de los reportes bajo su gestión, incluidos los no verificados, con coordenadas exactas y marca visual de verificación. El alcance concreto de «bajo su gestión» debe definirse antes de implementar los permisos.

---

## Módulo: Chat vecinal (RF-31, RF-32)

### `GET /chats/mi-zona/mensajes?pagina=1`

*(requiere token)* Mensajes del chat de la zona del usuario autenticado. El backend muestra `alias_chat`, nunca el nombre real (RF-31).

**Response 200:**

```json
{
  "resultados": [
    { "id": 120, "autor_alias": "Usuario-8C2F71A4D90B", "contenido": "Vi movimiento raro en la esquina", "fecha_envio": "2026-09-23T23:20:00Z" }
  ]
}
```

---

### `POST /chats/mi-zona/mensajes`

**Request body:**

```json
{ "contenido": "Gracias por avisar, tengan cuidado" }
```

**Response 201:** el mensaje creado, misma forma que arriba.

---

### `POST /mensajes/:id/reportar`

Marca un mensaje como reportado, para revisión del Administrador (RF-32).

**Response 200:** `{ "id": 120, "reportado": true }`

---

### `GET /mensajes/reportados?pagina=1`

*(requiere token de Administrador)* Lista mensajes denunciados para revisión, con `id`, `contenido`, `autor_alias`, `fecha_envio` y `oculto`. La identidad real solo puede usarse internamente cuando la moderación lo requiera; no se publica.

---

### `PATCH /mensajes/:id/ocultar`

*(requiere token con rol `administrador`)* Oculta un mensaje reportado.

**Response 200:** `{ "id": 120, "oculto": true }`

---

## Módulo: Notificaciones

### `GET /notificaciones/mias?pagina=1`

*(requiere token)* Bandeja del usuario autenticado. Incluye avisos de cambio de estado y alertas verificadas de su zona; las cuentas de Autoridad ven también avisos internos de SOS pendientes. Cada elemento indica `id`, `tipo`, `leido`, `fecha_envio` y la referencia al reporte o alerta permitida para ese destinatario. La existencia de una fila no demuestra lectura personal.

**Response 200:** usa la paginación general de 20 elementos, ordenados por `fecha_envio` descendente e `id` descendente. Solo devuelve filas cuyo `usuario_id` coincide con el usuario del token. `alerta_id` es un número únicamente para `tipo: "alerta"`; `reporte_id` es un número únicamente para `tipo: "sos"` o `"cambio_estado"`. La referencia no constituye por sí misma permiso de consultar un detalle protegido.

```json
{
  "resultados": [
    {
      "id": 42,
      "tipo": "cambio_estado",
      "alerta_id": null,
      "reporte_id": 15,
      "leido": false,
      "fecha_envio": "2026-11-15T18:30:00.000Z"
    }
  ],
  "pagina": 1,
  "tamano_pagina": 20,
  "total": 1,
  "total_paginas": 1
}
```

Sin avisos, `resultados` es `[]` y ambos totales son `0`. Una página posterior a la última conserva `total` y devuelve `resultados: []`. **Response 400:** paginación inválida o parámetro no permitido. **Response 401:** token ausente, inválido o vencido. **Response 500:** `{ "error": "No se pudieron consultar tus notificaciones" }`.

El panel de Autoridad abierto debe recibir los nuevos SOS sin recargar y mostrarlos con señal visual. El mecanismo técnico de actualización y la medición de RNF-01 quedan pendientes; no se promete push a dispositivos.

---

## Módulo: Estadísticas (RF-33, RF-34)

### `GET /estadisticas/publicas`

Sin autenticación — panel público, solo datos agregados, sin identificar a nadie (RF-34).

**Response 200:**

```json
{
  "total_reportes_mes": 42,
  "porcentaje_resueltos": 60,
  "tipo_mas_frecuente": "Robo"
}
```

---

## Resumen de endpoints por módulo

| Módulo | Endpoint | Método | Rol requerido |
| --- | --- | --- | --- |
| Usuarios | `/usuarios/registro` | POST | Público |
| Usuarios | `/usuarios/login` | POST | Público |
| Usuarios | `/usuarios/perfil` | GET / PATCH | Autenticado |
| Usuarios | `/usuarios/autoridad` | POST | Administrador |
| Catálogos | `/catalogos` | GET | Público |
| Reportes | `/reportes` | POST | Autenticado |
| Reportes | `/reportes/mios` | GET | Autor autenticado |
| Reportes | `/reportes/:id/evidencias` | POST | Autenticado (autor) |
| Reportes | `/reportes/:id/evidencias/:evidenciaId/archivo` | GET | Autenticado (autor) |
| Reportes | `/reportes/:id/audio` | GET | Autenticado (autor) |
| Reportes | `/reportes/:id` | GET | Autor (MVP actual); acceso de Autoridad pendiente |
| Reportes | `/reportes/:id/estado` | GET | Autor |
| SOS | `/sos` | POST | Autenticado |
| Panel Autoridad | `/reportes?vista=` | GET | Autoridad |
| Panel Autoridad | `/reportes/:id/estado` | PATCH | Autoridad |
| Panel Autoridad | `/reportes/:id/verificar` | PATCH | Autoridad |
| Panel Autoridad | `/reportes/:id/zona` | PATCH | Autoridad |
| Alertas | `/alertas` | GET | Público |
| Alertas | `/alertas/:id` | GET | Público (solo verificadas) |
| Mapa | `/mapa/incidentes` | GET | Público (solo alertas verificadas, posición aproximada) |
| Mapa | `/mapa/mis-reportes` | GET | Autenticado (propios) |
| Mapa | `/mapa/gestion` | GET | Autoridad / Administrador |
| Chat | `/chats/mi-zona/mensajes` | GET / POST | Autenticado |
| Chat | `/mensajes/:id/reportar` | POST | Autenticado |
| Chat | `/mensajes/reportados` | GET | Administrador |
| Chat | `/mensajes/:id/ocultar` | PATCH | Administrador |
| Notificaciones | `/notificaciones/mias` | GET | Autenticado |
| Estadísticas | `/estadisticas/publicas` | GET | Público |

---

## Arquitectura interna acordada

Backend y frontend se organizan por funcionalidades (Screaming Architecture). Dentro de cada funcionalidad se aplica Clean Architecture: `domain` y `application` no dependen de `infrastructure` ni de `presentation`; las dependencias apuntan hacia adentro. `shared` contiene solo elementos realmente compartidos. La arquitectura no cambia las URL ni los campos de este contrato.

## Fuera del MVP y definiciones pendientes

- **Fuera del MVP:** push geolocalizado dentro de un radio exacto (RF-21 original). Los avisos de esta versión son internos y por zona.
- **Pendiente de definición técnica:** algoritmo de cuadrícula para el marcador público, mecanismo de actualización sin recarga del panel de Autoridad y medición del límite de tres segundos de RNF-01, y alcance exacto de los permisos de gestión. El procedimiento privado del primer Administrador ya está preparado; aún no se ha ejecutado en la base principal.
- El esquema SQL ya se ejecutó sobre la base recreada, seguido de la carga inicial de Urbanización Villa Sol y su chat.
