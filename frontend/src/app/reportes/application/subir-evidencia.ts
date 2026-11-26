import type { EvidenciaGuardada, TipoEvidencia } from '../domain/evidencia';

export class ErrorEvidencia extends Error {
  constructor(readonly estado: number, mensaje: string) { super(mensaje); }
}

export interface ApiEvidencias {
  subir(token: string, reporteId: number, tipo: TipoEvidencia, clave: string, archivo: File): Promise<EvidenciaGuardada>;
}

export function subirEvidencia(api: ApiEvidencias) {
  return (token: string, reporteId: number, tipo: TipoEvidencia, clave: string, archivo: File) =>
    api.subir(token, reporteId, tipo, clave, archivo);
}
