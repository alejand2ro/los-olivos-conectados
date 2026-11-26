export interface ZonaRegistro {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface RolRegistro {
  id: number;
  nombre: 'vecino' | 'comerciante';
}

export interface CatalogosRegistro {
  zonas: ZonaRegistro[];
  roles_publicos: RolRegistro[];
  tipos_incidente: { id: number; nombre: string; icono: string | null }[];
  niveles_gravedad: { id: number; nombre: string; orden: number; color: string | null }[];
  estados_reporte: { id: number; codigo: string; nombre: string; orden: number }[];
}

export interface Credenciales {
  correo: string;
  contrasena: string;
}

export interface DatosRegistro extends Credenciales {
  nombre: string;
  rol: RolRegistro['nombre'];
  zona_id: number;
  telefono?: string;
  modo_accesibilidad: boolean;
  consentimiento_privacidad_aceptado: true;
  compromiso_sos_aceptado: true;
}

export interface UsuarioSesion {
  id: number;
  nombre: string;
  rol: string;
  zona_id: number | null;
}

export interface PerfilPropio extends UsuarioSesion {
  correo: string;
  telefono: string | null;
  alias_chat: string | null;
  modo_accesibilidad: boolean;
}

export interface UsuarioRegistrado {
  id: number;
  nombre: string;
  correo: string;
  alias_chat: string;
  rol: RolRegistro['nombre'];
  zona_id: number;
}
