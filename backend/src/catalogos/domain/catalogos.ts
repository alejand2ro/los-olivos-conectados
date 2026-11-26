export type Zona = {
    id: number;
    nombre: string;
    descripcion: string | null;
};

export type RolPublico = {
    id: number;
    nombre: string;
};

export type TipoIncidente = {
    id: number;
    nombre: string;
    icono: string | null;
};

export type NivelGravedad = {
    id: number;
    nombre: string;
    orden: number;
    color: string | null;
};

export type EstadoReporte = {
    id: number;
    codigo: string;
    nombre: string;
    orden: number;
};

export type Catalogos = {
    zonas: Zona[];
    roles_publicos: RolPublico[];
    tipos_incidente: TipoIncidente[];
    niveles_gravedad: NivelGravedad[];
    estados_reporte: EstadoReporte[];
};
