const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('./db');
const { TITRES_SEED } = require('./data/titres-seed');
const { MODULES_SEED } = require('./data/formation-seed');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Tables créées / vérifiées avec succès.');

  for (const t of TITRES_SEED) {
    await pool.query(
      `INSERT INTO titres_brvm (ticker, nom, secteur, pays, fiche_complete)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ticker) DO NOTHING`,
      [t.ticker, t.nom, t.secteur, t.pays, t.fiche_complete]
    );
  }
  console.log(`✅ Répertoire des ${TITRES_SEED.length} titres BRVM initialisé.`);

  for (const m of MODULES_SEED) {
    const existant = await pool.query('SELECT id FROM modules_formation WHERE ordre = $1', [m.ordre]);
    let moduleId;
    if (existant.rows.length) {
      moduleId = existant.rows[0].id;
      await pool.query(
        `UPDATE modules_formation SET questions = $2 WHERE id = $1 AND questions = '[]'::jsonb`,
        [moduleId, JSON.stringify(m.questions)]
      );
    } else {
      const result = await pool.query(
        `INSERT INTO modules_formation (ordre, titre, description, questions, seuil_reussite) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [m.ordre, m.titre, m.description, JSON.stringify(m.questions), m.seuil_reussite]
      );
      moduleId = result.rows[0].id;
    }
    for (const l of m.lecons) {
      const existeLecon = await pool.query('SELECT id FROM lecons_formation WHERE module_id = $1 AND ordre = $2', [moduleId, l.ordre]);
      if (!existeLecon.rows.length) {
        await pool.query(
          `INSERT INTO lecons_formation (module_id, ordre, titre, type, youtube_id, contenu_texte) VALUES ($1,$2,$3,$4,$5,$6)`,
          [moduleId, l.ordre, l.titre, l.type || 'video', l.youtube_id || null, l.contenu_texte || null]
        );
      }
    }
  }
  console.log(`✅ Parcours de formation initialisé (${MODULES_SEED.length} module(s)).`);

  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Erreur de migration :', err);
  process.exit(1);
});
