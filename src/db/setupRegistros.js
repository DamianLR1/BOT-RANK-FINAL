const { pool } = require('./pool');

async function setupRegistros() {
  // Registros diarios archivados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros_diarios (
      id            SERIAL PRIMARY KEY,
      guild         TEXT NOT NULL,
      fecha         DATE NOT NULL,
      fecha_texto   TEXT NOT NULL,
      mes_key       TEXT NOT NULL,
      mes_texto     TEXT NOT NULL,
      top_usuarios  JSONB DEFAULT '[]',
      total_puntos  BIGINT DEFAULT 0,
      participantes INTEGER DEFAULT 0,
      UNIQUE(guild, fecha)
    )
  `);

  // Resúmenes mensuales
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros_mensuales (
      id            SERIAL PRIMARY KEY,
      guild         TEXT NOT NULL,
      mes_key       TEXT NOT NULL,
      mes_texto     TEXT NOT NULL,
      total_puntos  BIGINT DEFAULT 0,
      dias_activos  INTEGER DEFAULT 0,
      mvp_usuario   TEXT DEFAULT '-',
      mvp_puntos    BIGINT DEFAULT 0,
      UNIQUE(guild, mes_key)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registros_diarios_guild_mes ON registros_diarios(guild, mes_key)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registros_mensuales_guild ON registros_mensuales(guild)`);

  console.log('✅ Tablas de registros listas');
}

module.exports = { setupRegistros };
