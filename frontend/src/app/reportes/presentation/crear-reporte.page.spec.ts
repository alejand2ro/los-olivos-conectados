import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import { apiCrearReporteHttp } from '../infrastructure/api-crear-reporte-http';
import { apiEvidenciasHttp } from '../infrastructure/api-evidencias-http';
import { ErrorEvidencia } from '../application/subir-evidencia';
import { ErrorCrearReporte } from '../application/crear-reporte-escrito';
import { CrearReportePage } from './crear-reporte.page';

const perfil = {
  id: 8, nombre: 'Vecina de prueba', correo: 'vecina@test.invalid', telefono: null,
  rol: 'vecino', zona_id: 31, alias_chat: 'Usuario-TEST', modo_accesibilidad: false,
};
const catalogos = {
  zonas: [
    { id: 31, nombre: 'Zona de residencia', descripcion: null },
    { id: 74, nombre: 'Otra zona', descripcion: null },
  ],
  roles_publicos: [],
  tipos_incidente: [{ id: 15, nombre: 'Tipo de prueba', icono: null }],
  niveles_gravedad: [{ id: 6, nombre: 'Media', orden: 2, color: null }],
  estados_reporte: [{ id: 5, codigo: 'recibido', nombre: 'Recibido', orden: 1 }],
};
const respuesta = { id: 123, estado_codigo: 'recibido', estado_nombre: 'Recibido', fecha_creacion: '2026-11-15T12:00:00.000Z' };

describe('CrearReportePage', () => {
  const descriptorGeolocalizacion = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  const crearUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revocarUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((file: File) => `blob:${file.name}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(accesoActual, 'perfilValidado').mockReturnValue(perfil);
    vi.spyOn(accesoActual, 'leerToken').mockReturnValue('token-de-prueba');
    vi.spyOn(accesoActual, 'catalogos').mockResolvedValue(catalogos);
    await TestBed.configureTestingModule({
      imports: [CrearReportePage], providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (descriptorGeolocalizacion) Object.defineProperty(navigator, 'geolocation', descriptorGeolocalizacion);
    else Reflect.deleteProperty(navigator, 'geolocation');
    if (crearUrlOriginal) Object.defineProperty(URL, 'createObjectURL', crearUrlOriginal);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revocarUrlOriginal) Object.defineProperty(URL, 'revokeObjectURL', revocarUrlOriginal);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  async function montar() {
    const fixture = TestBed.createComponent(CrearReportePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, pagina: fixture.componentInstance, elemento: fixture.nativeElement as HTMLElement };
  }

  function completar(pagina: CrearReportePage) {
    pagina.formulario.patchValue({
      tipo_incidente_id: '15', nivel_gravedad_id: '6', zona_id: '74',
      descripcion_texto: '  Descripción de prueba  ',
    });
    pagina.cambiarPunto({ latitud: -11.9823, longitud: -77.0645 });
  }

  it('propone la zona real y bloquea campos o coordenadas faltantes o fuera de rango', async () => {
    const crear = vi.spyOn(apiCrearReporteHttp, 'crear').mockResolvedValue(respuesta);
    const { fixture, pagina, elemento } = await montar();
    expect(pagina.formulario.controls.zona_id.value).toBe('31');
    expect([...elemento.querySelectorAll('#reporte-zona option')].map((opcion) => opcion.textContent?.trim())).toEqual([
      'Selecciona una zona', 'Zona de residencia', 'Otra zona',
    ]);
    await pagina.enviar();
    fixture.detectChanges();
    expect(crear).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain('Selecciona un tipo de incidente');
    completar(pagina);
    pagina.cambiarPunto(null);
    await pagina.enviar();
    expect(crear).not.toHaveBeenCalled();
    expect(elemento.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    pagina.cambiarPunto({ latitud: 91, longitud: -77.1 });
    await pagina.enviar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('solo habilita el envío cuando recibe un punto elegido', async () => {
    const { fixture, pagina, elemento } = await montar();
    expect(pagina.formulario.controls.latitud.value).toBe('');
    expect(elemento.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    pagina.cambiarPunto({ latitud: -11.9, longitud: -77.1 });
    fixture.detectChanges();
    expect(pagina.formulario.controls.latitud.value).toBe('-11.9');
    expect(elemento.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
  });

  it('conserva los campos tras error de red, evita duplicados y muestra el ID y estado reales', async () => {
    let resolver!: (valor: typeof respuesta) => void;
    const crear = vi.spyOn(apiCrearReporteHttp, 'crear')
      .mockRejectedValueOnce(new ErrorCrearReporte(0, 'No se pudo conectar con el servidor.'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    const { fixture, pagina, elemento } = await montar();
    completar(pagina);
    await pagina.enviar();
    fixture.detectChanges();
    expect(elemento.textContent).toContain('No se pudo conectar con el servidor.');
    expect(pagina.formulario.controls.descripcion_texto.value).toBe('  Descripción de prueba  ');
    const pendiente = pagina.enviar();
    await pagina.enviar();
    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear).toHaveBeenLastCalledWith('token-de-prueba', {
      tipo_incidente_id: 15, nivel_gravedad_id: 6, zona_id: 74,
      descripcion_texto: 'Descripción de prueba', latitud: -11.9823, longitud: -77.0645,
    });
    resolver(respuesta);
    await pendiente;
    fixture.detectChanges();
    expect(elemento.textContent).toContain('reporte #123');
    expect(elemento.textContent).toContain('Recibido');
    expect(elemento.querySelector('a[href="/mis-reportes"]')).not.toBeNull();
    await pagina.enviar();
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('conserva lo escrito si el token venció y deja de ofrecer el envío', async () => {
    vi.spyOn(apiCrearReporteHttp, 'crear').mockRejectedValue(new ErrorCrearReporte(401, 'Token inválido o vencido'));
    const cerrar = vi.spyOn(accesoActual, 'cerrarSesion').mockImplementation(() => {});
    const { fixture, pagina, elemento } = await montar();
    completar(pagina);
    await pagina.enviar();
    fixture.detectChanges();
    expect(cerrar).toHaveBeenCalledOnce();
    expect(pagina.formulario.controls.descripcion_texto.value).toContain('Descripción de prueba');
    expect(elemento.textContent).toContain('Tu sesión venció');
    expect(elemento.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
  });

  it('permite audio sin texto, espera el 201 antes de anunciar éxito y conserva la alternativa escrita', async () => {
    let resolver!: (valor: typeof respuesta) => void;
    const crearAudio = vi.spyOn(apiCrearReporteHttp, 'crearAudio').mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
    const crearTexto = vi.spyOn(apiCrearReporteHttp, 'crear');
    const { fixture, pagina, elemento } = await montar();
    completar(pagina);
    pagina.formulario.controls.descripcion_texto.setValue('');
    pagina.elegirDescripcion('audio');
    fixture.detectChanges();
    expect(elemento.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    const archivo = new File([new Uint8Array(44)], 'nota-voz.wav', { type: 'audio/wav' });
    pagina.notaVoz.set(archivo);
    fixture.detectChanges();
    const pendiente = pagina.enviar();
    fixture.detectChanges();
    expect(crearAudio).toHaveBeenCalledOnce();
    expect(crearTexto).not.toHaveBeenCalled();
    expect(pagina.creado()).toBeNull();
    resolver(respuesta);
    await pendiente;
    expect(pagina.creado()?.id).toBe(123);
  });

  it('valida selección y permite quitar adjuntos antes de crear el reporte', async () => {
    const { pagina } = await montar();
    pagina.agregarEvidencias([
      new File(['imagen'], 'foto.png', { type: 'image/png' }),
      new File(['video'], 'video.mp4', { type: 'video/mp4' }),
    ]);
    expect(pagina.evidencias().map((item) => item.estado)).toEqual(['seleccionado', 'seleccionado']);
    pagina.agregarEvidencias([new File(['gif'], 'animado.gif', { type: 'image/gif' })]);
    expect(pagina.errorEvidencias()).toContain('JPEG/PNG');
    expect(pagina.evidencias()).toHaveLength(2);
    pagina.agregarEvidencias(Array.from({ length: 4 }, (_, indice) => new File(['foto'], `otra-${indice}.jpg`, { type: 'image/jpeg' })));
    expect(pagina.evidencias().filter((item) => item.tipo === 'foto')).toHaveLength(4);
    expect(pagina.errorEvidencias()).toContain('4 fotografías');
    pagina.agregarEvidencias([new File(['video'], 'otro.mp4', { type: 'video/mp4' })]);
    expect(pagina.evidencias().filter((item) => item.tipo === 'video')).toHaveLength(1);
    const clave = pagina.evidencias()[0].clave;
    pagina.quitarEvidencia(clave);
    expect(pagina.evidencias()).toHaveLength(4);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto.png');
  });

  it('crea el reporte una vez, marca guardados solo tras 201 y reintenta solo fallidos', async () => {
    const crear = vi.spyOn(apiCrearReporteHttp, 'crear').mockResolvedValue(respuesta);
    let confirmarPrimera!: (valor: { id: number; reporte_id: number; tipo_archivo: 'foto'; url_archivo: string }) => void;
    const subir = vi.spyOn(apiEvidenciasHttp, 'subir')
      .mockImplementationOnce(() => new Promise((resolve) => { confirmarPrimera = resolve; }))
      .mockRejectedValueOnce(new ErrorEvidencia(500, 'Falló el video'))
      .mockResolvedValueOnce({ id: 202, reporte_id: 123, tipo_archivo: 'video', url_archivo: '/reportes/123/evidencias/202/archivo' });
    const { fixture, pagina, elemento } = await montar();
    completar(pagina);
    pagina.agregarEvidencias([
      new File(['foto'], 'foto.png', { type: 'image/png' }),
      new File(['video'], 'video.mp4', { type: 'video/mp4' }),
    ]);
    const claves = pagina.evidencias().map((item) => item.clave);
    const pendiente = pagina.enviar();
    await Promise.resolve(); await Promise.resolve();
    fixture.detectChanges();
    expect(crear).toHaveBeenCalledOnce();
    expect(pagina.creado()?.id).toBe(123);
    expect(pagina.evidencias()[0].estado).toBe('subiendo');
    expect(elemento.textContent).not.toContain('Guardado · evidencia');
    confirmarPrimera({ id: 201, reporte_id: 123, tipo_archivo: 'foto', url_archivo: '/reportes/123/evidencias/201/archivo' });
    await pendiente;
    fixture.detectChanges();
    expect(pagina.evidencias().map((item) => item.estado)).toEqual(['guardado', 'fallido']);
    expect(elemento.textContent).toContain('Guardado · evidencia #201');
    expect(elemento.textContent).toContain('Fallido');
    await pagina.reintentarEvidencias();
    expect(crear).toHaveBeenCalledOnce();
    expect(subir).toHaveBeenCalledTimes(3);
    expect(subir.mock.calls.map((llamada) => llamada[3])).toEqual([claves[0], claves[1], claves[1]]);
    expect(pagina.evidencias().map((item) => item.estado)).toEqual(['guardado', 'guardado']);
  });
});
