import type {
  CatalogosRegistro,
  Credenciales,
  DatosRegistro,
  PerfilPropio,
  UsuarioRegistrado,
  UsuarioSesion,
} from '../domain/acceso';

export class ErrorApi extends Error {
  constructor(readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

export interface ApiAcceso {
  catalogos(): Promise<CatalogosRegistro>;
  login(credenciales: Credenciales): Promise<{ token: string; usuario: UsuarioSesion }>;
  registro(datos: DatosRegistro): Promise<UsuarioRegistrado>;
  perfil(token: string): Promise<PerfilPropio>;
  actualizarPerfil(token: string, cambios: { telefono?: string | null; modo_accesibilidad?: boolean }): Promise<PerfilPropio>;
}

export interface AlmacenToken {
  leer(): string | null;
  guardar(token: string): void;
  limpiar(): void;
}

export function crearAcceso(api: ApiAcceso, almacen: AlmacenToken) {
  return {
    catalogos: () => api.catalogos(),
    registro: (datos: DatosRegistro) => api.registro(datos),
    async login(credenciales: Credenciales): Promise<UsuarioSesion> {
      const respuesta = await api.login(credenciales);
      almacen.guardar(respuesta.token);
      return respuesta.usuario;
    },
    async restaurarSesion(): Promise<PerfilPropio | null> {
      const token = almacen.leer();
      if (!token) return null;
      try {
        return await api.perfil(token);
      } catch (error) {
        if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 404)) {
          almacen.limpiar();
          return null;
        }
        throw error;
      }
    },
    cerrarSesion: () => almacen.limpiar(),
  };
}
