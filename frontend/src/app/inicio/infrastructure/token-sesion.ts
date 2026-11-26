import type { AlmacenToken } from '../application/acceso';

const CLAVE = 'los-olivos-conectados:token';
let tokenEnMemoria: string | null = null;

export const tokenSesion: AlmacenToken = {
  leer() {
    try {
      return sessionStorage.getItem(CLAVE) ?? tokenEnMemoria;
    } catch {
      return tokenEnMemoria;
    }
  },
  guardar(token) {
    tokenEnMemoria = token;
    try {
      sessionStorage.setItem(CLAVE, token);
    } catch {
      // Si el navegador bloquea el almacenamiento, la sesión dura hasta recargar.
    }
  },
  limpiar() {
    tokenEnMemoria = null;
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      // No hay almacenamiento persistido que limpiar.
    }
  },
};
