import { crearAcceso } from '../application/acceso';
import type { CatalogosRegistro, PerfilPropio } from '../domain/acceso';
import { apiAccesoHttp } from './api-acceso-http';
import { tokenSesion } from './token-sesion';
import { ErrorApi } from '../application/acceso';

const acceso = crearAcceso(apiAccesoHttp, tokenSesion);
let perfilActual: PerfilPropio | null = null;
let restauracion: Promise<PerfilPropio | null> | null = null;
let catalogosEnCurso: Promise<CatalogosRegistro> | null = null;
let versionSesion = 0;

function aplicarModoAccesible(perfil: PerfilPropio | null): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('modo-accesible-cuenta', !!perfil?.modo_accesibilidad);
}

export const accesoActual = {
  catalogos(): Promise<CatalogosRegistro> {
    if (!catalogosEnCurso) {
      const solicitud = acceso.catalogos().finally(() => {
        if (catalogosEnCurso === solicitud) catalogosEnCurso = null;
      });
      catalogosEnCurso = solicitud;
    }
    return catalogosEnCurso;
  },
  registro: acceso.registro,
  async login(credenciales: Parameters<typeof acceso.login>[0]) {
    versionSesion += 1;
    perfilActual = null;
    aplicarModoAccesible(null);
    restauracion = null;
    return acceso.login(credenciales);
  },
  restaurarSesion(): Promise<PerfilPropio | null> {
    if (perfilActual) return Promise.resolve(perfilActual);
    if (!restauracion) {
      const version = versionSesion;
      const solicitud = acceso.restaurarSesion().then((perfil) => {
        if (version !== versionSesion) return null;
        perfilActual = perfil;
        aplicarModoAccesible(perfil);
        return perfil;
      }).finally(() => {
        if (restauracion === solicitud) restauracion = null;
      });
      restauracion = solicitud;
    }
    return restauracion;
  },
  leerToken: () => tokenSesion.leer(),
  perfilValidado: () => perfilActual,
  async consultarPerfil(): Promise<PerfilPropio> {
    const token = tokenSesion.leer();
    if (!token) throw new Error('Sesión no disponible');
    const version = versionSesion;
    let perfil: PerfilPropio;
    try {
      perfil = await apiAccesoHttp.perfil(token);
    } catch (error) {
      if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 404)) this.cerrarSesion();
      throw error;
    }
    if (version !== versionSesion) throw new Error('La sesión cambió');
    versionSesion += 1;
    perfilActual = perfil;
    aplicarModoAccesible(perfil);
    return perfil;
  },
  async actualizarPerfil(cambios: { telefono?: string | null; modo_accesibilidad?: boolean }): Promise<PerfilPropio> {
    const token = tokenSesion.leer();
    if (!token) throw new Error('Sesión no disponible');
    const version = versionSesion;
    let perfil: PerfilPropio;
    try {
      perfil = await apiAccesoHttp.actualizarPerfil(token, cambios);
    } catch (error) {
      if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 404)) this.cerrarSesion();
      throw error;
    }
    if (version !== versionSesion) throw new Error('La sesión cambió');
    versionSesion += 1;
    perfilActual = perfil;
    aplicarModoAccesible(perfil);
    return perfil;
  },
  cerrarSesion() {
    versionSesion += 1;
    perfilActual = null;
    aplicarModoAccesible(null);
    restauracion = null;
    catalogosEnCurso = null;
    acceso.cerrarSesion();
  },
};
