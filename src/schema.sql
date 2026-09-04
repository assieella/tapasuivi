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

-- Signature numérique du contrat d'accompagnement BRVM Starter
ALTER TABLE users ADD COLUMN IF NOT EXISTS contrat_signe_le TIMESTAMP;

-- Réinitialisation de mot de passe en autonomie (client comme admin)
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Données financières fondamentales par société et par année (saisie annuelle/semestrielle),
-- base du futur Score TAPA INVEST — chiffre d'affaires, bénéfice, capitaux propres, dettes.
CREATE TABLE IF NOT EXISTS donnees_financieres (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker) ON DELETE CASCADE,
  annee INTEGER NOT NULL,
  chiffre_affaires NUMERIC,
  benefice_net NUMERIC,
  capitaux_propres NUMERIC,
  dettes_totales NUMERIC,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ticker, annee)
);

-- Statut de validation des données financières — les saisies faites par un compte "saisie"
-- (freelance) restent en attente jusqu'à validation par l'admin. Les saisies admin sont
-- considérées validées d'office.
ALTER TABLE donnees_financieres ADD COLUMN IF NOT EXISTS valide BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE donnees_financieres ADD COLUMN IF NOT EXISTS saisi_par TEXT;

-- Journal de suivi par client — trace toutes les tâches effectuées et échanges avec le client
-- (dossiers remplis, analyses envoyées, appels passés, etc.), visible par l'admin ET le client.
CREATE TABLE IF NOT EXISTS journal_suivi (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_action DATE NOT NULL DEFAULT CURRENT_DATE,
  titre TEXT NOT NULL,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'termine', -- 'termine', 'en_cours', 'a_faire'
  cree_par TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_client ON journal_suivi(client_id);

-- Date de saisie du dividende — permet de savoir si un dividende a été annoncé/ajouté récemment,
-- utile pour le rapport hebdomadaire personnalisé par client.
ALTER TABLE dividendes_historique ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Suivi du dernier rapport hebdomadaire envoyé à chaque client, pour ne jamais en envoyer deux
-- dans la même semaine.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dernier_rapport_hebdo_le DATE;

-- Actualités du marché BRVM générées par l'agent de veille — toujours en brouillon
-- jusqu'à validation par TAPA CONSEIL, jamais publiées automatiquement.
CREATE TABLE IF NOT EXISTS actualites_marche (
  id SERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  valide BOOLEAN NOT NULL DEFAULT false,
  publiee_le TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fonds OPCVM/FCP (gérés par les SGO) — une catégorie de produit différente des actions
-- individuelles, pour les clients qui préfèrent une gestion collective.
CREATE TABLE IF NOT EXISTS fonds_opcvm (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  societe_gestion TEXT,
  categorie TEXT, -- ex: 'Dynamique', 'Prudent', 'Diversifié'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Valeur liquidative et performances, mises à jour périodiquement (pas quotidien comme les
-- actions) — les pourcentages de performance sont saisis tels que publiés par la source,
-- jamais recalculés nous-mêmes.
CREATE TABLE IF NOT EXISTS vl_historique (
  id SERIAL PRIMARY KEY,
  fonds_id INTEGER NOT NULL REFERENCES fonds_opcvm(id) ON DELETE CASCADE,
  date_vl DATE NOT NULL,
  valeur_liquidative NUMERIC,
  perf_ytd NUMERIC,
  perf_1an NUMERIC,
  perf_3ans NUMERIC,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(fonds_id, date_vl)
);

-- Portefeuille virtuel — argent fictif, permet de s'entraîner à passer des ordres d'achat/vente
-- sans aucun risque réel. Capital de départ : 1 000 000 FCFA fictif par client.
CREATE TABLE IF NOT EXISTS portefeuille_virtuel_solde (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  solde_fictif NUMERIC NOT NULL DEFAULT 1000000,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portefeuille_virtuel_ordres (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL REFERENCES titres_brvm(ticker),
  type TEXT NOT NULL, -- 'achat' ou 'vente'
  quantite INTEGER NOT NULL,
  prix_execution NUMERIC NOT NULL,
  frais NUMERIC NOT NULL DEFAULT 0,
  date_ordre TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pv_ordres_user ON portefeuille_virtuel_ordres(user_id);

-- Réservations pour la formation en présentiel (retour prévu à partir de février 2027,
-- chaque fin de mois) — simple capture nom/prénom/WhatsApp, pas de compte créé.
CREATE TABLE IF NOT EXISTS reservations_presentiel (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  contactee BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Test TAPA "Suis-je prête à investir ?" — outil de génération de leads, accessible sans
-- compte. Le score/résultat n'est révélé qu'après avoir renseigné l'email (capture du lead).
CREATE TABLE IF NOT EXISTS test_tapa_reponses (
  id SERIAL PRIMARY KEY,
  prenom TEXT,
  email TEXT NOT NULL,
  whatsapp TEXT,
  score INTEGER NOT NULL,
  palier TEXT NOT NULL, -- 'pret', 'presque_pret', 'pas_encore'
  contacte BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Types d'ordre pour le portefeuille virtuel : "marche" (exécution immédiate) ou "limite"
-- (attend que le cours atteigne le seuil fixé). Un ordre à cours limité reste "en_attente"
-- tant que la condition n'est pas remplie.
ALTER TABLE portefeuille_virtuel_ordres ALTER COLUMN prix_execution DROP NOT NULL;
ALTER TABLE portefeuille_virtuel_ordres ADD COLUMN IF NOT EXISTS type_ordre TEXT NOT NULL DEFAULT 'marche';
ALTER TABLE portefeuille_virtuel_ordres ADD COLUMN IF NOT EXISTS prix_limite NUMERIC;
ALTER TABLE portefeuille_virtuel_ordres ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'execute';
