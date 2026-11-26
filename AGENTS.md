# Los Olivos Conectados

MVP web y Android de seguridad y comunicación vecinal para Los Olivos: reportes, SOS, alertas verificadas, seguimiento y comunicación por zona. El alcance acordado y las definiciones técnicas pendientes están en `docs/decisiones-mvp.md`.

## Fuentes del proyecto

- `docs/Requerimientos y Diseño - Los Olivos Conectados.docx`: objetivos, usuarios y requisitos.
- `docs/Contrato de API — Los Olivos Conectados.md`: contrato REST existente.
- `docs/Diseño de BD — Los Olivos Conectados.md`: modelo y justificación de datos.
- `docs/los_olivos_conectados_schema.sql`: tablas y catálogos del MVP.
- `docs/carga_inicial_villa_sol.sql`: primera zona y su chat, sin fijar el `id`.
- `docs/analisis-panel-autoridad.md`: elementos reales y simulados de la referencia de Stitch para Autoridad.

La base PostgreSQL `los_olivos_conectados` ya fue recreada: se ejecutó primero el esquema y después la carga inicial. El usuario comprobó que Urbanización Villa Sol y su chat aparecen en la base.

## Estado y estructura del código

- `backend/`: Node.js con TypeScript, servidor HTTP nativo, `pg` y `dotenv`. `src/main.ts` conecta los módulos; `shared/` contiene configuración, conexión, CORS y paginación. Funcionan `GET /salud`, `GET /catalogos`, registro, login, perfil, listas paginadas de reportes propios, alertas y notificaciones, `POST /reportes` con texto o audio, detalle e historial del autor, entrega privada del audio y carga/lectura protegida de fotos y video. `POST /usuarios/autoridad` exige un Administrador vigente. El procedimiento privado del primer Administrador está preparado, sin ejecutar en la base principal. El arranque comprueba la tabla `roles`.
- `frontend/`: Angular con componentes independientes, Ionic y Capacitor. `src/app/app.routes.ts` conecta Inicio público, espacio vecinal, `/autoridad` y `/administracion` con guardias por rol, y alertas públicas. La cabecera compartida muestra navegación interna distinta para Autoridad y Administrador. El Administrador puede crear cuentas de Autoridad; su dashboard completo y la gestión de incidentes aún faltan. Registro, login, perfil, reportes propios, detalle, historial, archivos privados, alertas y notificaciones usan la API; la sesión web usa temporalmente `sessionStorage`.
- Los módulos implementados tienen capas por funcionalidad. Otras carpetas conservan solo `.gitkeep` y no equivalen a funciones terminadas. Mapa comunitario, chat y SOS siguen pendientes; tampoco existen acciones para marcar avisos como leídos. El formulario de reportes admite texto o una nota de voz, exige un punto real en Leaflet y puede adjuntar fotos/videos tras crear el reporte. El detalle permite consultar y añadir evidencias al reporte existente.

## Arquitectura acordada

Organizar backend y frontend por funcionalidades (Screaming Architecture). Dentro de cada funcionalidad, aplicar Clean Architecture y crear solo las capas necesarias: `domain` no depende de otras capas; `application` puede depender de `domain`, pero ninguna de las dos depende de `infrastructure` ni de `presentation`. Los adaptadores externos y la interfaz dependen hacia adentro. Usar `shared` solo para elementos realmente compartidos, no como destino de funcionalidades. Los puntos de entrada conectan las implementaciones con los casos de uso.

## Forma de trabajo

Antes de implementar, revisar los requisitos, `docs/decisiones-mvp.md`, el contrato de API, el diseño y SQL de la base de datos, y el código relacionado. Señalar contradicciones entre esas fuentes y resolverlas explícitamente. Trabajar por etapas pequeñas y verificables, sin presentar carpetas preparadas o contratos escritos como funciones terminadas.

Tratar cada pantalla de Stitch como una referencia visual: incorporar solo los elementos que el usuario elija para esa pantalla. No asumir que toda la pantalla de referencia define requisitos o comportamiento de la aplicación.
