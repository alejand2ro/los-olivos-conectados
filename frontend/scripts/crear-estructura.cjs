const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', 'src', 'app');

// Módulos de negocio: lo primero que se ve en src/app "grita" de qué trata el sistema
const modulos = [
    'usuarios', 'reportes', 'sos', 'alertas', 'mapa',
    'chat', 'estadisticas', 'notificaciones', 'autoridad',
];
const capas = ['domain', 'application', 'infrastructure', 'presentation'];

// Código transversal a todos los módulos
const compartido = [
    'shared/layout',          // header y estructura común de página
    'shared/components',      // componentes reutilizables (badges, tarjetas, etc.)
    'shared/guards',          // protección de rutas por rol
    'shared/infrastructure',  // cliente HTTP, interceptor del token
];

const carpetas = [
    ...modulos.flatMap((m) => capas.map((c) => `${m}/${c}`)),
    ...compartido,
];

for (const carpeta of carpetas) {
    const ruta = path.join(raiz, carpeta);
    fs.mkdirSync(ruta, { recursive: true });
    fs.writeFileSync(path.join(ruta, '.gitkeep'), '');
}
console.log(`Estructura creada: ${carpetas.length} carpetas`);