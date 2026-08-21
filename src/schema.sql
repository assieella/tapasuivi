-- TAPA SUIVI - Schéma de base de données PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client',
  programme TEXT DEFAULT '4_mois',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profession TEXT,
  revenu_mensuel NUMERIC,
  capital_disponible NUMERIC,
  situation_familiale TEXT,
  nombre_enfants INTEGER DEFAULT 0,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  profile_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objectif_montant NUMERIC NOT NULL,
  horizon_mois INTEGER NOT NULL,
  montant_initial NUMERIC NOT NULL DEFAULT 0,
  versement_mensuel NUMERIC NOT NULL DEFAULT 0,
  taux_annuel_estime NUMERIC NOT NULL,
  montant_projete NUMERIC NOT NULL,
  objectif_realiste BOOLEAN NOT NULL,
  versement_recommande NUMERIC,
  horizon_recommande_mois INTEGER,
  objectif_final_retenu NUMERIC NOT NULL,
  statut TEXT NOT NULL DEFAULT 'actif',
  strategie TEXT,
  dernieres_suggestions_le DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mois DATE NOT NULL,
  lignes JSONB NOT NULL,
  valeur_totale NUMERIC NOT NULL,
  commentaire_ia TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mois)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user ON investment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON portfolio_snapshots(user_id);

CREATE TABLE IF NOT EXISTS titres_brvm (
  ticker TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  secteur TEXT,
  pays TEXT,
  description TEXT,
  date_introduction DATE,
  fiche_complete BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cours_quotidiens (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker) ON DELETE CASCADE,
  date_cours DATE NOT NULL,
  cours NUMERIC NOT NULL,
  variation_pct NUMERIC,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ticker, date_cours)
);

CREATE TABLE IF NOT EXISTS dividendes_historique (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker) ON DELETE CASCADE,
  annee INTEGER NOT NULL,
  montant_par_action NUMERIC NOT NULL,
  UNIQUE(ticker, annee)
);

CREATE TABLE IF NOT EXISTS etudes_titres (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  date_publication DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cours_ticker_date ON cours_quotidiens(ticker, date_cours DESC);
CREATE INDEX IF NOT EXISTS idx_dividendes_ticker ON dividendes_historique(ticker);
CREATE INDEX IF NOT EXISTS idx_etudes_ticker ON etudes_titres(ticker, date_publication DESC);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client', 'conseiller', 'systeme')),
  contenu TEXT NOT NULL,
  lu_par_client BOOLEAN NOT NULL DEFAULT false,
  lu_par_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id, created_at ASC);

CREATE TABLE IF NOT EXISTS notes_internes (
  client_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules_formation (
  id SERIAL PRIMARY KEY,
  ordre INTEGER NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  youtube_id TEXT, -- conservé pour compatibilité, non utilisé si le module a des leçons
  questions JSONB NOT NULL DEFAULT '[]',
  seuil_reussite INTEGER NOT NULL DEFAULT 60,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Leçons (vidéos) d'un module. Un module peut contenir plusieurs leçons ;
-- le quiz (sur modules_formation.questions) ne porte que sur l'ensemble du module.
CREATE TABLE IF NOT EXISTS lecons_formation (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules_formation(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL DEFAULT 1,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'video', -- 'video' ou 'texte'
  youtube_id TEXT,
  contenu_texte TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lecons_module ON lecons_formation(module_id, ordre ASC);

ALTER TABLE lecons_formation ALTER COLUMN youtube_id DROP NOT NULL;
ALTER TABLE lecons_formation ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'video';
ALTER TABLE lecons_formation ADD COLUMN IF NOT EXISTS contenu_texte TEXT;

ALTER TABLE modules_formation ALTER COLUMN youtube_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS progression_formation (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules_formation(id) ON DELETE CASCADE,
  reussi BOOLEAN NOT NULL DEFAULT false,
  score_pct INTEGER,
  tentatives INTEGER NOT NULL DEFAULT 0,
  date_reussite TIMESTAMP,
  UNIQUE(user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_progression_user ON progression_formation(user_id);

CREATE TABLE IF NOT EXISTS videos_gratuites (
  id SERIAL PRIMARY KEY,
  ordre INTEGER NOT NULL DEFAULT 1,
  titre TEXT NOT NULL,
  description TEXT,
  youtube_id TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads_decouverte (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ajouts idempotents pour les bases déjà migrées avant l'ajout de ces colonnes
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom TEXT NOT NULL DEFAULT '';
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS revenu_mensuel NUMERIC;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS capital_disponible NUMERIC;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS situation_familiale TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS nombre_enfants INTEGER DEFAULT 0;
ALTER TABLE investment_plans ADD COLUMN IF NOT EXISTS strategie TEXT;
ALTER TABLE investment_plans ADD COLUMN IF NOT EXISTS dernieres_suggestions_le DATE;

-- Appels collectifs mensuels (plateforme libre : WhatsApp, Zoom, etc.)
CREATE TABLE IF NOT EXISTS appels_mensuels (
  id SERIAL PRIMARY KEY,
  date_appel TIMESTAMP NOT NULL,
  plateforme TEXT,
  lien TEXT,
  notes TEXT,
  rappel_envoye BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appels_date ON appels_mensuels(date_appel);

-- Suit l'envoi du bilan de fin de programme (une seule fois par client)
CREATE TABLE IF NOT EXISTS bilans_envoyes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_envoi TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Transactions du portefeuille client (achats et ventes réels)
CREATE TABLE IF NOT EXISTS portefeuille_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker),
  type TEXT NOT NULL CHECK (type IN ('achat', 'vente')),
  date_transaction DATE NOT NULL,
  quantite NUMERIC NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC NOT NULL CHECK (prix_unitaire >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portefeuille_user ON portefeuille_transactions(user_id, date_transaction);

-- Analyses mensuelles du portefeuille : générées automatiquement, en attente de validation par Ella avant envoi
CREATE TABLE IF NOT EXISTS analyses_portefeuille (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mois DATE NOT NULL,
  contenu TEXT NOT NULL,
  valide BOOLEAN NOT NULL DEFAULT false,
  envoyee BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mois)
);
CREATE INDEX IF NOT EXISTS idx_analyses_valide ON analyses_portefeuille(valide, envoyee);

-- Blog : articles publiés, avec image, pensés pour être partagés sur LinkedIn/Facebook
CREATE TABLE IF NOT EXISTS articles_blog (
  id SERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  extrait TEXT,
  contenu TEXT NOT NULL,
  image_url TEXT,
  publie BOOLEAN NOT NULL DEFAULT false,
  date_publication DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_publie ON articles_blog(publie, date_publication DESC);

-- Ressources téléchargeables (formulaires SGI/SGO, guides...) : le fichier reste hébergé
-- ailleurs (Google Drive, etc.) — seul le lien est stocké ici, Railway ne conserve pas les fichiers uploadés.
CREATE TABLE IF NOT EXISTS ressources_documents (
  id SERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  categorie TEXT DEFAULT 'Formulaire',
  organisme TEXT,
  lien_url TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Annuaire des SGI/SGO de l'UEMOA
CREATE TABLE IF NOT EXISTS annuaire_sgi (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SGI', -- 'SGI' ou 'SGO'
  pays TEXT,
  investissement_initial_min TEXT,
  telephone TEXT,
  email TEXT,
  site_web TEXT,
  adresse TEXT,
  description TEXT,
  ordre INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE cours_quotidiens ADD COLUMN IF NOT EXISTS volume NUMERIC;

-- Indices BRVM (Composite, BRVM 30...), capturés en même temps que les cours du jour
CREATE TABLE IF NOT EXISTS indices_quotidiens (
  id SERIAL PRIMARY KEY,
  indice TEXT NOT NULL, -- 'BRVM-C' ou 'BRVM-30'
  date_indice DATE NOT NULL,
  valeur NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(indice, date_indice)
);
