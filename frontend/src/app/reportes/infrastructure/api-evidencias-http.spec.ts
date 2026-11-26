import { apiEvidenciasHttp } from './api-evidencias-http';

describe('POST /reportes/:id/evidencias', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envía una clave estable y el archivo con Bearer sin declarar Content-Type multipart manualmente', async () => {
    const respuesta = { id: 8, reporte_id: 42, tipo_archivo: 'foto', url_archivo: '/reportes/42/evidencias/8/archivo' };
    const enviar = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => respuesta });
    vi.stubGlobal('fetch', enviar);
    const archivo = new File(['foto'], 'foto.png', { type: 'image/png' });
    const clave = 'f89c73c5-26aa-4aeb-a0f2-60a2e82f25ec';
    expect(await apiEvidenciasHttp.subir('token', 42, 'foto', clave, archivo)).toEqual(respuesta);
    const [url, opciones] = enviar.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/reportes\/42\/evidencias$/);
    expect(opciones.headers).toEqual({ Authorization: 'Bearer token' });
    const cuerpo = opciones.body as FormData;
    expect(cuerpo.get('archivo')).toBe(archivo);
    expect(cuerpo.get('tipo_archivo')).toBe('foto');
    expect(cuerpo.get('clave_carga')).toBe(clave);
  });
});
