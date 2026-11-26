import { apiDetalleReporteHttp } from './api-detalle-reporte-http';

describe('API del detalle privado', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adjunta el JWT como encabezado al leer audio y evidencias, nunca en la URL', async () => {
    const solicitudes: { url: string; opciones: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opciones: RequestInit) => {
      solicitudes.push({ url, opciones });
      return new Response(new Blob(['contenido']), { status: 200 });
    }));
    await apiDetalleReporteHttp.archivo('token-de-prueba', '/reportes/42/audio');
    await apiDetalleReporteHttp.archivo('token-de-prueba', '/reportes/42/evidencias/8/archivo');
    expect(solicitudes).toHaveLength(2);
    for (const solicitud of solicitudes) {
      expect(solicitud.url).not.toContain('token-de-prueba');
      expect((solicitud.opciones.headers as Record<string, string>)['Authorization']).toBe('Bearer token-de-prueba');
    }
  });

  it('rechaza referencias ajenas al API de archivos privados', async () => {
    const solicitud = vi.fn();
    vi.stubGlobal('fetch', solicitud);
    await expect(apiDetalleReporteHttp.archivo('token', 'https://otro.example/archivo')).rejects.toThrow();
    expect(solicitud).not.toHaveBeenCalled();
  });
});
