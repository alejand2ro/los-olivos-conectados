import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const nombrePrueba = `loc_audio_${randomBytes(6).toString('hex')}`;
assert.notEqual(nombrePrueba, process.env.DB_NOMBRE);
const carpetaPrueba = await mkdtemp(path.join(os.tmpdir(), 'loc-audio-'));
const audioDir = path.join(carpetaPrueba, 'audios');
const conexion = (database) => ({ host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO || 5432),
  user: process.env.DB_USUARIO, password: process.env.DB_CLAVE, database });
const admin = new pg.Client(conexion('postgres'));
let datos;
let servidor;
let base;
let creada = false;

async function puertoLibre() {
  const socket = net.createServer();
  await new Promise((resolver) => socket.listen(0, '127.0.0.1', resolver));
  const puerto = socket.address().port;
  await new Promise((resolver) => socket.close(resolver));
  return puerto;
}
async function iniciarServidor(dir) {
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const proceso = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NOMBRE: nombrePrueba, PUERTO: String(puerto), JWT_SECRET: secreto, REPORTES_AUDIO_DIR: dir }, stdio: 'ignore' });
  for (let intento = 0; intento < 60; intento++) {
    try { if ((await fetch(`${base}/salud`)).ok) return { proceso, base }; } catch { /* arranque pendiente */ }
    await esperar(100);
  }
  proceso.kill();
  throw new Error('El servidor de prueba no inició');
}
function wav(segundos) {
  const largo = 16000 * 2 * segundos;
  const bytes = Buffer.alloc(44 + largo);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(largo, 40);
  return bytes;
}
async function subir(base, token, campos, archivo = wav(2)) {
  const cuerpo = new FormData();
  for (const [clave, valor] of Object.entries(campos)) cuerpo.append(clave, String(valor));
  if (archivo !== null) cuerpo.append('archivo_descripcion_audio', new Blob([archivo], { type: 'audio/wav' }), 'falso.txt');
  const respuesta = await fetch(`${base}/reportes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: cuerpo });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}
const secreto = randomBytes(40).toString('hex');

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
  const usuario = (await datos.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    ['Prueba Audio', 'audio@test.invalid', 'no-usado', rol, zona])).rows[0].id;
  const token = jwt.sign({}, secreto, { algorithm: 'HS256', subject: String(usuario), issuer: 'los-olivos-conectados',
    audience: 'los-olivos-conectados-api', expiresIn: '1h' });
  ({ proceso: servidor, base } = await iniciarServidor(audioDir));
  const campos = { tipo_incidente_id: tipo, nivel_gravedad_id: gravedad, latitud: -11.98, longitud: -77.06 };
  const valido = await subir(base, token, campos);
  assert.equal(valido.estado, 201, JSON.stringify(valido));
  assert.equal(valido.cuerpo.estado_codigo, 'recibido');
  const fila = (await datos.query('SELECT usuario_id,descripcion_texto,descripcion_audio_url,verificado FROM reportes WHERE id=$1', [valido.cuerpo.id])).rows[0];
  assert.equal(fila.usuario_id, usuario);
  assert.equal(fila.descripcion_texto, null);
  assert.match(fila.descripcion_audio_url, /^privado\/reportes-audio\/[0-9a-f-]{36}\.wav$/);
  assert.equal(fila.verificado, false);
  assert.deepEqual(await readFile(path.join(audioDir, path.basename(fila.descripcion_audio_url))), wav(2));
  assert.equal((await datos.query('SELECT count(*)::int AS total FROM historial_estados WHERE reporte_id=$1', [valido.cuerpo.id])).rows[0].total, 1);
  assert.equal((await datos.query('SELECT count(*)::int AS total FROM alertas WHERE reporte_id=$1', [valido.cuerpo.id])).rows[0].total, 0);
  const nombresIniciales = await readdir(audioDir);
  assert.equal((await subir(base, token, campos, Buffer.from('no es audio'))).estado, 415);
  assert.equal((await subir(base, token, campos, wav(0))).estado, 415);
  assert.equal((await subir(base, token, campos, wav(61))).estado, 415);
  assert.equal((await subir(base, token, campos, Buffer.alloc(3 * 1024 * 1024 + 1))).estado, 413);
  assert.equal((await subir(base, token, { ...campos, descripcion_audio_url: 'https://ejemplo.invalid/x.wav' })).estado, 400);
  assert.equal((await subir(base, token, { ...campos, tipo_incidente_id: 999999 })).estado, 400);
  assert.deepEqual(await readdir(audioDir), nombresIniciales, 'No deben quedar archivos huérfanos tras fallos');
  const texto = await fetch(`${base}/reportes`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...campos, descripcion_texto: 'Sigue funcionando texto' }) });
  assert.equal(texto.status, 201);
  servidor.kill(); await esperar(200); servidor = null;
  const rutaBloqueada = path.join(carpetaPrueba, 'ruta-que-es-archivo');
  await writeFile(rutaBloqueada, 'bloqueado');
  ({ proceso: servidor, base } = await iniciarServidor(rutaBloqueada));
  assert.equal((await subir(base, token, campos)).estado, 500, 'El error de almacenamiento debe ser JSON');
  assert.equal((await datos.query('SELECT count(*)::int AS total FROM reportes WHERE descripcion_audio_url IS NOT NULL')).rows[0].total, 1);
  console.log('OK: audio WAV real, límites, almacenamiento privado, limpieza tras error SQL, fallo de disco y JSON escrito intacto.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [nombrePrueba]);
    await admin.query(`DROP DATABASE ${nombrePrueba}`);
  }
  await admin.end().catch(() => {});
  await rm(carpetaPrueba, { recursive: true, force: true });
}
