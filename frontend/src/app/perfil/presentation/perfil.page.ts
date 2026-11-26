import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';

@Component({
  selector: 'app-perfil',
  imports: [IonContent, ReactiveFormsModule, SiteHeaderComponent],
  templateUrl: './perfil.page.html',
  styleUrl: './perfil.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPage implements OnInit {
  private readonly router = inject(Router);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly zonaNombre = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly confirmacion = signal('');
  readonly formulario = new FormGroup({
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    modo_accesibilidad: new FormControl(false, { nonNullable: true }),
  });

  ngOnInit(): void { void this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const perfil = await accesoActual.consultarPerfil();
      this.perfil.set(perfil);
      this.formulario.setValue({ telefono: perfil.telefono ?? '', modo_accesibilidad: perfil.modo_accesibilidad });
      if (perfil.zona_id !== null) {
        try {
          const catalogos = await accesoActual.catalogos();
          this.zonaNombre.set(catalogos.zonas.find((zona) => zona.id === perfil.zona_id)?.nombre ?? null);
        } catch { this.zonaNombre.set(null); }
      }
    } catch {
      if (!accesoActual.leerToken()) { await this.router.navigateByUrl('/inicio'); return; }
      this.error.set('No se pudo cargar tu perfil. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar(): Promise<void> {
    this.confirmacion.set('');
    this.error.set('');
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      const valor = this.formulario.getRawValue();
      const perfil = await accesoActual.actualizarPerfil({
        telefono: valor.telefono.trim() || null,
        modo_accesibilidad: valor.modo_accesibilidad,
      });
      this.perfil.set(perfil);
      this.formulario.patchValue({ telefono: perfil.telefono ?? '', modo_accesibilidad: perfil.modo_accesibilidad });
      this.confirmacion.set('Tu perfil se guardó correctamente.');
    } catch {
      if (!accesoActual.leerToken()) { await this.router.navigateByUrl('/inicio'); return; }
      this.error.set('No se pudieron guardar los cambios. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
