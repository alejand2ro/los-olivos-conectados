import { TestBed } from '@angular/core/testing';
import { MapaReporteComponent } from './mapa-reporte.component';

const fake = vi.hoisted(() => ({
  mapa: null as any, capa: null as any, marcador: null as any, fallaInicio: false,
}));

vi.mock('leaflet', () => ({
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  divIcon: () => ({}),
  map: () => {
    if (fake.fallaInicio) throw new Error('mapa no disponible');
    fake.mapa = { remove: vi.fn(), invalidateSize: vi.fn(), on: vi.fn(), off: vi.fn() };
    return fake.mapa;
  },
  tileLayer: () => {
    const eventos: Record<string, () => void> = {};
    fake.capa = { on: vi.fn((nombre: string, callback: () => void) => { eventos[nombre] = callback; }),
      off: vi.fn(), addTo: vi.fn(), emitir: (nombre: string) => eventos[nombre]?.() };
    return fake.capa;
  },
  marker: (_: unknown, opciones: Record<string, unknown>) => {
    fake.marcador = { opciones, addTo: vi.fn() };
    return fake.marcador;
  },
}));

describe('MapaReporteComponent', () => {
  beforeEach(async () => {
    fake.fallaInicio = false;
    fake.mapa = fake.capa = fake.marcador = null;
    await TestBed.configureTestingModule({ imports: [MapaReporteComponent] }).compileComponents();
  });
  afterEach(() => vi.restoreAllMocks());

  function montar() {
    const fixture = TestBed.createComponent(MapaReporteComponent);
    fixture.componentRef.setInput('latitud', -11.9823);
    fixture.componentRef.setInput('longitud', -77.0645);
    fixture.detectChanges();
    return fixture;
  }

  it('marca la coordenada del reporte sin permitir arrastre y limpia Leaflet al salir', () => {
    const fixture = montar();
    expect(fake.marcador.opciones.draggable).toBe(false);
    expect(fake.marcador.opciones.interactive).toBe(false);
    expect(fake.mapa.on).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.mapa')?.getAttribute('aria-label'))
      .toContain('latitud -11.9823, longitud -77.0645');
    fixture.destroy();
    expect(fake.mapa.remove).toHaveBeenCalledOnce();
    expect(fake.capa.off).toHaveBeenCalledWith('load', expect.any(Function));
    expect(fake.capa.off).toHaveBeenCalledWith('tileerror', expect.any(Function));
  });

  it('muestra un aviso si fallan los mosaicos o la creación del mapa', () => {
    const fixture = montar();
    fake.capa.emitir('tileerror');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudo cargar el mapa');
    fixture.destroy();
    fake.fallaInicio = true;
    const fallido = montar();
    expect(fallido.componentInstance.error()).toContain('No se pudo mostrar el mapa');
    fallido.destroy();
  });
});
