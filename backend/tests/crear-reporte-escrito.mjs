import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const nombrePrueba = `loc_reporte_${randomBytes(6).toString('hex')}`;
assert.notEqual(nombrePrueba, process.env.DB_NOMBRE);
const conexion = (database) => ({
  host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO || 5432),
  user: process.env.DB_USUARIO, password: process.env.DB_CLAVE, database,
});
const admin = new pg.Client(conexion('postgres'));
let datos;
let servidor;
let creada = false;

async function puertoLibre() {
  const socket = net.createServer();
  await new Promise((resolver) => socket.listen(0, '127.0.0.1', resolver));
  const puerto = socket.address().port;
  await new Promise((resolver) => socket.close(resolver));
  return puerto;
}

async function solicitar(base, ruta, token, cuerpo) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombrePrueba}`);
  creada = true;
  datos = new pg.Client(conexion(nombrePrueba));
  await datos.connect();
  await datos.query(await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8'));
  const zona1 = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona de prueba A') RETURNING id")).rows[0].id;
  const zona2 = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona de prueba B') RETURNING id")).rows[0].id;
  const rol = (await datos.query("SELECT id FROM roles WHERE nombre = 'vecino'")).rows[0].id;
  const tipo = (await datos.query('SELECT id FROM tipos_incidente ORDER BY id LIMIT 1')).rows[0].id;
  const gravedad = (await datos.query('SELECT id FROM niveles_gravedad ORDER BY id LIMIT 1')).rows[0].id;
  const cuentas = [];
  for (const numero of [1, 2]) {
    cuentas.push((await datos.query(
      'INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [`Vecino ${numero}`, `vecino${numero}@test.invalid`, 'no-usado', rol, numero === 1 ? zona1 : zona2],
    )).rows[0].id);
  }

  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const secreto = randomBytes(40).toString('hex');
  servidor = spawn(process.execPath, ['dist/main.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NOMBRE: nombrePrueba, PUERTO: String(puerto), JWT_SECRET: secreto },
    stdio: 'ignore',
  });
  let listo = false;
  for (let intento = 0; intento < 40; intento++) {
    try { if ((await fetch(`${base}/salud`)).ok) { listo = true; break; } } catch { /* arranque pendiente */ }
    await esperar(100);
  }
  assert.ok(listo, 'El servidor de prueba no inició');
  const token = (id) => jwt.sign({}, secreto, {
    algorithm: 'HS256', subject: String(id), issuer: 'los-olivos-conectados',
    audience: 'los-olivos-conectados-api', expiresIn: '1h',
  });
  const propio = token(cuentas[0]);
  const ajeno = token(cuentas[1]);
  const valido = {
    tipo_incidente_id: tipo, descripcion_texto: '  Incidente de prueba  ',
    latitud: -11.9823, longitud: -77.0645, nivel_gravedad_id: gravedad,
  };
  assert.equal((await solicitar(base, '/reportes', undefined, valido)).estado, 401);
  assert.equal((await solicitar(base, '/reportes', `${propio}alterado`, valido)).estado, 401);
  for (const cuerpo of [
    { ...valido, tipo_incidente_id: 999999 },
    { ...valido, nivel_gravedad_id: 999999 },
    { ...valido, zona_id: 999999 },
    { ...valido, descripcion_texto: '   ' },
    { ...valido, descripcion_texto: undefined },
    { ...valido, latitud: undefined },
    { ...valido, longitud: undefined },
    { ...valido, latitud: 91 },
    { ...valido, longitud: 'dato-falso' },
    { ...valido, usuario_id: cuentas[1] },
    { ...valido, es_sos: true },
  ]) {
    const respuesta = await solicitar(base, '/reportes', propio, cuerpo);
    assert.equal(respuesta.estado, 400, JSON.stringify(cuerpo));
    assert.equal(typeof respuesta.cuerpo.error, 'string');
  }

  const omitida = await solicitar(base, '/reportes', propio, valido);
  assert.equal(omitida.estado, 201);
  assert.deepEqual(Object.keys(omitida.cuerpo).sort(), ['id', 'estado_codigo', 'estado_nombre', 'fecha_creacion'].sort());
  assert.equal(omitida.cuerpo.estado_codigo, 'recibido');
  assert.equal(omitida.cuerpo.estado_nombre, 'Recibido');
  assert.ok(!Number.isNaN(Date.parse(omitida.cuerpo.fecha_creacion)));
  assert.ok(omitida.cuerpo.fecha_creacion.endsWith('Z'));
  const otraZona = await solicitar(base, '/reportes', propio, { ...valido, zona_id: zona2 });
  assert.equal(otraZona.estado, 201);

  for (const [respuesta, zonaEsperada] of [[omitida, zona1], [otraZona, zona2]]) {
    const reporte = (await datos.query(
      'SELECT usuario_id,zona_id,descripcion_texto,es_sos,verificado,latitud,longitud FROM reportes WHERE id=$1',
      [respuesta.cuerpo.id],
    )).rows[0];
    assert.equal(reporte.usuario_id, cuentas[0]);
    assert.equal(reporte.zona_id, zonaEsperada);
    assert.equal(reporte.descripcion_texto, 'Incidente de prueba');
    assert.equal(reporte.es_sos, false);
    assert.equal(reporte.verificado, false);
    assert.equal(Number(reporte.latitud), valido.latitud);
    assert.equal(Number(reporte.longitud), valido.longitud);
    const historial = (await datos.query(
      `SELECT h.usuario_id, h.estado_anterior_id, e.codigo
       FROM historial_estados h JOIN estados_reporte e ON e.id=h.estado_nuevo_id
       WHERE h.reporte_id=$1`, [respuesta.cuerpo.id],
    )).rows;
    assert.equal(historial.length, 1);
    assert.equal(historial[0].usuario_id, cuentas[0]);
    assert.equal(historial[0].estado_anterior_id, null);
    assert.equal(historial[0].codigo, 'recibido');
    assert.equal((await datos.query('SELECT count(*)::int AS total FROM alertas WHERE reporte_id=$1', [respuesta.cuerpo.id])).rows[0].total, 0);
  }
  const mios = await solicitar(base, '/reportes/mios?pagina=1', propio);
  assert.equal(mios.estado, 200);
  assert.deepEqual(mios.cuerpo.resultados.map((fila) => fila.id), [otraZona.cuerpo.id, omitida.cuerpo.id]);
  assert.deepEqual((await solicitar(base, '/reportes/mios?pagina=1', ajeno)).cuerpo.resultados, []);
  console.log('OK: creación escrita, zona predeterminada y alternativa, validaciones, JWT, historial único, sin alerta y aislamiento.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [nombrePrueba]);
    await admin.query(`DROP DATABASE ${nombrePrueba}`);
  }
  await admin.end().catch(() => {});
}
