import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-mapa-reporte',
  templateUrl: './mapa-reporte.component.html',
  styleUrl: './mapa-reporte.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaReporteComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) latitud!: number;
  @Input({ required: true }) longitud!: number;
  @ViewChild('mapa') private mapaElemento!: ElementRef<HTMLDivElement>;

  readonly error = signal('');
  private mapaInstancia: L.Map | null = null;
  private capa: L.TileLayer | null = null;
  private observador: ResizeObserver | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private fotograma: number | null = null;
  private cargado = false;
  private destruido = false;

  ngAfterViewInit(): void {
    try {
      if (!Number.isFinite(this.latitud) || Math.abs(this.latitud) > 90 ||
          !Number.isFinite(this.longitud) || Math.abs(this.longitud) > 180) throw new Error('Coordenadas inválidas');
      const posicion = L.latLng(this.latitud, this.longitud);
      this.mapaInstancia = L.map(this.mapaElemento.nativeElement, {
        center: posicion, zoom: 16, scrollWheelZoom: false,
      });
      this.capa = L.tileLayer(environment.mapTiles.url, {
        attribution: environment.mapTiles.attribution,
        maxZoom: environment.mapTiles.maxZoom,
      });
      this.capa.on('load', this.alCargarAzulejos);
      this.capa.on('tileerror', this.alFallarAzulejos);
      this.capa.addTo(this.mapaInstancia);
      L.marker(posicion, {
        draggable: false, interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'incidente-marcador', html: '<span aria-hidden="true"></span>',
          iconSize: [28, 36], iconAnchor: [14, 36] }),
      }).addTo(this.mapaInstancia);
      this.temporizador = setTimeout(() => {
        if (!this.cargado && !this.destruido) this.error.set('No se pudo cargar el mapa. La zona y las coordenadas siguen disponibles abajo.');
      }, 12000);
      if (typeof ResizeObserver !== 'undefined') {
        this.observador = new ResizeObserver(() => this.mapaInstancia?.invalidateSize());
        this.observador.observe(this.mapaElemento.nativeElement);
      }
      this.fotograma = requestAnimationFrame(() => this.mapaInstancia?.invalidateSize());
    } catch {
      this.error.set('No se pudo mostrar el mapa. La zona y las coordenadas siguen disponibles abajo.');
      this.limpiar();
    }
  }

  private readonly alCargarAzulejos = (): void => {
    this.cargado = true;
    this.error.set('');
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  };
  private readonly alFallarAzulejos = (): void => {
    if (!this.cargado) this.error.set('No se pudo cargar el mapa. La zona y las coordenadas siguen disponibles abajo.');
  };

  ngOnDestroy(): void { this.destruido = true; this.limpiar(); }

  private limpiar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.fotograma !== null) cancelAnimationFrame(this.fotograma);
    this.observador?.disconnect();
    this.capa?.off('load', this.alCargarAzulejos);
    this.capa?.off('tileerror', this.alFallarAzulejos);
    this.mapaInstancia?.remove();
    this.capa = null;
    this.mapaInstancia = null;
  }
}
