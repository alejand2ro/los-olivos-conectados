import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const nombrePrueba = `loc_notif_${randomBytes(6).toString('hex')}`;
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

async function consultar(base, ruta, token) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombrePrueba}`);
  creada = true;
  datos = new pg.Client(conexion(nombrePrueba));
  await datos.connect();
  await datos.query(await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8'));
  const zona = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona de prueba') RETURNING id")).rows[0].id;
  const rol = (await datos.query("SELECT id FROM roles WHERE nombre = 'vecino'")).rows[0].id;
  const usuarios = [];
  for (const numero of [1, 2]) {
    usuarios.push((await datos.query(
      'INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [`Vecino ${numero}`, `vecino${numero}@test.invalid`, 'no-usado', rol, zona],
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
  const token1 = token(usuarios[0]);
  const token2 = token(usuarios[1]);
  assert.deepEqual((await consultar(base, '/notificaciones/mias', token1)).cuerpo.resultados, []);
  assert.equal((await consultar(base, '/notificaciones/mias')).estado, 401);
  assert.equal((await consultar(base, '/notificaciones/mias?pagina=0', token1)).estado, 400);
  assert.equal((await consultar(base, '/notificaciones/mias?otra=1', token1)).estado, 400);
  assert.equal((await consultar(base, '/notificaciones/mias', `${token1}x`)).estado, 401);
  const estado = (await datos.query("SELECT id FROM estados_reporte WHERE codigo = 'recibido'")).rows[0].id;
  const gravedad = (await datos.query("SELECT id FROM niveles_gravedad WHERE nombre = 'Alta'")).rows[0].id;
  const reporte = (await datos.query(
    `INSERT INTO reportes(usuario_id,zona_id,latitud,longitud,nivel_gravedad_id,es_sos,estado_actual_id)
     VALUES ($1,$2,-11.98,-77.06,$3,true,$4) RETURNING id`, [usuarios[0], zona, gravedad, estado],
  )).rows[0].id;
  const ids = [];
  for (let numero = 0; numero < 22; numero++) {
    const usuario = numero < 21 ? usuarios[0] : usuarios[1];
    ids.push((await datos.query(
      `INSERT INTO notificaciones(usuario_id,tipo,reporte_id,fecha_envio)
       VALUES ($1,'cambio_estado',$2,$3) RETURNING id`,
      [usuario, reporte, `2026-01-01T10:${String(numero).padStart(2, '0')}:00Z`],
    )).rows[0].id);
  }
  const primera = await consultar(base, '/notificaciones/mias?pagina=1', token1);
  assert.equal(primera.estado, 200);
  assert.equal(primera.cuerpo.total, 21);
  assert.equal(primera.cuerpo.total_paginas, 2);
  assert.equal(primera.cuerpo.resultados.length, 20);
  assert.equal(primera.cuerpo.resultados[0].id, ids[20]);
  assert.deepEqual(Object.keys(primera.cuerpo.resultados[0]).sort(), ['id', 'tipo', 'alerta_id', 'reporte_id', 'leido', 'fecha_envio'].sort());
  const segunda = await consultar(base, '/notificaciones/mias?pagina=2', token1);
  assert.deepEqual(segunda.cuerpo.resultados.map((fila) => fila.id), [ids[0]]);
  assert.deepEqual((await consultar(base, '/notificaciones/mias?pagina=3', token1)).cuerpo.resultados, []);
  const ajeno = await consultar(base, '/notificaciones/mias', token2);
  assert.deepEqual(ajeno.cuerpo.resultados.map((fila) => fila.id), [ids[21]]);
  assert.ok(!primera.cuerpo.resultados.some((fila) => fila.id === ids[21]));
  console.log('OK: bandeja vacía, autenticación, aislamiento entre usuarios, campos permitidos y paginación.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [nombrePrueba]);
    await admin.query(`DROP DATABASE ${nombrePrueba}`);
  }
  await admin.end().catch(() => {});
}
