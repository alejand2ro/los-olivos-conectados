import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { LOCALE_ID } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

registerLocaleData(localeEs, 'es-PE');

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    { provide: LOCALE_ID, useValue: 'es-PE' },
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
  ],
});
