import type { Catalogos } from '../domain/catalogos';

export interface RepositorioCatalogos {
    listar(): Promise<Catalogos>;
}

export type ObtenerCatalogos = () => Promise<Catalogos>;

export function crearObtenerCatalogos(
    repositorio: RepositorioCatalogos,
): ObtenerCatalogos {
    return () => repositorio.listar();
}
