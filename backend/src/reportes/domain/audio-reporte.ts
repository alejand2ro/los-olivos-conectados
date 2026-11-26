export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const MAX_AUDIO_SEGUNDOS = 60;
export const MIN_AUDIO_SEGUNDOS = 1;
export const AUDIO_MUESTRAS_POR_SEGUNDO = 16000;

export class AudioInvalido extends Error {}
export class AudioDemasiadoGrande extends Error {}

// Inspecciona el contenido RIFF, los bloques PCM y la duración calculada de las muestras.
// La extensión, el nombre y el MIME enviados por el cliente no sirven como prueba de formato.
export function validarAudioWav(bytes: Buffer): number {
    if (bytes.length > MAX_AUDIO_BYTES) throw new AudioDemasiadoGrande('El audio supera 3 MiB');
    if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) !== bytes.length - 8) {
        throw new AudioInvalido('Se requiere audio WAV PCM mono de 16 kHz');
    }
    let formato = false;
    let muestras: number | null = null;
    let posicion = 12;
    while (posicion + 8 <= bytes.length) {
        const tipo = bytes.toString('ascii', posicion, posicion + 4);
        const largo = bytes.readUInt32LE(posicion + 4);
        posicion += 8;
        if (largo > bytes.length - posicion) throw new AudioInvalido('El archivo WAV está incompleto');
        if (tipo === 'fmt ') {
            if (formato || largo !== 16 || bytes.readUInt16LE(posicion) !== 1 ||
                bytes.readUInt16LE(posicion + 2) !== 1 ||
                bytes.readUInt32LE(posicion + 4) !== AUDIO_MUESTRAS_POR_SEGUNDO ||
                bytes.readUInt32LE(posicion + 8) !== AUDIO_MUESTRAS_POR_SEGUNDO * 2 ||
                bytes.readUInt16LE(posicion + 12) !== 2 || bytes.readUInt16LE(posicion + 14) !== 16) {
                throw new AudioInvalido('Se requiere audio WAV PCM mono de 16 kHz');
            }
            formato = true;
        } else if (tipo === 'data') {
            if (muestras !== null || largo % 2 !== 0) throw new AudioInvalido('El archivo WAV no contiene audio válido');
            muestras = largo / 2;
        }
        posicion += largo + (largo % 2);
    }
    if (posicion !== bytes.length || !formato || muestras === null) {
        throw new AudioInvalido('El archivo WAV está incompleto');
    }
    const duracion = muestras / AUDIO_MUESTRAS_POR_SEGUNDO;
    if (duracion < MIN_AUDIO_SEGUNDOS || duracion > MAX_AUDIO_SEGUNDOS) {
        throw new AudioInvalido('La nota de voz debe durar entre 1 y 60 segundos');
    }
    return duracion;
}
