const { pool } = require('./pool');
const { setupRegistros } = require('./setupRegistros');

async function setupDb() {
  console.log('Conectando a la base de datos...');

  await pool.query(`CREATE TABLE IF NOT EXISTS puntos (
    guild TEXT, usuario TEXT, puntos INTEGER DEFAULT 0,
    PRIMARY KEY (guild, usuario)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS clan_stats (
    guild TEXT PRIMARY KEY, total_puntos BIGINT DEFAULT 0,
    last_processed_message_id TEXT, temporada_nombre TEXT
  )`);

  await pool.query(`ALTER TABLE clan_stats ADD COLUMN IF NOT EXISTS last_processed_message_id TEXT`);
  await pool.query(`ALTER TABLE clan_stats ADD COLUMN IF NOT EXISTS temporada_nombre TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS puntos_diarios (
    guild TEXT, usuario TEXT, fecha DATE, puntos INTEGER DEFAULT 0,
    PRIMARY KEY (guild, usuario, fecha)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY, guild TEXT NOT NULL, nombre TEXT NOT NULL,
    start_message_id TEXT, inicio TIMESTAMPTZ DEFAULT NOW(), fin TIMESTAMPTZ,
    inicio_texto TEXT, fin_texto TEXT, activo BOOLEAN DEFAULT false
  )`);

  await pool.query(`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS inicio_texto TEXT`);
  await pool.query(`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS fin_texto TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS puntos_evento (
    evento_id INTEGER NOT NULL, guild TEXT NOT NULL, usuario TEXT NOT NULL,
    puntos INTEGER DEFAULT 0, PRIMARY KEY (evento_id, guild, usuario)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS excluidos_evento (
    evento_id INTEGER NOT NULL, guild TEXT NOT NULL, usuario TEXT NOT NULL,
    PRIMARY KEY (evento_id, guild, usuario)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS eventos_historicos (
    id SERIAL PRIMARY KEY, guild TEXT NOT NULL, nombre TEXT NOT NULL,
    start_message_id TEXT NOT NULL, end_message_id TEXT NOT NULL,
    total_puntos BIGINT DEFAULT 0, participantes INTEGER DEFAULT 0,
    fecha_calculo TIMESTAMPTZ DEFAULT NOW(), contar_en_global BOOLEAN DEFAULT true
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS puntos_historicos (
    id SERIAL PRIMARY KEY, guild TEXT NOT NULL,
    evento_id INTEGER NOT NULL REFERENCES eventos_historicos(id) ON DELETE CASCADE,
    usuario TEXT NOT NULL, puntos INTEGER DEFAULT 0,
    UNIQUE(guild, evento_id, usuario)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS historico_global (
    guild TEXT NOT NULL, usuario TEXT NOT NULL, puntos BIGINT DEFAULT 0,
    PRIMARY KEY (guild, usuario)
  )`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eventos_historicos_guild ON eventos_historicos(guild)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_puntos_historicos_evento ON puntos_historicos(evento_id)`);

  await pool.query(
    `INSERT INTO clan_stats (guild) VALUES ($1) ON CONFLICT (guild) DO NOTHING`,
    [process.env.GUILD_ID]
  );

  await setupRegistros();
  console.log('✅ Todas las tablas listas');
}

module.exports = { setupDb };
