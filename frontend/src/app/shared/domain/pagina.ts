export interface Pagina<T> {
  resultados: T[];
  pagina: number;
  tamano_pagina: number;
  total: number;
  total_paginas: number;
}
