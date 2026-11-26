# Los Olivos Conectados

Aplicación de participación y seguridad vecinal en desarrollo. El proyecto contiene un frontend Angular/Ionic, un backend Node.js/TypeScript y un esquema PostgreSQL.

## Estructura

- `frontend/`: interfaz web y base de la aplicación móvil.
- `backend/`: API y acceso a PostgreSQL.
- `docs/`: requisitos, contrato de API, diseño de base de datos y decisiones del MVP.

## Desarrollo local

1. Crear una base PostgreSQL y aplicar `docs/los_olivos_conectados_schema.sql` y después `docs/carga_inicial_villa_sol.sql` en una base nueva y vacía.
2. En `backend/`, crear un archivo `.env` a partir de `.env.example` y configurar la conexión a PostgreSQL y `JWT_SECRET`. No publicar ese archivo.
3. Instalar las dependencias de `backend/` y `frontend/` con `npm ci` en cada carpeta.
4. Iniciar el backend con `npm run dev` en `backend/` y el frontend con `npm start` en `frontend/`.

## Estado de publicación

El repositorio de GitHub contiene el código, pero subirlo no despliega la aplicación. La API y PostgreSQL requieren alojamiento accesible desde internet, configuración privada, HTTPS y almacenamiento persistente para los archivos adjuntos. GitHub Pages por sí solo no ejecuta el backend ni la base de datos. El frontend de producción aún supone que la API comparte su origen.

Consulta `docs/pendientes-mvp.md` para las funciones y verificaciones pendientes antes de ofrecer el servicio al público.
