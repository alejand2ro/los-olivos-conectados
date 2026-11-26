import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import { crearAltaAutoridad } from '../application/crear-autoridad';
import type { AutoridadCreada } from '../domain/cuenta-autoridad';
import { apiAltaAutoridadHttp } from '../infrastructure/api-alta-autoridad-http';

@Component({
  selector: 'app-administracion',
  imports: [IonContent, ReactiveFormsModule, SiteHeaderComponent],
  templateUrl: './administracion.page.html',
  styleUrl: './administracion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdministracionPage {
  private readonly crear = crearAltaAutoridad(apiAltaAutoridadHttp);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly creada = signal<AutoridadCreada | null>(null);
  readonly formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(150)] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)] }),
  });

  async guardar(): Promise<void> {
    if (this.enviando()) return;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;
    const token = accesoActual.leerToken();
    if (!token) { this.error.set('La sesión no está disponible. Inicia sesión de nuevo.'); return; }
    this.enviando.set(true); this.error.set(''); this.creada.set(null);
    try {
      const datos = this.formulario.getRawValue();
      this.creada.set(await this.crear(token, {
        nombre: datos.nombre.trim(), correo: datos.correo.trim().toLowerCase(), contrasena: datos.contrasena,
      }));
      this.formulario.reset();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
    } finally { this.enviando.set(false); }
  }
}
