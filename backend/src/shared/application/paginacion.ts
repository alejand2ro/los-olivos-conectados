export interface Paginacion {
    pagina: number;
    tamano_pagina: number;
    total: number;
    total_paginas: number;
}

export const TAMANO_PAGINA = 20;

export class ParametroPaginacionInvalido extends Error {}

export function leerPagina(valor: string | null): number {
    if (valor === null) return 1;
    if (!/^[1-9]\d*$/.test(valor)) throw new ParametroPaginacionInvalido();
    const pagina = Number(valor);
    if (!Number.isSafeInteger(pagina) || pagina > 1000000) throw new ParametroPaginacionInvalido();
    return pagina;
}

export function paginacion(pagina: number, total: number): Paginacion {
    return { pagina, tamano_pagina: TAMANO_PAGINA, total, total_paginas: Math.ceil(total / TAMANO_PAGINA) };
}
