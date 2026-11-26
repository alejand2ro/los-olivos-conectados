export const environment = {
  production: true,
  // En producción se espera que la API se publique bajo el mismo origen.
  apiBaseUrl: '',
  mapTiles: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19,
  },
};
