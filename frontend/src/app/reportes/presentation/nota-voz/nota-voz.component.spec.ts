import { TestBed } from '@angular/core/testing';
import { NotaVozComponent, PREPARAR_NOTA_VOZ } from './nota-voz.component';

class GrabadoraFalsa {
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((evento: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_flujo: MediaStream) {}
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio']) } as BlobEvent);
    this.onstop?.();
  }
}

describe('NotaVozComponent', () => {
  const preparar = vi.fn();
  const mediaOriginal = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const crearUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revocarUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  beforeEach(async () => {
    vi.stubGlobal('MediaRecorder', GrabadoraFalsa);
    vi.stubGlobal('AudioContext', class {});
    vi.stubGlobal('OfflineAudioContext', class {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:prueba') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    preparar.mockReset();
    await TestBed.configureTestingModule({ imports: [NotaVozComponent], providers: [{ provide: PREPARAR_NOTA_VOZ, useValue: preparar }] }).compileComponents();
  });
  afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    if (mediaOriginal) Object.defineProperty(navigator, 'mediaDevices', mediaOriginal);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
    if (crearUrlOriginal) Object.defineProperty(URL, 'createObjectURL', crearUrlOriginal);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revocarUrlOriginal) Object.defineProperty(URL, 'revokeObjectURL', revocarUrlOriginal);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  function montar() {
    const fixture = TestBed.createComponent(NotaVozComponent);
    fixture.detectChanges();
    return { fixture, componente: fixture.componentInstance };
  }

  it('solicita el micrófono solo al pulsar, permite escuchar y borrar antes de enviar', async () => {
    const detenerPista = vi.fn();
    const permiso = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: detenerPista }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: permiso } });
    const archivo = new File(['wav'], 'nota-voz.wav', { type: 'audio/wav' });
    preparar.mockResolvedValue(archivo);
    const { fixture, componente } = montar();
    const cambios = vi.fn(); componente.audioCambiado.subscribe(cambios);
    expect(permiso).not.toHaveBeenCalled();
    await componente.iniciar();
    expect(permiso).toHaveBeenCalledWith({ audio: true, video: false });
    expect(componente.grabando()).toBe(true);
    componente.detener();
    await fixture.whenStable(); fixture.detectChanges();
    expect(detenerPista).toHaveBeenCalled();
    expect(componente.archivo()).toBe(archivo);
    expect(fixture.nativeElement.querySelector('audio')).not.toBeNull();
    expect(cambios).toHaveBeenLastCalledWith(archivo);
    componente.borrar();
    expect(cambios).toHaveBeenLastCalledWith(null);
    expect(componente.archivo()).toBeNull();
    fixture.destroy();
  });

  it('si se niega el permiso informa la alternativa escrita y no crea archivo', async () => {
    const permiso = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: permiso } });
    const { fixture, componente } = montar();
    await componente.iniciar(); fixture.detectChanges();
    expect(componente.error()).toContain('Puedes escribir');
    expect(componente.archivo()).toBeNull();
    expect(preparar).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
