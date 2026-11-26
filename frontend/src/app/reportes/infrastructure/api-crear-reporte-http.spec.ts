import { apiCrearReporteHttp } from './api-crear-reporte-http';
import { ErrorCrearReporte } from '../application/crear-reporte-escrito';

describe('POST /reportes escrito', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envía únicamente JSON escrito con Bearer y devuelve el 201 real', async () => {
    const creado = { id: 81, estado_codigo: 'recibido', estado_nombre: 'Recibido', fecha_creacion: '2026-11-15T12:00:00.000Z' };
    const enviar = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => creado });
    vi.stubGlobal('fetch', enviar);
    const datos = { tipo_incidente_id: 5, nivel_gravedad_id: 8, zona_id: 3, descripcion_texto: 'Texto real', latitud: -11.9, longitud: -77.1 };
    expect(await apiCrearReporteHttp.crear('token-de-prueba', datos)).toEqual(creado);
    expect(enviar).toHaveBeenCalledOnce();
    const [url, opciones] = enviar.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/reportes$/);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token-de-prueba', 'Content-Type': 'application/json' });
    expect(JSON.parse(opciones.body as string)).toEqual(datos);
    expect(JSON.parse(opciones.body as string)).not.toHaveProperty('usuario_id');
  });

  it('distingue error de red y token vencido', async () => {
    const datos = { tipo_incidente_id: 5, nivel_gravedad_id: 8, zona_id: 3, descripcion_texto: 'Texto', latitud: -11.9, longitud: -77.1 };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    await expect(apiCrearReporteHttp.crear('token', datos)).rejects.toMatchObject({ estado: 0 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Token inválido o vencido' }) }));
    await expect(apiCrearReporteHttp.crear('token', datos)).rejects.toBeInstanceOf(ErrorCrearReporte);
    await expect(apiCrearReporteHttp.crear('token', datos)).rejects.toMatchObject({ estado: 401 });
  });

  it('envía audio multipart sin fijar Content-Type ni aceptar URL del cliente', async () => {
    const creado = { id: 92, estado_codigo: 'recibido', estado_nombre: 'Recibido', fecha_creacion: '2026-11-15T12:00:00.000Z' };
    const enviar = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => creado });
    vi.stubGlobal('fetch', enviar);
    const archivo = new File([new Uint8Array(44)], 'nota-voz.wav', { type: 'audio/wav' });
    const datos = { tipo_incidente_id: 5, nivel_gravedad_id: 8, zona_id: 3, latitud: -11.9, longitud: -77.1 };
    expect(await apiCrearReporteHttp.crearAudio('token-de-prueba', datos, archivo)).toEqual(creado);
    const [, opciones] = enviar.mock.calls[0] as [string, RequestInit];
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token-de-prueba' });
    const cuerpo = opciones.body as FormData;
    expect(cuerpo.get('archivo_descripcion_audio')).toBe(archivo);
    expect(cuerpo.get('latitud')).toBe('-11.9');
    expect(cuerpo.has('descripcion_audio_url')).toBe(false);
    expect(cuerpo.has('usuario_id')).toBe(false);
  });
});
