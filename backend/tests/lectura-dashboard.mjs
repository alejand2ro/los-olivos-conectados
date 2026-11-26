import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const nombrePrueba = `loc_lectura_${randomBytes(6).toString('hex')}`;
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

async function solicitar(base, ruta, token) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

async function insertarReporte(usuario, zona, tipo, estado, gravedad, fecha, verificado = false, sos = false) {
  const { rows } = await datos.query(
    `INSERT INTO reportes (usuario_id, tipo_incidente_id, zona_id, descripcion_texto,
      latitud, longitud, nivel_gravedad_id, es_sos, estado_actual_id, verificado, fecha_creacion)
     VALUES ($1,$2,$3,$4,-11.98,-77.06,$5,$6,$7,$8,$9) RETURNING id`,
    [usuario, tipo, zona, sos ? null : 'Texto privado de prueba', gravedad, sos, estado, verificado, fecha],
  );
  return rows[0].id;
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombrePrueba}`);
  creada = true;
  datos = new pg.Client(conexion(nombrePrueba));
  await datos.connect();
  const esquema = await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8');
  await datos.query(esquema);
  const zona1 = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona A') RETURNING id")).rows[0].id;
  const zona2 = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona B') RETURNING id")).rows[0].id;
  const rol = (await datos.query("SELECT id FROM roles WHERE nombre = 'vecino'")).rows[0].id;
  const autoridad = (await datos.query("SELECT id FROM roles WHERE nombre = 'autoridad'")).rows[0].id;
  const estado = (await datos.query("SELECT id FROM estados_reporte WHERE codigo = 'recibido'")).rows[0].id;
  const gravedad = (await datos.query("SELECT id FROM niveles_gravedad WHERE nombre = 'Alta'")).rows[0].id;
  const tipo = (await datos.query("SELECT id FROM tipos_incidente WHERE nombre = 'Robo'")).rows[0].id;
  const usuario1 = (await datos.query(
    "INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES ('Uno','uno@test.invalid','no-usado',$1,$2) RETURNING id", [rol, zona1],
  )).rows[0].id;
  const usuario2 = (await datos.query(
    "INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES ('Dos','dos@test.invalid','no-usado',$1,$2) RETURNING id", [rol, zona2],
  )).rows[0].id;
  const verificador = (await datos.query(
    "INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id) VALUES ('Revisor','rev@test.invalid','no-usado',$1) RETURNING id", [autoridad],
  )).rows[0].id;

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
  const propio = token(usuario1);
  assert.deepEqual((await solicitar(base, '/alertas?pagina=1')).cuerpo.resultados, []);
  assert.deepEqual((await solicitar(base, '/reportes/mios?pagina=1', propio)).cuerpo.resultados, []);

  const r1 = await insertarReporte(usuario1, zona1, tipo, estado, gravedad, '2026-01-01T10:00:00Z', true);
  const r2 = await insertarReporte(usuario1, zona2, tipo, estado, gravedad, '2026-01-02T10:00:00Z');
  const r3 = await insertarReporte(usuario2, zona1, tipo, estado, gravedad, '2026-01-03T10:00:00Z', true);
  const r4 = await insertarReporte(usuario2, zona1, tipo, estado, gravedad, '2026-01-04T10:00:00Z');
  const r5 = await insertarReporte(usuario2, zona2, tipo, estado, gravedad, '2026-01-05T10:00:00Z', true);
  const r6 = await insertarReporte(usuario1, zona1, null, estado, gravedad, '2026-01-06T10:00:00Z', false, true);
  for (const id of [r1, r3, r5]) {
    await datos.query('INSERT INTO verificaciones_reporte(reporte_id,usuario_id) VALUES ($1,$2)', [id, verificador]);
    await datos.query('INSERT INTO alertas(reporte_id,fecha_publicacion) VALUES ($1,$2)', [id, `2026-01-0${id}T11:00:00Z`]);
  }
  // Incluso una fila de alerta incoherente debe permanecer privada.
  await datos.query('INSERT INTO alertas(reporte_id) VALUES ($1)', [r4]);

  const mios = await solicitar(base, '/reportes/mios?pagina=1', propio);
  assert.equal(mios.estado, 200);
  assert.deepEqual(mios.cuerpo.resultados.map((r) => r.id), [r6, r2, r1]);
  assert.equal(mios.cuerpo.total, 3);
  assert.equal(mios.cuerpo.tamano_pagina, 20);
  assert.equal(mios.cuerpo.resultados[0].tipo_incidente, null);
  assert.equal((await solicitar(base, '/reportes/mios?pagina=1')).estado, 401);
  assert.equal((await solicitar(base, '/reportes/mios?pagina=0', propio)).estado, 400);
  const siguientes = await solicitar(base, '/reportes/mios?pagina=2', propio);
  assert.deepEqual(siguientes.cuerpo.resultados, []);
  assert.equal(siguientes.cuerpo.total, 3);

  const alertas = await solicitar(base, '/alertas?pagina=1');
  assert.equal(alertas.estado, 200);
  assert.equal(alertas.cuerpo.total, 3);
  assert.equal(alertas.cuerpo.resultados.length, 3);
  for (const alerta of alertas.cuerpo.resultados) {
    assert.deepEqual(Object.keys(alerta).sort(), ['fecha_publicacion', 'id', 'tipo_incidente', 'zona'].sort());
    assert.ok(!JSON.stringify(alerta).includes('Texto privado'));
  }
  const locales = await solicitar(base, `/alertas?pagina=1&zona_id=${zona1}`);
  assert.equal(locales.cuerpo.total, 2);
  assert.ok(locales.cuerpo.resultados.every((a) => a.zona === 'Zona A'));
  assert.equal((await solicitar(base, `/alertas?pagina=1&zona_id=${zona2}`)).cuerpo.total, 1);
  assert.deepEqual((await solicitar(base, '/alertas?pagina=1&zona_id=999999')).cuerpo.resultados, []);
  assert.equal((await solicitar(base, '/alertas?pagina=-1')).estado, 400);
  console.log('OK: estados vacíos, aislamiento por autor, paginación, zonas, verificación y privacidad pública.');
} finally {
  if (servidor) {
    servidor.kill();
    await esperar(200);
  }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [nombrePrueba]);
    await admin.query(`DROP DATABASE ${nombrePrueba}`);
  }
  await admin.end().catch(() => {});
}
