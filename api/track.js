// Recibe cada visita, propuesta abierta, clic en WhatsApp y formulario que manda jctravel.vercel.app
const { sql, prepararTabla } = require('./_db');

const ORIGENES = ['https://jctravel.vercel.app'];
const TIPOS = ['visita', 'ver_propuesta', 'click_whatsapp', 'formulario'];

// Texto corto y limpio, o null
function texto(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

module.exports = async (req, res) => {
  const origen = req.headers.origin || '';
  if (ORIGENES.includes(origen) || origen.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origen);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // El sitio manda los datos con sendBeacon como texto: puede llegar como string
  let datos = req.body;
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos); } catch { datos = {}; }
  }
  datos = datos || {};

  const tipo = texto(datos.tipo, 40);
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de evento desconocido' });

  try {
    await prepararTabla();
    await sql`
      INSERT INTO eventos (tipo, destino, ubicacion, metodo, dispositivo, referencia)
      VALUES (${tipo}, ${texto(datos.destino, 120)}, ${texto(datos.ubicacion, 40)},
              ${texto(datos.metodo, 40)}, ${texto(datos.dispositivo, 20)}, ${texto(datos.referencia, 120)})`;
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'No se pudo guardar el evento' });
  }
};
