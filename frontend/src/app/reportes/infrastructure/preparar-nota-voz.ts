const MUESTRAS_POR_SEGUNDO = 16000;
const MAX_SEGUNDOS = 60;
const MAX_BYTES = 3 * 1024 * 1024;

// MediaRecorder produce el formato nativo del navegador. Lo decodificamos y
// convertimos a WAV PCM mono para que el servidor verifique muestras y duración.
export async function prepararNotaVoz(grabacion: Blob): Promise<File> {
  const contexto = new AudioContext();
  let audio: AudioBuffer;
  try {
    audio = await contexto.decodeAudioData(await grabacion.arrayBuffer());
  } catch {
    throw new Error('No se pudo procesar la grabación. Prueba de nuevo o escribe la descripción.');
  } finally {
    await contexto.close();
  }
  if (!Number.isFinite(audio.duration) || audio.duration < 1 || audio.duration > MAX_SEGUNDOS) {
    throw new Error('La nota de voz debe durar entre 1 y 60 segundos.');
  }
  const muestras = Math.ceil(audio.duration * MUESTRAS_POR_SEGUNDO);
  if (muestras * 2 + 44 > MAX_BYTES) throw new Error('La nota de voz supera 3 MiB.');
  let remuestreado: AudioBuffer;
  try {
    const sinConexion = new OfflineAudioContext(1, muestras, MUESTRAS_POR_SEGUNDO);
    const origen = sinConexion.createBufferSource();
    origen.buffer = audio;
    origen.connect(sinConexion.destination);
    origen.start();
    remuestreado = await sinConexion.startRendering();
  }
  catch { throw new Error('No se pudo preparar la nota de voz. Prueba de nuevo o escribe la descripción.'); }
  const datos = remuestreado.getChannelData(0);
  const wav = new ArrayBuffer(44 + datos.length * 2);
  const vista = new DataView(wav);
  function texto(posicion: number, valor: string) {
    for (let i = 0; i < valor.length; i++) vista.setUint8(posicion + i, valor.charCodeAt(i));
  }
  texto(0, 'RIFF'); vista.setUint32(4, wav.byteLength - 8, true); texto(8, 'WAVE');
  texto(12, 'fmt '); vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true); vista.setUint16(22, 1, true);
  vista.setUint32(24, MUESTRAS_POR_SEGUNDO, true);
  vista.setUint32(28, MUESTRAS_POR_SEGUNDO * 2, true);
  vista.setUint16(32, 2, true); vista.setUint16(34, 16, true);
  texto(36, 'data'); vista.setUint32(40, datos.length * 2, true);
  for (let i = 0; i < datos.length; i++) {
    const muestra = Math.max(-1, Math.min(1, datos[i]));
    vista.setInt16(44 + i * 2, muestra < 0 ? muestra * 32768 : muestra * 32767, true);
  }
  return new File([wav], 'nota-voz.wav', { type: 'audio/wav' });
}
