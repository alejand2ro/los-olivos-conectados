import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const nombrePrueba = `loc_evid_${randomBytes(6).toString('hex')}`;
assert.notEqual(nombrePrueba, process.env.DB_NOMBRE);
const carpeta = await mkdtemp(path.join(os.tmpdir(), 'loc-evid-'));
const archivos = path.join(carpeta, 'archivos');
const conexion = (database) => ({ host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO || 5432),
  user: process.env.DB_USUARIO, password: process.env.DB_CLAVE, database });
const admin = new pg.Client(conexion('postgres'));
let datos;
let servidor;
let baseBloqueada;
let creada = false;
const secreto = randomBytes(40).toString('hex');

async function puertoLibre() {
  const socket = net.createServer();
  await new Promise((resolver) => socket.listen(0, '127.0.0.1', resolver));
  const puerto = socket.address().port;
  await new Promise((resolver) => socket.close(resolver));
  return puerto;
}
async function iniciarServidor(directorio) {
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const proceso = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NOMBRE: nombrePrueba, PUERTO: String(puerto), JWT_SECRET: secreto, REPORTES_EVIDENCIAS_DIR: directorio }, stdio: 'ignore' });
  for (let intento = 0; intento < 80; intento++) {
    try { if ((await fetch(`${base}/salud`)).ok) return { proceso, base }; } catch { /* arranque pendiente */ }
    await esperar(100);
  }
  proceso.kill();
  throw new Error('El servidor aislado no inició');
}
async function subir(base, reporteId, token, tipo, bytes, clave = randomUUID()) {
  const cuerpo = new FormData();
  cuerpo.set('tipo_archivo', tipo);
  cuerpo.set('clave_carga', clave);
  cuerpo.set('archivo', new Blob([bytes], { type: tipo === 'foto' ? 'image/png' : 'video/mp4' }), 'archivo-disfrazado.txt');
  const respuesta = await fetch(`${base}/reportes/${reporteId}/evidencias`, { method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}, body: cuerpo });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}
const cuenta = (id) => jwt.sign({}, secreto, { algorithm: 'HS256', subject: String(id), issuer: 'los-olivos-conectados',
  audience: 'los-olivos-conectados-api', expiresIn: '1h' });

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombrePrueba}`);
  creada = true;
  datos = new pg.Client(conexion(nombrePrueba));
  await datos.connect();
  await datos.query(await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8'));
  const zona = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona aislada') RETURNING id")).rows[0].id;
  const rol = (await datos.query("SELECT id FROM roles WHERE nombre='vecino'")).rows[0].id;
  const tipo = (await datos.query('SELECT id FROM tipos_incidente LIMIT 1')).rows[0].id;
  const gravedad = (await datos.query('SELECT id FROM niveles_gravedad LIMIT 1')).rows[0].id;
  const estado = (await datos.query("SELECT id FROM estados_reporte WHERE codigo='recibido'")).rows[0].id;
  const usuarios = [];
  for (let i = 1; i <= 2; i++) {
    usuarios.push((await datos.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [`Vecino ${i}`, `evidencia${i}@test.invalid`, 'no-usado', rol, zona])).rows[0].id);
  }
  const reporte = (await datos.query(`INSERT INTO reportes(usuario_id,tipo_incidente_id,zona_id,descripcion_texto,latitud,longitud,nivel_gravedad_id,estado_actual_id)
    VALUES($1,$2,$3,'Prueba de evidencias',-11.98,-77.06,$4,$5) RETURNING id`, [usuarios[0], tipo, zona, gravedad, estado])).rows[0].id;
  const { proceso, base } = await iniciarServidor(archivos);
  servidor = proceso;
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#224466' } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#448822' } }).jpeg().toBuffer();
  const mp4 = await readFile(new URL('./fixture-video.mp4', import.meta.url));
  assert.equal((await subir(base, reporte, null, 'foto', png)).estado, 401);
  const ajena = await subir(base, reporte, cuenta(usuarios[1]), 'foto', png);
  assert.equal(ajena.estado, 403, JSON.stringify(ajena));
  assert.equal((await subir(base, 999999, cuenta(usuarios[0]), 'foto', png)).estado, 404);
  const claveFoto = randomUUID();
  const primera = await subir(base, reporte, cuenta(usuarios[0]), 'foto', png, claveFoto);
  assert.equal(primera.estado, 201, JSON.stringify(primera));
  assert.deepEqual(Object.keys(primera.cuerpo).sort(), ['id', 'reporte_id', 'tipo_archivo', 'url_archivo'].sort());
  assert.equal(primera.cuerpo.url_archivo, `/reportes/${reporte}/evidencias/${primera.cuerpo.id}/archivo`);
  const repetida = await subir(base, reporte, cuenta(usuarios[0]), 'foto', png, claveFoto);
  assert.equal(repetida.estado, 201);
  assert.equal(repetida.cuerpo.id, primera.cuerpo.id);
  assert.equal((await readdir(archivos)).length, 1);
  const url = `${base}${primera.cuerpo.url_archivo}`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${cuenta(usuarios[1])}` } })).status, 403);
  const lectura = await fetch(url, { headers: { Authorization: `Bearer ${cuenta(usuarios[0])}` } });
  assert.equal(lectura.status, 200);
  assert.equal(lectura.headers.get('content-type'), 'image/png');
  assert.equal((await sharp(Buffer.from(await lectura.arrayBuffer())).metadata()).format, 'png');
  const video = await subir(base, reporte, cuenta(usuarios[0]), 'video', mp4);
  assert.equal(video.estado, 201, JSON.stringify(video));
  assert.equal((await fetch(`${base}${video.cuerpo.url_archivo}`, { headers: { Authorization: `Bearer ${cuenta(usuarios[0])}` } })).status, 200);
  const filasAntes = (await datos.query('SELECT count(*)::int AS total FROM evidencias WHERE reporte_id=$1', [reporte])).rows[0].total;
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'foto', Buffer.from('falsa PNG'))).estado, 400);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'video', Buffer.from('falso MP4'))).estado, 400);
  const mp4Falso = Buffer.alloc(64); mp4Falso.write('ftyp', 4);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'video', mp4Falso)).estado, 400);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'foto', Buffer.alloc(5 * 1024 * 1024 + 1))).estado, 413);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'video', Buffer.alloc(20 * 1024 * 1024 + 1))).estado, 413);
  assert.equal((await datos.query('SELECT count(*)::int AS total FROM evidencias WHERE reporte_id=$1', [reporte])).rows[0].total, filasAntes);
  assert.equal((await readdir(archivos)).length, filasAntes);
  for (let i = 0; i < 3; i++) assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'foto', jpeg)).estado, 201);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'foto', jpeg)).estado, 409);
  assert.equal((await subir(base, reporte, cuenta(usuarios[0]), 'video', mp4)).estado, 409);
  assert.equal((await readdir(archivos)).length, 5, 'No quedan archivos de intentos rechazados');
  const repetidaConCupoLleno = await subir(base, reporte, cuenta(usuarios[0]), 'foto', png, claveFoto);
  assert.equal(repetidaConCupoLleno.estado, 201);
  assert.equal(repetidaConCupoLleno.cuerpo.id, primera.cuerpo.id);
  assert.equal((await readdir(archivos)).length, 5);
  const guardada = (await datos.query('SELECT url_archivo FROM evidencias WHERE id=$1', [primera.cuerpo.id])).rows[0].url_archivo;
  assert.match(guardada, /^privado\/evidencias\//);
  assert.ok(!guardada.includes('/reportes/'));
  servidor.kill(); await esperar(200); servidor = null;
  const rutaBloqueada = path.join(carpeta, 'archivo-en-vez-de-directorio');
  await writeFile(rutaBloqueada, 'bloqueado');
  ({ proceso: servidor, base: baseBloqueada } = await iniciarServidor(rutaBloqueada));
  assert.equal((await subir(baseBloqueada, reporte, cuenta(usuarios[0]), 'foto', png)).estado, 500);
  assert.equal((await readdir(archivos)).length, 5);
  console.log('OK: foto y video reales, JWT y aislamiento, límites, limpieza, descarga protegida e idempotencia de reintentos.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [nombrePrueba]);
    await admin.query(`DROP DATABASE ${nombrePrueba}`);
  }
  await admin.end().catch(() => {});
  await rm(carpeta, { recursive: true, force: true });
}
