import { TestBed } from '@angular/core/testing';
import { SelectorUbicacionComponent } from './selector-ubicacion.component';

const fake = vi.hoisted(() => ({
  mapa: null as any,
  capa: null as any,
  marcador: null as any,
  fallaInicio: false,
}));

vi.mock('leaflet', () => ({
  map: () => {
    if (fake.fallaInicio) throw new Error('mapa no disponible');
    const handlers: Record<string, (evento: any) => void> = {};
    fake.mapa = {
      on: vi.fn((nombre: string, callback: (evento: any) => void) => { handlers[nombre] = callback; return fake.mapa; }),
      off: vi.fn(), remove: vi.fn(), invalidateSize: vi.fn(),
      setView: vi.fn(), getZoom: vi.fn(() => 12),
      emitir: (nombre: string, evento: any) => handlers[nombre]?.(evento),
    };
    return fake.mapa;
  },
  tileLayer: () => {
    const handlers: Record<string, () => void> = {};
    fake.capa = {
      on: vi.fn((nombre: string, callback: () => void) => { handlers[nombre] = callback; return fake.capa; }),
      off: vi.fn(), addTo: vi.fn(), emitir: (nombre: string) => handlers[nombre]?.(),
    };
    return fake.capa;
  },
  marker: (posicion: { lat: number; lng: number }) => {
    const handlers: Record<string, () => void> = {};
    fake.marcador = {
      posicion,
      addTo: vi.fn(() => fake.marcador),
      on: vi.fn((nombre: string, callback: () => void) => { handlers[nombre] = callback; return fake.marcador; }),
      off: vi.fn(), remove: vi.fn(),
      setLatLng: vi.fn((nuevo: { lat: number; lng: number }) => { fake.marcador.posicion = nuevo; }),
      getLatLng: vi.fn(() => fake.marcador.posicion),
      emitir: (nombre: string) => handlers[nombre]?.(),
    };
    return fake.marcador;
  },
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  divIcon: () => ({}),
}));

describe('SelectorUbicacionComponent', () => {
  const descriptorGPS = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  beforeEach(async () => {
    fake.fallaInicio = false;
    fake.mapa = fake.capa = fake.marcador = null;
    await TestBed.configureTestingModule({ imports: [SelectorUbicacionComponent] }).compileComponents();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (descriptorGPS) Object.defineProperty(navigator, 'geolocation', descriptorGPS);
    else Reflect.deleteProperty(navigator, 'geolocation');
  });

  function montar() {
    const fixture = TestBed.createComponent(SelectorUbicacionComponent);
    fixture.detectChanges();
    return { fixture, componente: fixture.componentInstance, elemento: fixture.nativeElement as HTMLElement };
  }

  it('no elige el centro ni el movimiento del mapa; el toque y el arrastre actualizan el marcador', () => {
    const { fixture, componente } = montar();
    const cambios = vi.fn();
    componente.puntoCambiado.subscribe(cambios);
    expect(componente.punto()).toBeNull();
    fake.mapa.emitir('moveend', {});
    expect(cambios).not.toHaveBeenCalled();
    fake.mapa.emitir('click', { latlng: { lat: -11.91, lng: -77.01 } });
    expect(cambios).toHaveBeenLastCalledWith({ latitud: -11.91, longitud: -77.01 });
    expect(fake.marcador).not.toBeNull();
    fake.marcador.posicion = { lat: -11.92, lng: -77.02 };
    fake.marcador.emitir('dragend');
    expect(cambios).toHaveBeenLastCalledWith({ latitud: -11.92, longitud: -77.02 });
    fixture.destroy();
    expect(fake.mapa.remove).toHaveBeenCalledOnce();
    expect(fake.mapa.off).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('pide GPS solo al pulsar y muestra precisión sin impedir cambiar el punto', () => {
    const obtener = vi.fn((exito: PositionCallback) => exito({ coords: { latitude: -11.95, longitude: -77.04, accuracy: 24 } } as GeolocationPosition));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: obtener } });
    const { fixture, componente } = montar();
    expect(obtener).not.toHaveBeenCalled();
    componente.usarUbicacionActual();
    fixture.detectChanges();
    expect(obtener).toHaveBeenCalledOnce();
    expect(componente.punto()).toEqual({ latitud: -11.95, longitud: -77.04 });
    expect(fake.mapa.setView).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('24 m');
    fake.mapa.emitir('click', { latlng: { lat: -11.96, lng: -77.05 } });
    expect(componente.precisionMetros()).toBeNull();
    fixture.destroy();
  });

  it('sin permiso conserva el mapa y permite introducir coordenadas manuales válidas', () => {
    const obtener = vi.fn((_: PositionCallback, error: PositionErrorCallback) => error({ code: 1 } as GeolocationPositionError));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: obtener } });
    const { fixture, componente } = montar();
    componente.usarUbicacionActual();
    expect(componente.errorUbicacion()).toContain('denegó');
    expect(fake.mapa.remove).not.toHaveBeenCalled();
    componente.alternarManual();
    componente.manual.patchValue({ latitud: '-11.90', longitud: '-77.00' });
    componente.cambiarManual();
    expect(componente.punto()).toEqual({ latitud: -11.9, longitud: -77 });
    expect(fake.marcador.posicion).toEqual({ lat: -11.9, lng: -77 });
    componente.manual.controls.latitud.setValue('91');
    componente.cambiarManual();
    expect(componente.punto()).toBeNull();
    fixture.destroy();
  });

  it('si falla el mapa presenta un error y abre la alternativa manual', () => {
    fake.fallaInicio = true;
    const { fixture, componente } = montar();
    expect(componente.errorMapa()).toContain('No se pudo cargar el mapa');
    expect(componente.manualAbierto()).toBe(true);
    componente.manual.patchValue({ latitud: '-11.9', longitud: '-77.1' });
    componente.cambiarManual();
    expect(componente.punto()).toEqual({ latitud: -11.9, longitud: -77.1 });
    fixture.destroy();
  });

  it('si falla la descarga de mapas mantiene disponibles las coordenadas manuales', () => {
    const { fixture, componente } = montar();
    fake.capa.emitir('tileerror');
    expect(componente.errorMapa()).toContain('No se pudo cargar el mapa');
    expect(componente.manualAbierto()).toBe(true);
    componente.manual.patchValue({ latitud: '-11.9', longitud: '-77.1' });
    componente.cambiarManual();
    expect(componente.punto()).toEqual({ latitud: -11.9, longitud: -77.1 });
    fixture.destroy();
  });
});
