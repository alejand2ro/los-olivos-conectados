const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', 'src');

// Módulos de negocio: lo primero que se ve al abrir src/ "grita" de qué trata el sistema
const modulos = [
    'usuarios', 'reportes', 'sos', 'alertas',
    'mapa', 'chat', 'estadisticas', 'notificaciones',
];
const capas = ['domain', 'application', 'infrastructure', 'presentation'];

// Código transversal a todos los módulos
const compartido = [
    'shared/config',
    'shared/domain',
    'shared/infrastructure/database',
    'shared/infrastructure/http',
];

const carpetas = [
    ...modulos.flatMap((m) => capas.map((c) => `${m}/${c}`)),
    ...compartido,
];

for (const carpeta of carpetas) {
    const ruta = path.join(raiz, carpeta);
    fs.mkdirSync(ruta, { recursive: true });
    fs.writeFileSync(path.join(ruta, '.gitkeep'), ''); // para que Git conserve carpetas vacías
}
console.log(`Estructura creada: ${carpetas.length} carpetas`);