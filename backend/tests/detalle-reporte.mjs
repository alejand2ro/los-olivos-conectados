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

const nombre = `loc_detalle_${randomBytes(6).toString('hex')}`;
assert.notEqual(nombre, process.env.DB_NOMBRE);
const carpeta = await mkdtemp(path.join(os.tmpdir(), 'loc-detalle-'));
const audioDir = path.join(carpeta, 'audio');
const evidenciaDir = path.join(carpeta, 'evidencias');
const conexion = (database) => ({ host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO || 5432),
  user: process.env.DB_USUARIO, password: process.env.DB_CLAVE, database });
const admin = new pg.Client(conexion('postgres'));
const secreto = randomBytes(40).toString('hex');
let datos; let servidor; let creada = false;
const cuenta = (id) => jwt.sign({}, secreto, { algorithm: 'HS256', subject: String(id),
  issuer: 'los-olivos-conectados', audience: 'los-olivos-conectados-api', expiresIn: '1h' });
const llamar = (base, ruta, token) => fetch(`${base}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombre}`);
  creada = true;
  datos = new pg.Client(conexion(nombre));
  await datos.connect();
  await datos.query(await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8'));
  const zona = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona aislada') RETURNING id")).rows[0].id;
  const rol = (await datos.query("SELECT id FROM roles WHERE nombre='vecino'")).rows[0].id;
  const tipo = (await datos.query('SELECT id FROM tipos_incidente LIMIT 1')).rows[0].id;
  const gravedad = (await datos.query('SELECT id FROM niveles_gravedad LIMIT 1')).rows[0].id;
  const estado = (await datos.query("SELECT id FROM estados_reporte WHERE codigo='recibido'")).rows[0].id;
  const usuarios = [];
  for (let n = 1; n <= 2; n++) usuarios.push((await datos.query(
    'INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [`Persona ${n}`, `detalle${n}@test.invalid`, 'no-usado', rol, zona],
  )).rows[0].id);
  const audioNombre = `${randomUUID()}.wav`;
  const audioBytes = Buffer.from('RIFF0000WAVEfmt audio de prueba aislado');
  await import('node:fs/promises').then((fs) => fs.mkdir(audioDir, { recursive: true }));
  await writeFile(path.join(audioDir, audioNombre), audioBytes);
  const reporte = (await datos.query(`INSERT INTO reportes(usuario_id,tipo_incidente_id,zona_id,
    descripcion_audio_url,latitud,longitud,nivel_gravedad_id,estado_actual_id)
    VALUES($1,$2,$3,$4,-11.98,-77.06,$5,$6) RETURNING id`,
  [usuarios[0], tipo, zona, `privado/reportes-audio/${audioNombre}`, gravedad, estado])).rows[0].id;
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const puerto = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${puerto}`;
  servidor = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NOMBRE: nombre, PUERTO: String(puerto), JWT_SECRET: secreto,
      REPORTES_AUDIO_DIR: audioDir, REPORTES_EVIDENCIAS_DIR: evidenciaDir }, stdio: 'ignore' });
  let listo = false;
  for (let n = 0; n < 80; n++) {
    try { if ((await fetch(`${base}/salud`)).ok) { listo = true; break; } } catch { /* esperando */ }
    await esperar(100);
  }
  assert.ok(listo, 'El servidor aislado debe arrancar');
  const propietario = cuenta(usuarios[0]); const ajeno = cuenta(usuarios[1]);
  for (const sufijo of ['', '/estado', '/audio']) {
    assert.equal((await llamar(base, `/reportes/${reporte}${sufijo}`)).status, 401);
    assert.equal((await llamar(base, `/reportes/${reporte}${sufijo}`, ajeno)).status, 403);
    assert.equal((await llamar(base, `/reportes/999999${sufijo}`, propietario)).status, 404);
  }
  const detalle = await (await llamar(base, `/reportes/${reporte}`, propietario)).json();
  assert.equal(detalle.id, reporte);
  assert.equal(detalle.estado_codigo, 'recibido');
  assert.equal(detalle.descripcion_audio_url, `/reportes/${reporte}/audio`);
  assert.equal(detalle.latitud, -11.98);
  assert.ok(!JSON.stringify(detalle).includes('privado/reportes-audio/'));
  const primero = await (await llamar(base, `/reportes/${reporte}/estado`, propietario)).json();
  assert.equal(primero.historial.length, 1);
  assert.equal(primero.historial[0].estado_codigo, 'recibido');
  assert.equal(primero.historial[0].comentario, null);
  const segundoEstado = (await datos.query("SELECT id FROM estados_reporte WHERE codigo <> 'recibido' ORDER BY id LIMIT 1")).rows[0].id;
  await datos.query('UPDATE reportes SET estado_actual_id=$1 WHERE id=$2', [segundoEstado, reporte]);
  await datos.query('INSERT INTO historial_estados(reporte_id,usuario_id,estado_anterior_id,estado_nuevo_id,comentario) VALUES($1,$2,$3,$4,$5)',
    [reporte, usuarios[1], estado, segundoEstado, 'Cambio de prueba']);
  const despues = await (await llamar(base, `/reportes/${reporte}/estado`, propietario)).json();
  assert.equal(despues.historial.length, 2);
  assert.equal(despues.historial[1].comentario, 'Cambio de prueba');
  assert.equal(despues.estado_codigo, despues.historial[1].estado_codigo);
  const audio = await llamar(base, `/reportes/${reporte}/audio`, propietario);
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get('content-type'), 'audio/wav');
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), audioBytes);
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#224466' } }).png().toBuffer();
  const cuerpo = new FormData();
  cuerpo.set('tipo_archivo', 'foto'); cuerpo.set('clave_carga', randomUUID());
  cuerpo.set('archivo', new Blob([png], { type: 'image/png' }), 'prueba.png');
  const subida = await fetch(`${base}/reportes/${reporte}/evidencias`, {
    method: 'POST', headers: { Authorization: `Bearer ${propietario}` }, body: cuerpo,
  });
  assert.equal(subida.status, 201, await subida.text());
  const actualizado = await (await llamar(base, `/reportes/${reporte}`, propietario)).json();
  assert.equal(actualizado.evidencias.length, 1);
  const ruta = actualizado.evidencias[0].url_archivo;
  assert.match(ruta, /^\/reportes\/\d+\/evidencias\/\d+\/archivo$/);
  assert.equal((await llamar(base, ruta, ajeno)).status, 403);
  const archivo = await llamar(base, ruta, propietario);
  assert.equal(archivo.status, 200); assert.equal(archivo.headers.get('content-type'), 'image/png');
  assert.equal((await readdir(evidenciaDir)).length, 1);
  console.log('OK: autor, cuenta ajena, inexistente, historial real, audio protegido y evidencia posterior.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [nombre]);
    await admin.query(`DROP DATABASE ${nombre}`);
  }
  await admin.end().catch(() => {});
  await rm(carpeta, { recursive: true, force: true });
}
