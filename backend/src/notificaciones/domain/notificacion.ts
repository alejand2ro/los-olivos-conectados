export interface NotificacionPropia {
    id: number;
    tipo: 'alerta' | 'sos' | 'cambio_estado';
    alerta_id: number | null;
    reporte_id: number | null;
    leido: boolean;
    fecha_envio: string;
}
