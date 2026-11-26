export interface NuevaAutoridad {
  nombre: string;
  correo: string;
  contrasena: string;
}

export interface AutoridadCreada {
  id: number;
  nombre: string;
  correo: string;
  alias_chat: null;
  rol: 'autoridad';
  zona_id: null;
}
