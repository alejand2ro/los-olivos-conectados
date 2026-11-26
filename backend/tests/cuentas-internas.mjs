import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const nombre = `loc_internos_${randomBytes(6).toString('hex')}`;
assert.notEqual(nombre, process.env.DB_NOMBRE);
const conexion = (database) => ({ host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO || 5432),
  user: process.env.DB_USUARIO, password: process.env.DB_CLAVE, database });
const adminBd = new pg.Client(conexion('postgres'));
let datos; let servidor; let creada = false; let pool;
const claveJwt = randomBytes(40).toString('hex');
const solicitar = async (base, ruta, body, token) => {
  const respuesta = await fetch(`${base}${ruta}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(body) });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
};

try {
  await adminBd.connect();
  await adminBd.query(`CREATE DATABASE ${nombre}`);
  creada = true;
  datos = new pg.Client(conexion(nombre));
  await datos.connect();
  await datos.query(await readFile(new URL('../../docs/los_olivos_conectados_schema.sql', import.meta.url), 'utf8'));
  process.env.DB_NOMBRE = nombre;
  process.env.JWT_SECRET = claveJwt;
  const { crearPrimerAdministrador } = require('../dist/usuarios/application/crear-primer-administrador.js');
  const { primerAdministradorPostgres } = require('../dist/usuarios/infrastructure/cuentas-internas-postgres.js');
  const { seguridadRegistro } = require('../dist/usuarios/infrastructure/registro-usuarios-postgres.js');
  const { AdministradorInicialExistente } = require('../dist/usuarios/domain/cuenta-interna.js');
  ({ pool } = require('../dist/shared/infrastructure/database/postgres.js'));
  const altaInicial = crearPrimerAdministrador(primerAdministradorPostgres, seguridadRegistro);
  const inicial = await altaInicial({ nombre: 'Administración de prueba', correo: '  ADMIN@Test.Invalid ', contrasena: 'clave-inicial-de-prueba' });
  assert.equal(inicial.rol, 'administrador'); assert.equal(inicial.correo, 'admin@test.invalid');
  assert.equal(inicial.zona_id, null); assert.equal(inicial.alias_chat, null);
  assert.ok(!JSON.stringify(inicial).includes('clave-inicial-de-prueba'));
  const fila = (await datos.query(`SELECT u.contrasena_hash, r.nombre AS rol FROM usuarios u
    JOIN roles r ON r.id=u.rol_id WHERE u.id=$1`, [inicial.id])).rows[0];
  assert.equal(fila.rol, 'administrador'); assert.match(fila.contrasena_hash, /^\$argon2id\$v=19\$/);
  assert.ok(!fila.contrasena_hash.includes('clave-inicial-de-prueba'));
  await assert.rejects(altaInicial({ nombre: 'Otra', correo: 'otra@test.invalid', contrasena: 'otra-clave-segura' }), AdministradorInicialExistente);
  assert.equal((await datos.query('SELECT count(*)::int AS total FROM inicio_administrador')).rows[0].total, 1);
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const puerto = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${puerto}`;
  servidor = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NOMBRE: nombre, PUERTO: String(puerto), JWT_SECRET: claveJwt }, stdio: 'ignore' });
  let listo = false;
  for (let intento = 0; intento < 80; intento++) {
    try { if ((await fetch(`${base}/salud`)).ok) { listo = true; break; } } catch { /* inicio pendiente */ }
    await esperar(100);
  }
  assert.ok(listo, 'El servidor aislado debe arrancar');
  const loginAdmin = await solicitar(base, '/usuarios/login', { correo: 'ADMIN@test.invalid', contrasena: 'clave-inicial-de-prueba' });
  assert.equal(loginAdmin.estado, 200, JSON.stringify(loginAdmin));
  assert.equal(loginAdmin.cuerpo.usuario.rol, 'administrador');
  assert.equal(loginAdmin.cuerpo.usuario.zona_id, null);
  const tokenAdmin = loginAdmin.cuerpo.token;
  const perfilAdmin = await fetch(`${base}/usuarios/perfil`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  assert.equal(perfilAdmin.status, 200);
  assert.deepEqual((({ rol, zona_id, alias_chat }) => ({ rol, zona_id, alias_chat }))(await perfilAdmin.json()),
    { rol: 'administrador', zona_id: null, alias_chat: null });
  assert.equal((await solicitar(base, '/usuarios/login', { correo: 'admin@test.invalid', contrasena: 'incorrecta' })).estado, 401);
  const zona = (await datos.query("INSERT INTO zonas(nombre) VALUES ('Zona de prueba') RETURNING id")).rows[0].id;
  for (const rol of ['administrador', 'autoridad']) {
    const intento = await solicitar(base, '/usuarios/registro', { nombre: 'Interno falso', correo: `${rol}@test.invalid`,
      contrasena: 'clave-publica', rol, zona_id: zona, consentimiento_privacidad_aceptado: true, compromiso_sos_aceptado: true });
    assert.equal(intento.estado, 400, JSON.stringify(intento));
  }
  const vecino = await solicitar(base, '/usuarios/registro', { nombre: 'Vecino de prueba', correo: 'vecino@test.invalid',
    contrasena: 'clave-vecinal', rol: 'vecino', zona_id: zona, consentimiento_privacidad_aceptado: true, compromiso_sos_aceptado: true });
  assert.equal(vecino.estado, 201, JSON.stringify(vecino));
  const loginVecino = await solicitar(base, '/usuarios/login', { correo: 'vecino@test.invalid', contrasena: 'clave-vecinal' });
  assert.equal(loginVecino.estado, 200);
  const cuerpo = { nombre: 'Autoridad de prueba', correo: '  AUTORIDAD@Test.Invalid ', contrasena: 'clave-autoridad' };
  assert.equal((await solicitar(base, '/usuarios/autoridad', cuerpo)).estado, 401);
  assert.equal((await solicitar(base, '/usuarios/autoridad', cuerpo, 'token-alterado')).estado, 401);
  assert.equal((await solicitar(base, '/usuarios/autoridad', cuerpo, loginVecino.cuerpo.token)).estado, 403);
  const creadaAutoridad = await solicitar(base, '/usuarios/autoridad', cuerpo, tokenAdmin);
  assert.equal(creadaAutoridad.estado, 201, JSON.stringify(creadaAutoridad));
  assert.equal(creadaAutoridad.cuerpo.rol, 'autoridad');
  assert.equal(creadaAutoridad.cuerpo.correo, 'autoridad@test.invalid');
  assert.equal(creadaAutoridad.cuerpo.zona_id, null);
  assert.ok(!JSON.stringify(creadaAutoridad.cuerpo).includes('clave-autoridad'));
  const loginAutoridad = await solicitar(base, '/usuarios/login', { correo: 'autoridad@test.invalid', contrasena: 'clave-autoridad' });
  assert.equal(loginAutoridad.estado, 200, JSON.stringify(loginAutoridad));
  assert.equal(loginAutoridad.cuerpo.usuario.rol, 'autoridad');
  const perfilAutoridad = await fetch(`${base}/usuarios/perfil`, { headers: { Authorization: `Bearer ${loginAutoridad.cuerpo.token}` } });
  assert.equal(perfilAutoridad.status, 200);
  assert.equal((await perfilAutoridad.json()).rol, 'autoridad');
  assert.equal((await solicitar(base, '/usuarios/autoridad', cuerpo, loginAutoridad.cuerpo.token)).estado, 403);
  assert.equal((await solicitar(base, '/usuarios/autoridad', cuerpo, tokenAdmin)).estado, 409);
  assert.equal((await solicitar(base, '/usuarios/autoridad', { ...cuerpo, rol_id: 1 }, tokenAdmin)).estado, 400);
  await datos.query("UPDATE usuarios SET rol_id=(SELECT id FROM roles WHERE nombre='vecino'), zona_id=$1 WHERE id=$2", [zona, inicial.id]);
  assert.equal((await solicitar(base, '/usuarios/autoridad', { ...cuerpo, correo: 'nueva@test.invalid' }, tokenAdmin)).estado, 403,
    'Un token emitido antes del cambio de rol no conserva privilegios');
  await assert.rejects(altaInicial({ nombre: 'Segunda', correo: 'segunda@test.invalid', contrasena: 'clave-segunda' }), AdministradorInicialExistente);
  console.log('OK: creación inicial única, Argon2id, login por rol, alta de Autoridad y permisos 401/403/409.');
} finally {
  if (servidor) { servidor.kill(); await esperar(200); }
  if (pool) await pool.end().catch(() => {});
  if (datos) await datos.end().catch(() => {});
  if (creada) {
    await adminBd.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [nombre]);
    await adminBd.query(`DROP DATABASE ${nombre}`);
  }
  await adminBd.end().catch(() => {});
}
