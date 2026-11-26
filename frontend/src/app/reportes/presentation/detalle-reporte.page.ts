import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import { consultarReporte } from '../application/consultar-reporte';
import { subirEvidencia } from '../application/subir-evidencia';
import type { DetalleReporte, SeguimientoReporte } from '../domain/detalle-reporte';
import { MAX_FOTOS, MAX_VIDEOS, MAX_FOTO_BYTES, MAX_VIDEO_BYTES, type EvidenciaLocal, type TipoEvidencia } from '../domain/evidencia';
import { apiDetalleReporteHttp } from '../infrastructure/api-detalle-reporte-http';
import { apiEvidenciasHttp } from '../infrastructure/api-evidencias-http';
import { claveCarga } from '../infrastructure/clave-carga';
import { AdjuntosEvidenciaComponent } from './adjuntos-evidencia/adjuntos-evidencia.component';
import { MapaReporteComponent } from './mapa-reporte/mapa-reporte.component';

@Component({
  selector: 'app-detalle-reporte',
  imports: [IonContent, DatePipe, RouterLink, SiteHeaderComponent, AdjuntosEvidenciaComponent, MapaReporteComponent],
  templateUrl: './detalle-reporte.page.html',
  styleUrl: './detalle-reporte.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleReportePage implements OnInit, OnDestroy {
  private readonly ruta = inject(ActivatedRoute);
  private readonly consultar = consultarReporte(apiDetalleReporteHttp);
  private readonly subir = subirEvidencia(apiEvidenciasHttp);
  private readonly urls = new Set<string>();
  private readonly cancelacionMedios = new AbortController();
  private destruido = false;
  @ViewChild('visorFoto') private visorFoto?: ElementRef<HTMLDialogElement>;
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly zonaNombre = signal<string | null>(null);
  readonly reporte = signal<DetalleReporte | null>(null);
  readonly seguimiento = signal<SeguimientoReporte | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly archivos = signal<Record<string, string>>({});
  readonly archivosCargando = signal<Set<string>>(new Set());
  readonly erroresArchivo = signal<Record<string, string>>({});
  readonly fotoAmpliada = signal<{ id: number; url: string } | null>(null);
  readonly videoCompatible = typeof document !== 'undefined' &&
    document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
  readonly adjuntos = signal<EvidenciaLocal[]>([]);
  readonly errorAdjuntos = signal('');
  readonly subiendo = signal(false);

  readonly haySeleccionados = () => this.adjuntos().some((item) => item.estado === 'seleccionado');

  get id(): number { return Number(this.ruta.snapshot.paramMap.get('id')); }

  ngOnInit(): void {
    const perfil = this.perfil();
    if (perfil?.zona_id != null) void accesoActual.catalogos().then((catalogos) => {
      this.zonaNombre.set(catalogos.zonas.find((zona) => zona.id === perfil.zona_id)?.nombre ?? null);
    }).catch(() => {});
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const token = accesoActual.leerToken();
    if (!token || !Number.isSafeInteger(this.id) || this.id < 1) {
      this.error.set('No se pudo abrir este reporte.'); this.cargando.set(false); return;
    }
    this.cargando.set(true); this.error.set('');
    try {
      const [reporte, seguimiento] = await Promise.all([
        this.consultar.detalle(token, this.id), this.consultar.seguimiento(token, this.id),
      ]);
      this.reporte.set(reporte); this.seguimiento.set(seguimiento);
      void Promise.allSettled(reporte.evidencias.filter((item) => item.tipo_archivo === 'foto' || this.videoCompatible)
        .map((item) => this.abrirArchivo(item.url_archivo)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo consultar el reporte.');
    } finally { this.cargando.set(false); }
  }

  async abrirArchivo(ruta: string): Promise<void> {
    if (this.destruido || this.archivos()[ruta] || this.archivosCargando().has(ruta)) return;
    const token = accesoActual.leerToken();
    if (!token) { this.erroresArchivo.update((actuales) => ({ ...actuales, [ruta]: 'Inicia sesión de nuevo para abrir el archivo.' })); return; }
    this.archivosCargando.update((actuales) => new Set([...actuales, ruta]));
    this.erroresArchivo.update((actuales) => ({ ...actuales, [ruta]: '' }));
    try {
      const blob = await this.consultar.archivo(token, ruta, this.cancelacionMedios.signal);
      if (this.destruido) return;
      const url = URL.createObjectURL(blob);
      this.urls.add(url);
      this.archivos.update((actuales) => ({ ...actuales, [ruta]: url }));
    } catch (error) {
      if (!this.destruido) this.erroresArchivo.update((actuales) => ({ ...actuales,
        [ruta]: error instanceof Error ? error.message : 'No se pudo abrir el archivo.' }));
    } finally {
      if (!this.destruido) this.archivosCargando.update((actuales) => {
        const siguientes = new Set(actuales); siguientes.delete(ruta); return siguientes;
      });
    }
  }

  ampliarFoto(id: number, ruta: string): void {
    const url = this.archivos()[ruta];
    if (!url || !this.visorFoto) return;
    this.fotoAmpliada.set({ id, url });
    this.visorFoto.nativeElement.showModal();
  }

  cerrarFoto(): void {
    this.visorFoto?.nativeElement.close();
    this.fotoAmpliada.set(null);
  }

  agregar(archivos: File[]): void {
    if (this.subiendo()) return;
    this.errorAdjuntos.set('');
    const nuevos = [...this.adjuntos()];
    const guardados = this.reporte()?.evidencias ?? [];
    for (const archivo of archivos) {
      const extension = archivo.name.split('.').pop()?.toLowerCase();
      const tipo: TipoEvidencia | null = archivo.type === 'image/jpeg' || archivo.type === 'image/png' ||
        (!archivo.type && ['jpg', 'jpeg', 'png'].includes(extension ?? '')) ? 'foto' :
        archivo.type === 'video/mp4' || (!archivo.type && extension === 'mp4') ? 'video' : null;
      if (!tipo) { this.errorAdjuntos.set('Solo se admiten fotografías JPEG/PNG o videos MP4.'); continue; }
      if (!archivo.size || archivo.size > (tipo === 'foto' ? MAX_FOTO_BYTES : MAX_VIDEO_BYTES)) {
        this.errorAdjuntos.set(tipo === 'foto' ? 'Cada fotografía debe ocupar hasta 5 MiB.' : 'Cada video debe ocupar hasta 20 MiB.'); continue;
      }
      const cantidad = guardados.filter((item) => item.tipo_archivo === tipo).length + nuevos.filter((item) => item.tipo === tipo).length;
      if (cantidad >= (tipo === 'foto' ? MAX_FOTOS : MAX_VIDEOS)) {
        this.errorAdjuntos.set('Se permiten hasta 4 fotografías y 1 video por reporte.'); continue;
      }
      let vistaPrevia = '';
      try { vistaPrevia = URL.createObjectURL(archivo); this.urls.add(vistaPrevia); } catch { /* archivo sin vista previa */ }
      try { nuevos.push({ clave: claveCarga(), archivo, tipo, vistaPrevia, estado: 'seleccionado' }); }
      catch {
        if (vistaPrevia) this.liberar(vistaPrevia);
        this.errorAdjuntos.set('Este navegador no ofrece un generador seguro para identificar la carga.');
      }
    }
    this.adjuntos.set(nuevos);
  }

  quitar(clave: string): void {
    if (this.subiendo()) return;
    const item = this.adjuntos().find((actual) => actual.clave === clave);
    if (item?.vistaPrevia) this.liberar(item.vistaPrevia);
    this.adjuntos.update((actuales) => actuales.filter((actual) => actual.clave !== clave));
  }

  private liberar(url: string): void { URL.revokeObjectURL(url); this.urls.delete(url); }

  async subirAdjuntos(soloFallidos = false): Promise<void> {
    if (this.subiendo() || !this.reporte()) return;
    const token = accesoActual.leerToken();
    if (!token) { this.errorAdjuntos.set('Inicia sesión de nuevo para subir evidencias.'); return; }
    this.subiendo.set(true); this.errorAdjuntos.set('');
    let guardo = false;
    for (const item of this.adjuntos()) {
      if (item.estado !== (soloFallidos ? 'fallido' : 'seleccionado')) continue;
      this.adjuntos.update((actuales) => actuales.map((actual) => actual.clave === item.clave ? { ...actual, estado: 'subiendo', error: undefined } : actual));
      try {
        const guardado = await this.subir(token, this.id, item.tipo, item.clave, item.archivo);
        guardo = true;
        this.adjuntos.update((actuales) => actuales.map((actual) => actual.clave === item.clave ? { ...actual, estado: 'guardado', evidenciaId: guardado.id } : actual));
      } catch (error) {
        this.adjuntos.update((actuales) => actuales.map((actual) => actual.clave === item.clave ?
          { ...actual, estado: 'fallido', error: error instanceof Error ? error.message : 'No se pudo subir.' } : actual));
      }
    }
    if (guardo) {
      try {
        const reporte = await this.consultar.detalle(token, this.id);
        this.reporte.set(reporte);
        for (const item of this.adjuntos().filter((actual) => actual.estado === 'guardado')) {
          if (item.vistaPrevia) this.liberar(item.vistaPrevia);
        }
        this.adjuntos.update((actuales) => actuales.filter((actual) => actual.estado !== 'guardado'));
      } catch { this.errorAdjuntos.set('Se guardaron archivos, pero no se pudo actualizar la lista. Recarga el detalle para comprobarlos.'); }
    }
    this.subiendo.set(false);
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.cancelacionMedios.abort();
    if (this.visorFoto?.nativeElement.open) this.visorFoto.nativeElement.close();
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}
