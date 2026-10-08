// Conexión a la base de datos (Postgres de Vercel / Neon) y creación de la tabla la primera vez
const { neon } = require('@neondatabase/serverless');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = url ? neon(url) : null;

let tablaLista = null;
function prepararTabla() {
  if (!sql) throw new Error('Falta conectar la base de datos (Storage → Create Database).');
  if (!tablaLista) {
    tablaLista = sql`
      CREATE TABLE IF NOT EXISTS eventos (
        id          serial PRIMARY KEY,
        fecha       timestamptz NOT NULL DEFAULT now(),
        tipo        text NOT NULL,
        destino     text,
        ubicacion   text,
        metodo      text,
        dispositivo text,
        referencia  text
      )`.catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

module.exports = { sql, prepararTabla };
