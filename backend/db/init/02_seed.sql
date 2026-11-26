-- Seed minimal pour tester le refactor Kysely en local.
-- Juste le super admin + les settings de base.

-- Super admin
INSERT INTO public.collaborateurs (prenom, nom, poste, email, is_admin, date_entree, solde_reference_date)
VALUES ('Benoit', 'de Rambuteau', 'Dirigeant', 'benoit@hello-pomelo.com', true, '2018-01-01', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Settings par défaut
INSERT INTO public.settings (key, value) VALUES
  ('absence_types', '[
    {"key":"conge","label":"Congé payé","decompte":true},
    {"key":"maladie","label":"Maladie","decompte":false},
    {"key":"formation","label":"Formation / Cours","decompte":false},
    {"key":"sans_solde","label":"Sans solde","decompte":false},
    {"key":"autre","label":"Autre","decompte":false}
  ]'::jsonb),
  ('periodes_fermeture', '[]'::jsonb),
  ('questions_manager', '[
    {"type":"texte","label":"Taux de staffing mensuel","groupes":["support","staffable"],"obligatoire":true},
    {"type":"texte","label":"Retours sur les missions","groupes":["support","staffable"],"obligatoire":true},
    {"type":"texte","label":"Un axe d''amélioration","groupes":["staffable","support"],"obligatoire":true}
  ]'::jsonb),
  ('questions_collab', '[
    {"type":"texte","label":"Quelles sont tes réussites ce mois-ci ?","groupes":["support","staffable"],"obligatoire":true},
    {"type":"texte","label":"Objectifs et priorités pour le mois à venir ?","groupes":["support","staffable"],"obligatoire":true},
    {"type":"texte","label":"Souhaites-tu t''investir dans d''autres sujets au sein de HP ?","groupes":["support","staffable"],"obligatoire":true}
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
