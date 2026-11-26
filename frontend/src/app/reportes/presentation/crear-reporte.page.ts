import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { CatalogosRegistro, PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import { crearReporteConAudio, crearReporteEscrito, ErrorCrearReporte } from '../application/crear-reporte-escrito';
import { apiCrearReporteHttp } from '../infrastructure/api-crear-reporte-http';
import type { ReporteCreado } from '../domain/reporte-escrito';
import { SelectorUbicacionComponent, type PuntoIncidente } from './selector-ubicacion/selector-ubicacion.component';
import { NotaVozComponent } from './nota-voz/nota-voz.component';
import { AdjuntosEvidenciaComponent } from './adjuntos-evidencia/adjuntos-evidencia.component';
import { MAX_FOTOS, MAX_VIDEOS, MAX_FOTO_BYTES, MAX_VIDEO_BYTES, type EvidenciaLocal, type TipoEvidencia } from '../domain/evidencia';
import { ErrorEvidencia, subirEvidencia } from '../application/subir-evidencia';
import { apiEvidenciasHttp } from '../infrastructure/api-evidencias-http';
import { claveCarga } from '../infrastructure/clave-carga';

const textoRequerido: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

function coordenada(minimo: number, maximo: number): ValidatorFn {
  return (control) => {
    const valor = String(control.value ?? '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor)) return { coordenada: true };
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? null : { coordenada: true };
  };
}

@Component({
  selector: 'app-crear-reporte',
  imports: [IonContent, ReactiveFormsModule, RouterLink, SiteHeaderComponent, SelectorUbicacionComponent, NotaVozComponent, AdjuntosEvidenciaComponent],
  templateUrl: './crear-reporte.page.html',
  styleUrl: './crear-reporte.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearReportePage implements OnInit, OnDestroy {
  private readonly crear = crearReporteEscrito(apiCrearReporteHttp);
  private readonly crearAudio = crearReporteConAudio(apiCrearReporteHttp);
  private readonly subirArchivo = subirEvidencia(apiEvidenciasHttp);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly zonaNombre = signal<string | null>(null);
  readonly catalogos = signal<CatalogosRegistro | null>(null);
  readonly cargandoCatalogos = signal(true);
  readonly errorCatalogos = signal('');
  readonly puntoSeleccionado = signal<PuntoIncidente | null>(null);
  readonly modoDescripcion = signal<'texto' | 'audio'>('texto');
  readonly notaVoz = signal<File | null>(null);
  readonly enviando = signal(false);
  readonly errorEnvio = signal('');
  readonly creado = signal<ReporteCreado | null>(null);
  readonly evidencias = signal<EvidenciaLocal[]>([]);
  readonly errorEvidencias = signal('');

  readonly formulario = new FormGroup({
    tipo_incidente_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nivel_gravedad_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    zona_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descripcion_texto: new FormControl('', { nonNullable: true, validators: [textoRequerido] }),
    latitud: new FormControl('', { nonNullable: true, validators: [coordenada(-90, 90)] }),
    longitud: new FormControl('', { nonNullable: true, validators: [coordenada(-180, 180)] }),
  });

  ngOnInit(): void { void this.cargarCatalogos(); }

  async cargarCatalogos(): Promise<void> {
    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set('');
    try {
      const catalogos = await accesoActual.catalogos();
      this.catalogos.set(catalogos);
      const perfil = this.perfil();
      if (perfil?.zona_id !== null && perfil?.zona_id !== undefined) {
        const zona = catalogos.zonas.find((item) => item.id === perfil.zona_id);
        this.zonaNombre.set(zona?.nombre ?? null);
        if (zona && !this.formulario.controls.zona_id.value) {
          this.formulario.controls.zona_id.setValue(String(zona.id));
        }
      }
      if (!catalogos.tipos_incidente?.length || !catalogos.niveles_gravedad?.length || !catalogos.zonas?.length) {
        this.errorCatalogos.set('No hay tipos, niveles de gravedad o zonas disponibles para crear un reporte.');
      }
    } catch {
      this.errorCatalogos.set('No se pudieron cargar los catálogos. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      this.cargandoCatalogos.set(false);
    }
  }

  cambiarPunto(punto: PuntoIncidente | null): void {
    if (punto && (!Number.isFinite(punto.latitud) || punto.latitud < -90 || punto.latitud > 90 ||
      !Number.isFinite(punto.longitud) || punto.longitud < -180 || punto.longitud > 180)) punto = null;
    this.puntoSeleccionado.set(punto);
    this.formulario.patchValue({
      latitud: punto ? String(punto.latitud) : '',
      longitud: punto ? String(punto.longitud) : '',
    });
  }

  elegirDescripcion(modo: 'texto' | 'audio'): void {
    if (this.enviando() || this.modoDescripcion() === modo) return;
    this.modoDescripcion.set(modo);
    if (modo === 'texto') {
      this.notaVoz.set(null);
      this.formulario.controls.descripcion_texto.setValidators(textoRequerido);
    } else {
      this.formulario.controls.descripcion_texto.clearValidators();
    }
    this.formulario.controls.descripcion_texto.updateValueAndValidity();
  }

  agregarEvidencias(archivos: File[]): void {
    if (this.enviando() || this.creado()) return;
    this.errorEvidencias.set('');
    const nuevas = [...this.evidencias()];
    for (const archivo of archivos) {
      const extension = archivo.name.split('.').pop()?.toLowerCase();
      const tipo: TipoEvidencia | null = archivo.type === 'image/jpeg' || archivo.type === 'image/png' ||
        (!archivo.type && (extension === 'jpg' || extension === 'jpeg' || extension === 'png')) ? 'foto' :
        archivo.type === 'video/mp4' || (!archivo.type && extension === 'mp4') ? 'video' : null;
      if (!tipo) { this.errorEvidencias.set('Solo se admiten fotografías JPEG/PNG o videos MP4.'); continue; }
      if (archivo.size === 0 || archivo.size > (tipo === 'foto' ? MAX_FOTO_BYTES : MAX_VIDEO_BYTES)) {
        this.errorEvidencias.set(tipo === 'foto' ? 'Cada fotografía debe ocupar entre 1 byte y 5 MiB.' : 'Cada video debe ocupar entre 1 byte y 20 MiB.');
        continue;
      }
      if (nuevas.filter((item) => item.tipo === tipo).length >= (tipo === 'foto' ? MAX_FOTOS : MAX_VIDEOS)) {
        this.errorEvidencias.set('Se permiten hasta 4 fotografías y 1 video por reporte.');
        continue;
      }
      let vistaPrevia = '';
      try { vistaPrevia = URL.createObjectURL(archivo); } catch { /* la selección sigue disponible sin vista previa */ }
      try { nuevas.push({ clave: claveCarga(), archivo, tipo, vistaPrevia, estado: 'seleccionado' }); }
      catch {
        if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
        this.errorEvidencias.set('Este navegador no ofrece un generador seguro para identificar la carga.');
      }
    }
    this.evidencias.set(nuevas);
  }

  quitarEvidencia(clave: string): void {
    if (this.enviando() || this.creado()) return;
    const item = this.evidencias().find((actual) => actual.clave === clave);
    if (item?.vistaPrevia) URL.revokeObjectURL(item.vistaPrevia);
    this.evidencias.update((actuales) => actuales.filter((actual) => actual.clave !== clave));
    this.errorEvidencias.set('');
  }

  private actualizarEvidencia(clave: string, cambio: Partial<EvidenciaLocal>): void {
    this.evidencias.update((actuales) => actuales.map((item) => item.clave === clave ? { ...item, ...cambio } : item));
  }

  private async subirPendientes(token: string, reporteId: number, soloFallidos: boolean): Promise<void> {
    for (const item of this.evidencias()) {
      if (soloFallidos ? item.estado !== 'fallido' : item.estado !== 'seleccionado') continue;
      this.actualizarEvidencia(item.clave, { estado: 'subiendo', error: undefined });
      try {
        const guardada = await this.subirArchivo(token, reporteId, item.tipo, item.clave, item.archivo);
        this.actualizarEvidencia(item.clave, { estado: 'guardado', evidenciaId: guardada.id });
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'No se pudo guardar este archivo.';
        this.actualizarEvidencia(item.clave, { estado: 'fallido', error: mensaje });
        if (error instanceof ErrorEvidencia && error.estado === 401) {
          this.errorEvidencias.set('Tu sesión venció. El reporte ya existe; inicia sesión antes de reintentar los adjuntos fallidos.');
        }
      }
    }
  }

  async reintentarEvidencias(): Promise<void> {
    const reporte = this.creado();
    if (!reporte || this.enviando()) return;
    const token = accesoActual.leerToken();
    if (!token) { this.errorEvidencias.set('Inicia sesión para reintentar los adjuntos fallidos. El reporte ya existe.'); return; }
    this.enviando.set(true);
    this.errorEvidencias.set('');
    try { await this.subirPendientes(token, reporte.id, true); }
    finally { this.enviando.set(false); }
  }

  ngOnDestroy(): void {
    for (const item of this.evidencias()) if (item.vistaPrevia) URL.revokeObjectURL(item.vistaPrevia);
  }

  async enviar(): Promise<void> {
    if (this.enviando() || this.creado()) return;
    this.formulario.markAllAsTouched();
    this.errorEnvio.set('');
    const catalogos = this.catalogos();
    const audio = this.modoDescripcion() === 'audio' ? this.notaVoz() : null;
    if (this.formulario.invalid || !this.puntoSeleccionado() || !catalogos || this.errorCatalogos() ||
      (this.modoDescripcion() === 'audio' && !audio)) return;
    const valor = this.formulario.getRawValue();
    const tipoId = Number(valor.tipo_incidente_id);
    const gravedadId = Number(valor.nivel_gravedad_id);
    const zonaId = Number(valor.zona_id);
    if (!catalogos.tipos_incidente.some((item) => item.id === tipoId) ||
        !catalogos.niveles_gravedad.some((item) => item.id === gravedadId) ||
        !catalogos.zonas.some((item) => item.id === zonaId)) {
      this.errorEnvio.set('Selecciona valores disponibles de tipo, gravedad y zona.');
      return;
    }
    const token = accesoActual.leerToken();
    if (!token) {
      this.errorEnvio.set('Tu sesión no está disponible. Inicia sesión para enviar el reporte.');
      return;
    }
    this.enviando.set(true);
    try {
      const datos = {
        tipo_incidente_id: tipoId,
        nivel_gravedad_id: gravedadId,
        zona_id: zonaId,
        latitud: Number(valor.latitud.trim()),
        longitud: Number(valor.longitud.trim()),
      };
      const reporte = audio
        ? await this.crearAudio(token, datos, audio)
        : await this.crear(token, { ...datos, descripcion_texto: valor.descripcion_texto.trim() });
      this.creado.set(reporte);
      await this.subirPendientes(token, reporte.id, false);
    } catch (error) {
      if (this.creado()) {
        this.errorEvidencias.set('El reporte ya existe, pero no se pudieron completar los adjuntos. Reintenta solo los fallidos.');
        return;
      }
      if (error instanceof ErrorCrearReporte && (error.estado === 401 || error.estado === 404)) {
        accesoActual.cerrarSesion();
        this.perfil.set(null);
        this.errorEnvio.set('Tu sesión venció o la cuenta ya no está disponible. Copia tus datos antes de volver a iniciar sesión.');
      } else if (error instanceof ErrorCrearReporte) {
        this.errorEnvio.set(error.message);
      } else {
        this.errorEnvio.set('No se pudo enviar el reporte. Inténtalo de nuevo.');
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
