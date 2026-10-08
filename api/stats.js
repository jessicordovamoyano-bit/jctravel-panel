// Devuelve los números del tablero. Pide la contraseña del panel (variable PANEL_PASSWORD en Vercel)
const crypto = require('crypto');
const { sql, prepararTabla } = require('./_db');

function claveCorrecta(recibida) {
  const real = process.env.PANEL_PASSWORD || '';
  if (!real || typeof recibida !== 'string') return false;
  const a = Buffer.from(recibida), b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.PANEL_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar la contraseña del panel (PANEL_PASSWORD).' });
  }
  if (!claveCorrecta(req.headers['x-panel-clave'])) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  const dias = [7, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;

  try {
    await prepararTabla();

    const [totales, porDia, destinos, ubicaciones, dispositivos, referencias, ultimas] = await Promise.all([
      sql`SELECT
            count(*) FILTER (WHERE tipo = 'visita')          AS visitas,
            count(*) FILTER (WHERE tipo = 'ver_propuesta')   AS propuestas,
            count(*) FILTER (WHERE tipo = 'click_whatsapp')  AS whatsapp,
            count(*) FILTER (WHERE tipo = 'formulario')      AS formularios
          FROM eventos WHERE fecha >= now() - make_interval(days => ${dias})`,
      sql`SELECT to_char(date_trunc('day', fecha AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM-DD') AS dia,
            count(*) FILTER (WHERE tipo = 'visita') AS visitas,
            count(*) FILTER (WHERE tipo IN ('click_whatsapp', 'formulario')) AS consultas
          FROM eventos WHERE fecha >= now() - make_interval(days => ${dias})
          GROUP BY 1 ORDER BY 1`,
      sql`SELECT destino,
            count(*) FILTER (WHERE tipo = 'ver_propuesta') AS aperturas,
            count(*) FILTER (WHERE tipo IN ('click_whatsapp', 'formulario')) AS consultas
          FROM eventos
          WHERE fecha >= now() - make_interval(days => ${dias}) AND destino IS NOT NULL AND destino <> '(sin destino)'
          GROUP BY destino ORDER BY consultas DESC, aperturas DESC`,
      sql`SELECT ubicacion, count(*) AS consultas FROM eventos
          WHERE fecha >= now() - make_interval(days => ${dias}) AND tipo IN ('click_whatsapp', 'formulario')
          GROUP BY ubicacion ORDER BY consultas DESC`,
      sql`SELECT coalesce(dispositivo, 'sin dato') AS dispositivo, count(*) AS visitas FROM eventos
          WHERE fecha >= now() - make_interval(days => ${dias}) AND tipo = 'visita'
          GROUP BY 1 ORDER BY visitas DESC`,
      sql`SELECT coalesce(referencia, 'directo') AS referencia, count(*) AS visitas FROM eventos
          WHERE fecha >= now() - make_interval(days => ${dias}) AND tipo = 'visita'
          GROUP BY 1 ORDER BY visitas DESC LIMIT 6`,
      sql`SELECT fecha, tipo, destino, ubicacion, dispositivo FROM eventos
          WHERE tipo IN ('click_whatsapp', 'formulario')
          ORDER BY fecha DESC LIMIT 10`
    ]);

    const t = totales[0];
    const visitas = Number(t.visitas), consultas = Number(t.whatsapp) + Number(t.formularios);
    return res.status(200).json({
      dias,
      totales: {
        visitas,
        propuestas: Number(t.propuestas),
        whatsapp: Number(t.whatsapp),
        formularios: Number(t.formularios),
        consultas,
        tasa: visitas ? consultas / visitas : 0
      },
      porDia: porDia.map((r) => ({ dia: r.dia, visitas: Number(r.visitas), consultas: Number(r.consultas) })),
      destinos: destinos.map((r) => ({ destino: r.destino, aperturas: Number(r.aperturas), consultas: Number(r.consultas) })),
      ubicaciones: ubicaciones.map((r) => ({ ubicacion: r.ubicacion || 'sin dato', consultas: Number(r.consultas) })),
      dispositivos: dispositivos.map((r) => ({ dispositivo: r.dispositivo, visitas: Number(r.visitas) })),
      referencias: referencias.map((r) => ({ referencia: r.referencia, visitas: Number(r.visitas) })),
      ultimas
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message.includes('Falta conectar') ? e.message : 'No se pudieron leer los datos' });
  }
};
