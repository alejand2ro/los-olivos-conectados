import { prepararNotaVoz } from './preparar-nota-voz';

describe('prepararNotaVoz', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('produce WAV PCM mono de 16 kHz con duración calculable desde sus muestras', async () => {
    const muestras = new Float32Array(16000);
    muestras.fill(0.25);
    const cerrar = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext', class {
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 1, getChannelData: () => muestras });
      close = cerrar;
    });
    vi.stubGlobal('OfflineAudioContext', class {
      destination = {};
      createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: vi.fn() });
      startRendering = vi.fn().mockResolvedValue({ getChannelData: () => muestras });
    });
    const archivo = await prepararNotaVoz(new Blob(['grabación de prueba']));
    const bytes = new DataView(await archivo.arrayBuffer());
    expect(archivo.type).toBe('audio/wav');
    expect(archivo.size).toBe(44 + 16000 * 2);
    expect(String.fromCharCode(...new Uint8Array(bytes.buffer, 0, 4))).toBe('RIFF');
    expect(bytes.getUint16(20, true)).toBe(1);
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(16000);
    expect(bytes.getUint16(34, true)).toBe(16);
    expect(bytes.getUint32(40, true)).toBe(32000);
    expect(cerrar).toHaveBeenCalledOnce();
  });
});
