import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { environment } from '../../../../environments/environment';

export interface PuntoIncidente { latitud: number; longitud: number }
type OrigenPunto = 'dispositivo' | 'mapa' | 'manual';

function coordenada(valor: string, minimo: number, maximo: number): number | null {
  const texto = valor.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

@Component({
  selector: 'app-selector-ubicacion',
  imports: [ReactiveFormsModule],
  templateUrl: './selector-ubicacion.component.html',
  styleUrl: './selector-ubicacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorUbicacionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapa') private mapaElemento!: ElementRef<HTMLDivElement>;
  private deshabilitado = false;
  @Input() set disabled(valor: boolean) {
    this.deshabilitado = valor;
    if (valor) this.marcador?.dragging?.disable();
    else this.marcador?.dragging?.enable();
  }
  get disabled(): boolean { return this.deshabilitado; }
  @Output() readonly puntoCambiado = new EventEmitter<PuntoIncidente | null>();

  readonly punto = signal<PuntoIncidente | null>(null);
  readonly origen = signal<OrigenPunto | null>(null);
  readonly precisionMetros = signal<number | null>(null);
  readonly obteniendoUbicacion = signal(false);
  readonly errorUbicacion = signal('');
  readonly errorMapa = signal('');
  readonly manualAbierto = signal(false);
  readonly manualIntentado = signal(false);
  readonly manual = new FormGroup({
    latitud: new FormControl('', { nonNullable: true }),
    longitud: new FormControl('', { nonNullable: true }),
  });

  private mapaInstancia: L.Map | null = null;
  private capa: L.TileLayer | null = null;
  private marcador: L.Marker | null = null;
  private observador: ResizeObserver | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private fotograma: number | null = null;
  private destruido = false;
  private revision = 0;
  private azulejosCargados = false;

  ngAfterViewInit(): void {
    try {
      // La vista inicial orienta al usuario; no selecciona un incidente.
      this.mapaInstancia = L.map(this.mapaElemento.nativeElement, { center: [-11.98, -77.07], zoom: 12 });
      this.mapaInstancia.on('click', this.alPulsarMapa);
      this.capa = L.tileLayer(environment.mapTiles.url, {
        attribution: environment.mapTiles.attribution,
        maxZoom: environment.mapTiles.maxZoom,
      });
      this.capa.on('load', this.alCargarAzulejos);
      this.capa.on('tileerror', this.alFallarAzulejos);
      this.capa.addTo(this.mapaInstancia);
      this.temporizador = setTimeout(() => {
        if (!this.azulejosCargados && !this.destruido) this.falloMapa();
      }, 12000);
      if (typeof ResizeObserver !== 'undefined') {
        this.observador = new ResizeObserver(() => this.mapaInstancia?.invalidateSize());
        this.observador.observe(this.mapaElemento.nativeElement);
      }
      this.fotograma = requestAnimationFrame(() => this.mapaInstancia?.invalidateSize());
    } catch {
      this.falloMapa();
      this.limpiarMapa();
    }
  }

  private readonly alPulsarMapa = (evento: L.LeafletMouseEvent): void => {
    if (this.disabled) return;
    this.elegir({ latitud: evento.latlng.lat, longitud: evento.latlng.lng }, 'mapa');
  };
  private readonly alArrastrarMarcador = (): void => {
    if (this.disabled || !this.marcador) return;
    const posicion = this.marcador.getLatLng();
    this.elegir({ latitud: posicion.lat, longitud: posicion.lng }, 'mapa');
  };
  private readonly alCargarAzulejos = (): void => {
    this.azulejosCargados = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  };
  private readonly alFallarAzulejos = (): void => this.falloMapa();

  private falloMapa(): void {
    this.errorMapa.set('No se pudo cargar el mapa. Puedes introducir las coordenadas manualmente.');
    this.manualAbierto.set(true);
  }

  private elegir(punto: PuntoIncidente, origen: OrigenPunto, precision: number | null = null): void {
    if (this.destruido || !Number.isFinite(punto.latitud) || !Number.isFinite(punto.longitud) ||
      punto.latitud < -90 || punto.latitud > 90 || punto.longitud < -180 || punto.longitud > 180) return;
    this.revision++;
    this.punto.set(punto);
    this.origen.set(origen);
    this.precisionMetros.set(precision);
    this.errorUbicacion.set('');
    this.manual.patchValue({ latitud: String(punto.latitud), longitud: String(punto.longitud) }, { emitEvent: false });
    this.puntoCambiado.emit(punto);
    if (this.mapaInstancia) {
      const posicion = L.latLng(punto.latitud, punto.longitud);
      if (this.marcador) this.marcador.setLatLng(posicion);
      else {
        this.marcador = L.marker(posicion, {
          draggable: true,
          icon: L.divIcon({ className: 'incidente-marcador', html: '<span aria-hidden="true"></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
        }).addTo(this.mapaInstancia);
        this.marcador.on('dragend', this.alArrastrarMarcador);
      }
      if (origen !== 'mapa') this.mapaInstancia.setView(posicion, Math.max(this.mapaInstancia.getZoom(), 16));
    }
  }

  usarUbicacionActual(): void {
    if (this.disabled || this.obteniendoUbicacion()) return;
    this.errorUbicacion.set('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.errorUbicacion.set('Este dispositivo no ofrece ubicación. Elige un punto en el mapa o introdúcelo manualmente.');
      return;
    }
    this.obteniendoUbicacion.set(true);
    const revision = this.revision;
    try {
      navigator.geolocation.getCurrentPosition(
        (posicion) => {
          this.obteniendoUbicacion.set(false);
          if (this.destruido || revision !== this.revision) return;
          const precision = Number.isFinite(posicion.coords.accuracy) && posicion.coords.accuracy >= 0
            ? Math.round(posicion.coords.accuracy) : null;
          this.elegir({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }, 'dispositivo', precision);
        },
        (error) => {
          this.obteniendoUbicacion.set(false);
          if (this.destruido || revision !== this.revision) return;
          this.errorUbicacion.set(error.code === 1
            ? 'Se denegó el permiso de ubicación. Elige el lugar en el mapa o introduce las coordenadas manualmente.'
            : 'No se pudo obtener tu ubicación. Elige el lugar en el mapa o introduce las coordenadas manualmente.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } catch {
      this.obteniendoUbicacion.set(false);
      this.errorUbicacion.set('No se pudo solicitar tu ubicación. Elige el lugar en el mapa o introduce las coordenadas manualmente.');
    }
  }

  alternarManual(): void { this.manualAbierto.update((abierto) => !abierto); }

  latitudManualInvalida(): boolean {
    return this.manualIntentado() && coordenada(this.manual.controls.latitud.value, -90, 90) === null;
  }

  longitudManualInvalida(): boolean {
    return this.manualIntentado() && coordenada(this.manual.controls.longitud.value, -180, 180) === null;
  }

  cambiarManual(): void {
    if (this.disabled) return;
    this.manualIntentado.set(true);
    const latitud = coordenada(this.manual.controls.latitud.value, -90, 90);
    const longitud = coordenada(this.manual.controls.longitud.value, -180, 180);
    if (latitud !== null && longitud !== null) {
      this.elegir({ latitud, longitud }, 'manual');
    } else {
      this.revision++;
      this.punto.set(null);
      this.origen.set(null);
      this.precisionMetros.set(null);
      this.marcador?.remove();
      this.marcador = null;
      this.puntoCambiado.emit(null);
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.limpiarMapa();
  }

  private limpiarMapa(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.fotograma !== null) cancelAnimationFrame(this.fotograma);
    this.observador?.disconnect();
    this.capa?.off('load', this.alCargarAzulejos);
    this.capa?.off('tileerror', this.alFallarAzulejos);
    this.marcador?.off('dragend', this.alArrastrarMarcador);
    this.mapaInstancia?.off('click', this.alPulsarMapa);
    this.mapaInstancia?.remove();
    this.mapaInstancia = null;
    this.marcador = null;
  }
}
