# Panel de Autoridad: lectura de la referencia de Stitch

La referencia visual presenta un espacio de operación distinto del dashboard de Vecino y Comerciante. En este bloque solo se habilita el acceso de Autoridad y una página interna separada. Los registros, cantidades, identidades y acciones de la maqueta son ejemplos visuales, no datos de la aplicación.

| Elemento de la maqueta | Fuente real posible y estado actual |
| --- | --- |
| Cabecera y nombre de la cuenta | `POST /usuarios/login` y `GET /usuarios/perfil` ya devuelven el rol y el nombre reales. La ruta `/autoridad` queda protegida por rol. |
| Tabla de incidentes, gravedad, estado y fecha | `reportes` y sus catálogos almacenan estos datos, pero **no existe aún** `GET /reportes?vista=` ni una consulta de gestión para Autoridad. Los reportes propios y su detalle solo autorizan al autor. No se muestran los cinco casos ficticios de Stitch. |
| Totales pendientes, graves y SOS | Podrán calcularse desde reportes reales después de definir filtros, permisos y consultas del panel. No se muestran las cifras de la maqueta. |
| Filtro por zona y cuadrante | Existen zonas en el catálogo, sin nombres ni ID fijos. No existe un modelo geográfico de cuadrantes ni asignación automática de incidentes por coordenadas. Los filtros de la maqueta no están operativos. |
| Detalle, historial y evidencias | El esquema almacena descripción, historial, audio y fotos/video. Las rutas actuales de detalle y archivos son **solo del autor**; el acceso de Autoridad requiere definir e implementar permisos de gestión. No se reutiliza el detalle privado vecinal como si fuera una vista institucional. |
| Verificación y cambio de estado | El esquema contiene `verificaciones_reporte` e `historial_estados`; faltan las operaciones de Autoridad, sus transacciones y controles. No se muestran botones operativos. |
| Avisos SOS en vivo | `GET /notificaciones/mias` existe, pero `POST /sos`, la creación de avisos internos y la actualización sin recarga del panel siguen pendientes. No se muestra ningún SOS ficticio. |
| Identidad del reportante | El modelo tiene nombre, correo y teléfono privado; no guarda DNI, dirección fiscal ni una identidad validada. Su posible exposición a Autoridad exige definir permisos y finalidad. Los datos personales de Stitch no se incorporan. |
| Patrullas, despacho, C4, latencia y teléfonos | No hay entidades ni integraciones que respalden ubicación de unidades, despacho, red C4 o los números mostrados. No se anuncian como servicios operativos. |
| Exportación, directorios, afirmaciones legales y respaldo oficial | No existen rutas ni contenido verificado para esas acciones o afirmaciones. Permanecen fuera de la pantalla actual. |

La referencia sirve para una futura distribución de bandeja, filtros, detalle y acciones. Cada control se incorporará solo cuando exista una fuente real, un contrato y permisos comprobables.
