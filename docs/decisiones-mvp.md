# Decisiones del MVP de Los Olivos Conectados

Este archivo registra las decisiones acordadas para el MVP de 13 semanas. Los requisitos, el contrato de API y el diseño de BD fueron alineados. La base `los_olivos_conectados` ya fue recreada: se ejecutó primero el esquema SQL, que crea tablas y catálogos, y después `carga_inicial_villa_sol.sql`, que cargó la primera zona y su chat. El usuario comprobó ambos registros en PostgreSQL. Estas decisiones no indican que el backend o frontend ya estén implementados.

## Decisiones acordadas

### SOS y alcance de RF-14

- El SOS conserva un flujo rápido, sin formulario adicional. Se registra como reporte con `es_sos = true`, gravedad Alta y estado Recibido. Solo en un SOS pueden quedar vacíos el tipo de incidente y la descripción; en reportes normales siguen siendo obligatorios.
- La ubicación real es obligatoria para enviar el SOS. Si no está disponible, la interfaz permite reintentar o seleccionar el punto manualmente; nunca inventa coordenadas. Se usa inicialmente la zona de residencia de la cuenta, sin solicitar otra selección. Autoridad puede corregir después la zona del incidente.
- Al enviar el SOS, se crea inmediatamente un aviso dentro de la aplicación para las cuentas de Autoridad. Los vecinos reciben un aviso solo después de que el incidente se verifique. Un SOS pendiente no se publica como alerta verificada. El sistema no afirmará que una autoridad lo recibió personalmente ni que contactó a un servicio de emergencia externo.
- **Cambio expreso de RF-14:** para este MVP, el aviso inmediato del SOS es para Autoridad dentro de la aplicación; el aviso vecinal ocurre después de la verificación, no al pulsar SOS.

### Registro, roles y zonas

- **Cambio expreso de RF-01:** el correo es obligatorio para registro e inicio de sesión; el teléfono es opcional. Ya no se ofrece registro usando solo teléfono.
- En el registro público se puede elegir Vecino o Comerciante, con los mismos permisos iniciales. Autoridad y Administrador no son opciones públicas. El primer Administrador se crea mediante un procedimiento inicial controlado; las cuentas de Autoridad las crea el Administrador.
- La zona de residencia es obligatoria para Vecino y Comerciante. Determina su chat y los avisos vecinales por zona. Es distinta de la zona donde ocurrió un incidente.
- La base admite múltiples zonas y un chat por zona. La carga inicial separada ya añadió Urbanización Villa Sol y `Chat Urbanización Villa Sol`; su nombre y su `id` no se fijan en la lógica. Las cuentas internas pueden carecer de zona de residencia. PostgreSQL exige zona a Vecino y Comerciante según el nombre del rol, sin depender de sus `id` numéricos; el backend también lo validará cuando se implemente.
- Un reporte normal propone inicialmente la zona de residencia; el usuario puede corregirla si el hecho ocurrió en otro sector. Cerca de un límite, el usuario elige la zona que mejor corresponda. Autoridad puede corregir la zona durante la revisión. En un SOS se usa inicialmente la zona de la cuenta, sin selección adicional. Las coordenadas reales del incidente se conservan para la gestión interna. No se presume una deducción automática de zonas por coordenadas: el esquema actual no define límites geográficos.

### Mapa y privacidad

- El público ve solo alertas verificadas, sin datos que identifiquen al autor. El detalle público de una alerta es distinto del detalle completo y protegido del reporte.
- Cada usuario puede ver sus propios reportes no verificados; Autoridad y Administrador ven los reportes que deban gestionar. Los no verificados llevan una marca visual clara en esas vistas.
- En el mapa público, cada incidente verificado usa un marcador aproximado y estable calculado sobre una cuadrícula aproximada, inicialmente pensada en torno a 200 metros. El detalle público muestra también la zona. Las coordenadas exactas quedan disponibles solo para el autor y las cuentas autorizadas.

### Auditoría

- `historial_estados` registra los cambios de estado. Al crear un reporte se registra también el estado inicial Recibido, atribuido al usuario que lo envió.
- La verificación tiene un registro propio de quién verificó y cuándo. El cambio de datos y su registro de auditoría se guardan juntos en una transacción. Un usuario común no puede modificar ni borrar el historial.
- El registro físico es `verificaciones_reporte`, con una fila única por reporte, `usuario_id` del verificador y `fecha_verificacion` con zona horaria. PostgreSQL bloquea `UPDATE` y `DELETE` de `historial_estados` mediante un trigger; la inserción del estado inicial se realiza automáticamente con el reporte.

### Notificaciones y alcance de RF-21

- En la primera versión, las notificaciones vecinales son dentro de la aplicación y por zona. Los SOS generan el aviso interno inmediato a Autoridad; los vecinos reciben el aviso correspondiente después de la verificación.
- **Cambio expreso de RF-21:** el push a dispositivos dentro de un radio geográfico exacto queda fuera de este MVP. Los avisos internos por zona no cumplen RF-21 tal como está redactado y no se presentarán como si lo cumplieran.
- `radio_notificacion_metros` no forma parte del esquema nuevo del MVP; el push por radio sigue pendiente para otra etapa.
- «Aviso inmediato» significa que el SOS queda guardado en la bandeja de Autoridad y aparece automáticamente, con una señal visual clara y sin recargar la página, en un panel de Autoridad que esté abierto. Si no hay un panel abierto, queda pendiente y visible al entrar. Se mantiene el objetivo de respuesta de tres segundos de RNF-01 en condiciones normales para el envío y la notificación a un panel abierto; el mecanismo y la medición deberán precisarse y verificarse.

### Contrato de API, audio y convenciones

- El contrato incluye rutas para consultar catálogos, listar los reportes propios, consultar las notificaciones propias y revisar mensajes denunciados. También distingue el mapa y detalle públicos del detalle protegido, y contempla la corrección de zona por Autoridad.
- `POST /reportes` acepta JSON cuando la descripción es escrita. Si la descripción es audio, recibe el archivo y los datos juntos mediante `multipart/form-data`; el backend valida y guarda el archivo y genera una referencia privada. La ruta de evidencias posterior al reporte sigue siendo un concepto distinto.
- La API usará códigos estables de estado, por ejemplo `en_proceso`; la interfaz mostrará nombres legibles como «En proceso». Las fechas se guardarán con zona horaria y se devolverán en UTC. Las referencias erróneas a «RF-02.6» para la descripción se corrigen por RF-09 y RF-11.

## Definiciones técnicas aún pendientes

- Precisar y documentar el cálculo de la cuadrícula del mapa público: tamaño y referencia de la cuadrícula, conversión de coordenadas, estabilidad del marcador y comprobación de que la aproximación protege la ubicación exacta.
- Elegir e implementar el mecanismo de actualización en tiempo real del panel de Autoridad y definir cómo se medirá el objetivo de tres segundos de RNF-01. Debe funcionar sin recarga con el panel abierto; guardar una fila por sí solo no demuestra recepción personal.
- Precisar las operaciones para corregir la zona y los formatos y permisos de las nuevas rutas; el registro físico de verificación y la protección de `historial_estados` ya están definidos en el esquema SQL aplicado. Su uso por el backend sigue pendiente de implementación.
- El procedimiento privado del primer Administrador ya está preparado en `backend/scripts/crear-primer-administrador.ts` y documentado en el contrato; no se ha ejecutado en la base principal. La validación y el almacenamiento del audio ya están definidos en el contrato de API: WAV PCM mono 16 kHz, 1 a 60 segundos, máximo 3 MiB y almacenamiento privado con limpieza si falla la creación. Estas decisiones de implementación no cambian el alcance funcional acordado arriba.
