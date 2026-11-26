import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import { apiDetalleReporteHttp } from '../infrastructure/api-detalle-reporte-http';
import { apiEvidenciasHttp } from '../infrastructure/api-evidencias-http';
import { DetalleReportePage } from './detalle-reporte.page';

const perfil = { id: 5, nombre: 'Persona de prueba', correo: 'persona@test.invalid', telefono: null,
  rol: 'vecino', zona_id: 12, alias_chat: 'Usuario-TEST', modo_accesibilidad: false };
const reporte = { id: 42, tipo_incidente: 'Robo', zona_id: 12, zona_nombre: 'Zona de prueba',
  descripcion_texto: 'Descripción real', descripcion_audio_url: null, latitud: -11.98, longitud: -77.06,
  nivel_gravedad: 'Media', estado_codigo: 'recibido', estado_nombre: 'Recibido', verificado: false,
  es_sos: false, fecha_creacion: '2026-11-15T20:00:00.000Z', evidencias: [] };

describe('DetalleReportePage', () => {
  beforeEach(async () => {
    vi.spyOn(accesoActual, 'leerToken').mockReturnValue('token-de-prueba');
    vi.spyOn(accesoActual, 'perfilValidado').mockReturnValue(perfil);
    vi.spyOn(accesoActual, 'catalogos').mockResolvedValue({ zonas: [{ id: 12, nombre: 'Zona de prueba', descripcion: null }],
      roles_publicos: [], tipos_incidente: [], niveles_gravedad: [], estados_reporte: [] });
    vi.spyOn(apiDetalleReporteHttp, 'detalle').mockResolvedValue(reporte);
    vi.spyOn(apiDetalleReporteHttp, 'seguimiento').mockResolvedValue({ estado_codigo: 'recibido', estado_nombre: 'Recibido',
      historial: [{ estado_codigo: 'recibido', estado_nombre: 'Recibido', fecha: reporte.fecha_creacion, comentario: null }] });
    await TestBed.configureTestingModule({
      imports: [DetalleReportePage], providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '42' } } } }],
    }).compileComponents();
  });
  afterEach(() => vi.restoreAllMocks());

  it('muestra solo el estado inicial real y sube un adjunto al mismo reporte', async () => {
    const subir = vi.spyOn(apiEvidenciasHttp, 'subir').mockResolvedValue({ id: 8, reporte_id: 42,
      tipo_archivo: 'foto', url_archivo: '/reportes/42/evidencias/8/archivo' });
    const fixture = TestBed.createComponent(DetalleReportePage);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    await vi.waitFor(() => expect(pagina.cargando()).toBe(false));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Recibido');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Patrulla');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    pagina.agregar([new File(['foto'], 'foto.png', { type: 'image/png' })]);
    await pagina.subirAdjuntos();
    expect(subir).toHaveBeenCalledOnce();
    expect(subir.mock.calls[0][1]).toBe(42);
    fixture.destroy();
  });

  it('carga una miniatura privada, abre el visor y revoca el recurso al salir', async () => {
    const ruta = '/reportes/42/evidencias/8/archivo';
    vi.mocked(apiDetalleReporteHttp.detalle).mockResolvedValue({ ...reporte, evidencias: [
      { id: 8, tipo_archivo: 'foto', url_archivo: ruta, fecha_subida: reporte.fecha_creacion },
    ] });
    const archivo = vi.spyOn(apiDetalleReporteHttp, 'archivo').mockResolvedValue(new Blob(['foto'], { type: 'image/png' }));
    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto-protegida');
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const mostrar = vi.fn();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: mostrar });
    const fixture = TestBed.createComponent(DetalleReportePage);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.archivos()[ruta]).toBe('blob:foto-protegida'));
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.thumbnail-button');
    expect(boton?.querySelector('img')?.getAttribute('src')).toBe('blob:foto-protegida');
    boton?.click();
    expect(mostrar).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.fotoAmpliada()?.id).toBe(8);
    expect(archivo.mock.calls[0][0]).toBe('token-de-prueba');
    expect(archivo.mock.calls[0][1]).toBe(ruta);
    const cancelacion = archivo.mock.calls[0][2];
    fixture.destroy();
    expect(cancelacion?.aborted).toBe(true);
    expect(crearUrl).toHaveBeenCalledOnce();
    expect(revocar).toHaveBeenCalledWith('blob:foto-protegida');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
});
