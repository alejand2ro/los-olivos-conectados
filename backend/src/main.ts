import http from 'node:http';
import { env } from './shared/config/env';
import { verificarConexion } from './shared/infrastructure/database/postgres';
import { aplicarCors } from './shared/infrastructure/http/cors';
import { crearObtenerCatalogos } from './catalogos/application/obtener-catalogos';
import { repositorioCatalogosPostgres } from './catalogos/infrastructure/repositorio-catalogos-postgres';
import { crearResponderCatalogos } from './catalogos/presentation/responder-catalogos';
import { crearRegistrarUsuario } from './usuarios/application/registrar-usuario';
import { repositorioRegistroPostgres, seguridadRegistro } from './usuarios/infrastructure/registro-usuarios-postgres';
import { crearResponderRegistro } from './usuarios/presentation/registro-http';
import { crearIniciarSesion } from './usuarios/application/iniciar-sesion';
import { repositorioLoginPostgres, verificadorContrasenaArgon2id } from './usuarios/infrastructure/login-usuarios-postgres';
import { emisorTokenJwt, verificarToken } from './usuarios/infrastructure/token-jwt';
import { crearResponderLogin } from './usuarios/presentation/login-http';
import { crearObtenerPerfil } from './usuarios/application/obtener-perfil';
import { repositorioPerfilPostgres } from './usuarios/infrastructure/repositorio-perfil-postgres';
import { crearResponderPerfil } from './usuarios/presentation/perfil-http';
import { crearActualizarPerfil } from './usuarios/application/actualizar-perfil';
import { actualizadorPerfilPostgres } from './usuarios/infrastructure/actualizar-perfil-postgres';
import { crearResponderActualizarPerfil } from './usuarios/presentation/actualizar-perfil-http';
import { crearAltaAutoridad } from './usuarios/application/crear-autoridad';
import { autoridadPostgres } from './usuarios/infrastructure/cuentas-internas-postgres';
import { crearResponderAltaAutoridad } from './usuarios/presentation/autoridad-http';
import { crearListarMisReportes } from './reportes/application/listar-mis-reportes';
import { reportesPropiosPostgres } from './reportes/infrastructure/reportes-propios-postgres';
import { crearResponderMisReportes } from './reportes/presentation/reportes-mios-http';
import { crearConsultarReporte } from './reportes/application/consultar-reporte';
import { detalleReportePostgres } from './reportes/infrastructure/detalle-reporte-postgres';
import { crearResponderDetalleReporte } from './reportes/presentation/detalle-reporte-http';
import { crearReporteEscrito } from './reportes/application/crear-reporte-escrito';
import { creadorReportePostgres } from './reportes/infrastructure/crear-reporte-postgres';
import { crearResponderReporte } from './reportes/presentation/crear-reporte-http';
import { crearGuardarEvidencia, crearLeerEvidencia } from './reportes/application/guardar-evidencia';
import { evidenciasPostgres } from './reportes/infrastructure/evidencias-postgres';
import { almacenEvidenciasPrivado } from './reportes/infrastructure/almacen-evidencias-privado';
import { crearResponderGuardarEvidencia, crearResponderLeerEvidencia } from './reportes/presentation/evidencias-http';
import { crearReporteAudio } from './reportes/application/crear-reporte-audio';
import { almacenAudioPrivado } from './reportes/infrastructure/almacen-audio-privado';
import { crearListarAlertas } from './alertas/application/listar-alertas';
import { alertasPublicasPostgres } from './alertas/infrastructure/alertas-publicas-postgres';
import { crearResponderAlertas } from './alertas/presentation/alertas-http';
import { crearListarMisNotificaciones } from './notificaciones/application/listar-mis-notificaciones';
import { notificacionesPropiasPostgres } from './notificaciones/infrastructure/notificaciones-propias-postgres';
import { crearResponderMisNotificaciones } from './notificaciones/presentation/notificaciones-mias-http';

function responderJson(res: http.ServerResponse, estado: number, cuerpo: unknown) {
    res.writeHead(estado, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
}

async function iniciar() {
    await verificarConexion();
    const responderCatalogos = crearResponderCatalogos(
        crearObtenerCatalogos(repositorioCatalogosPostgres),
    );
    const responderRegistro = crearResponderRegistro(
        crearRegistrarUsuario(repositorioRegistroPostgres, seguridadRegistro),
    );
    const responderLogin = crearResponderLogin(
        crearIniciarSesion(repositorioLoginPostgres, verificadorContrasenaArgon2id, emisorTokenJwt),
    );
    const responderPerfil = crearResponderPerfil(
        crearObtenerPerfil(repositorioPerfilPostgres, { verificar: verificarToken }),
    );
    const responderActualizarPerfil = crearResponderActualizarPerfil(
        crearActualizarPerfil(actualizadorPerfilPostgres, { verificar: verificarToken }),
    );
    const responderAltaAutoridad = crearResponderAltaAutoridad(
        crearAltaAutoridad({ verificar: verificarToken }, autoridadPostgres, seguridadRegistro),
    );
    const responderMisReportes = crearResponderMisReportes(
        crearListarMisReportes(reportesPropiosPostgres, { verificar: verificarToken }),
    );
    const responderDetalleReporte = crearResponderDetalleReporte(
        crearConsultarReporte({ verificar: verificarToken }, detalleReportePostgres, almacenAudioPrivado),
    );
    const responderReporte = crearResponderReporte(
        crearReporteEscrito(creadorReportePostgres, { verificar: verificarToken }),
        crearReporteAudio(creadorReportePostgres, { verificar: verificarToken }, almacenAudioPrivado),
    );
    const responderGuardarEvidencia = crearResponderGuardarEvidencia(
        crearGuardarEvidencia({ verificar: verificarToken }, evidenciasPostgres, almacenEvidenciasPrivado),
    );
    const responderLeerEvidencia = crearResponderLeerEvidencia(
        crearLeerEvidencia({ verificar: verificarToken }, evidenciasPostgres, almacenEvidenciasPrivado),
    );
    const responderAlertas = crearResponderAlertas(crearListarAlertas(alertasPublicasPostgres));
    const responderMisNotificaciones = crearResponderMisNotificaciones(
        crearListarMisNotificaciones(notificacionesPropiasPostgres, { verificar: verificarToken }),
    );

    const servidor = http.createServer((req, res) => {
        if (aplicarCors(req, res)) return;

        if (req.method === 'GET' && req.url === '/salud') {
            return responderJson(res, 200, { estado: 'ok' });
        }
        if (req.method === 'GET' && req.url === '/catalogos') {
            void responderCatalogos(res);
            return;
        }
        if (req.method === 'POST' && req.url === '/usuarios/registro') {
            void responderRegistro(req, res);
            return;
        }
        if (req.method === 'POST' && req.url === '/usuarios/login') {
            void responderLogin(req, res);
            return;
        }
        if (req.method === 'GET' && req.url === '/usuarios/perfil') {
            void responderPerfil(req, res);
            return;
        }
        if (req.method === 'PATCH' && req.url === '/usuarios/perfil') {
            void responderActualizarPerfil(req, res);
            return;
        }
        if (req.method === 'POST' && req.url === '/usuarios/autoridad') {
            void responderAltaAutoridad(req, res);
            return;
        }
        const ruta = req.url?.split('?', 1)[0];
        const rutaEvidencia = ruta?.match(/^\/reportes\/([1-9]\d*)\/evidencias$/);
        if (req.method === 'POST' && rutaEvidencia) {
            void responderGuardarEvidencia(req, res, Number(rutaEvidencia[1]));
            return;
        }
        const rutaArchivoEvidencia = ruta?.match(/^\/reportes\/([1-9]\d*)\/evidencias\/([1-9]\d*)\/archivo$/);
        if (req.method === 'GET' && rutaArchivoEvidencia) {
            void responderLeerEvidencia(req, res, Number(rutaArchivoEvidencia[1]), Number(rutaArchivoEvidencia[2]));
            return;
        }
        if (req.method === 'GET' && ruta === '/reportes/mios') {
            void responderMisReportes(req, res);
            return;
        }
        const rutaDetalle = ruta?.match(/^\/reportes\/([1-9]\d*)(?:\/(estado|audio))?$/);
        if (req.method === 'GET' && rutaDetalle) {
            void responderDetalleReporte(req, res, Number(rutaDetalle[1]),
                rutaDetalle[2] === 'estado' ? 'seguimiento' : rutaDetalle[2] === 'audio' ? 'audio' : 'detalle');
            return;
        }
        if (req.method === 'POST' && ruta === '/reportes') {
            void responderReporte(req, res);
            return;
        }
        if (req.method === 'GET' && ruta === '/alertas') {
            void responderAlertas(req, res);
            return;
        }
        if (req.method === 'GET' && ruta === '/notificaciones/mias') {
            void responderMisNotificaciones(req, res);
            return;
        }
        responderJson(res, 404, { error: 'Ruta no encontrada' });
    });

    servidor.listen(env.PUERTO, () => {
        console.log(`Servidor escuchando en http://localhost:${env.PUERTO}`);
    });
}

iniciar().catch((error) => {
    console.error('No se pudo iniciar el backend:', error);
    process.exit(1);
});
