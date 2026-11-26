import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ErrorApi } from '../application/acceso';
import type { CatalogosRegistro, Credenciales, DatosRegistro, UsuarioSesion } from '../domain/acceso';
import { accesoActual } from '../infrastructure/acceso-actual';
import { LoginFormComponent } from './login-form/login-form.component';
import { RegistroFormComponent } from './registro-form/registro-form.component';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import { rutaInicialPorRol } from '../domain/rutas-rol';

@Component({
  selector: 'app-inicio',
  imports: [IonContent, SiteHeaderComponent, LoginFormComponent, RegistroFormComponent],
  templateUrl: './inicio.page.html',
  styleUrl: './inicio.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage implements OnInit {
  private readonly acceso = accesoActual;
  private readonly router = inject(Router);

  readonly vista = signal<'login' | 'registro'>('login');
  readonly modoAccesible = signal(false);
  readonly verificandoSesion = signal(true);
  readonly usuario = signal<UsuarioSesion | null>(null);
  readonly errorSesion = signal('');
  readonly enviandoLogin = signal(false);
  readonly errorLogin = signal('');
  readonly catalogosRegistro = signal<CatalogosRegistro | null>(null);
  readonly cargandoCatalogos = signal(false);
  readonly errorCatalogos = signal('');
  readonly enviandoRegistro = signal(false);
  readonly errorRegistro = signal('');
  readonly registroExitoso = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.acceso.restaurarSesion();
      if (perfil) {
        this.usuario.set(perfil);
        await this.router.navigateByUrl(rutaInicialPorRol(perfil.rol));
      }
    } catch {
      this.errorSesion.set('No se pudo comprobar la sesión guardada. Puedes intentar ingresar de nuevo.');
    } finally {
      this.verificandoSesion.set(false);
    }
  }

  mostrarRegistro(): void {
    this.vista.set('registro');
    this.errorLogin.set('');
    this.registroExitoso.set(false);
    if (!this.catalogosRegistro()) void this.cargarCatalogos();
  }

  mostrarLogin(): void {
    this.vista.set('login');
    this.errorRegistro.set('');
  }

  async cargarCatalogos(): Promise<void> {
    if (this.cargandoCatalogos()) return;
    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set('');
    try {
      this.catalogosRegistro.set(await this.acceso.catalogos());
    } catch {
      this.errorCatalogos.set('No se pudieron cargar las zonas y los roles. Comprueba la conexión e inténtalo otra vez.');
    } finally {
      this.cargandoCatalogos.set(false);
    }
  }

  async entrar(credenciales: Credenciales): Promise<void> {
    if (this.enviandoLogin()) return;
    this.enviandoLogin.set(true);
    this.errorLogin.set('');
    this.errorSesion.set('');
    try {
      this.usuario.set(await this.acceso.login(credenciales));
      await this.router.navigateByUrl(rutaInicialPorRol(this.usuario()!.rol));
    } catch (error) {
      this.errorLogin.set(error instanceof ErrorApi && error.estado === 401
        ? 'Correo o contraseña incorrectos.'
        : this.mensajeError(error));
    } finally {
      this.enviandoLogin.set(false);
    }
  }

  async registrar(datos: DatosRegistro): Promise<void> {
    if (this.enviandoRegistro()) return;
    this.enviandoRegistro.set(true);
    this.errorRegistro.set('');
    try {
      await this.acceso.registro(datos);
      this.registroExitoso.set(true);
    } catch (error) {
      this.errorRegistro.set(error instanceof ErrorApi && error.estado === 409
        ? 'Ese correo ya está registrado. Puedes iniciar sesión.'
        : this.mensajeError(error));
    } finally {
      this.enviandoRegistro.set(false);
    }
  }

  private mensajeError(error: unknown): string {
    if (error instanceof ErrorApi && error.estado === 0) return error.message;
    if (error instanceof ErrorApi && error.estado === 400) return error.message;
    return 'No se pudo completar la solicitud. Inténtalo de nuevo.';
  }
}
