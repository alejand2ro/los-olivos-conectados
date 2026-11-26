import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import { apiReportesHttp } from '../infrastructure/api-reportes-http';
import type { Pagina } from '../../shared/domain/pagina';
import type { ResumenReporte } from '../domain/resumen-reporte';
import { MisReportesPage } from './mis-reportes.page';

const perfil = {
  id: 5, nombre: 'Vecina de prueba', correo: 'vecina@test.invalid', telefono: null,
  rol: 'vecino', zona_id: 12, alias_chat: 'Usuario-TEST', modo_accesibilidad: false,
};

describe('MisReportesPage', () => {
  beforeEach(async () => {
    vi.spyOn(accesoActual, 'leerToken').mockReturnValue('token-de-prueba');
    vi.spyOn(accesoActual, 'restaurarSesion').mockResolvedValue(perfil);
    vi.spyOn(accesoActual, 'perfilValidado').mockReturnValue(perfil);
    vi.spyOn(accesoActual, 'catalogos').mockResolvedValue({
      zonas: [{ id: 12, nombre: 'Zona de prueba', descripcion: null }], roles_publicos: [],
      tipos_incidente: [], niveles_gravedad: [], estados_reporte: [],
    });
    await TestBed.configureTestingModule({
      imports: [MisReportesPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('muestra carga y después la lista vacía recibida de la API', async () => {
    let resolver!: (pagina: Pagina<ResumenReporte>) => void;
    vi.spyOn(apiReportesHttp, 'listar').mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const fixture = TestBed.createComponent(MisReportesPage);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando tus reportes');

    resolver({ resultados: [], pagina: 1, tamano_pagina: 20, total: 0, total_paginas: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aún no tienes reportes');
  });

  it('muestra error cuando falla la consulta', async () => {
    vi.spyOn(apiReportesHttp, 'listar').mockRejectedValue(new Error('sin conexión'));
    const fixture = TestBed.createComponent(MisReportesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudieron cargar tus reportes');
  });
});
