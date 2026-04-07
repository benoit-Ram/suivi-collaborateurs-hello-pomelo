/** Récupère les objectifs d'équipe depuis les settings pour les équipes données */
export function getTeamObjectives(equipes, settings) {
  const teamObjs = [];
  (equipes||[]).forEach(eq => {
    (settings['team_objectifs_'+eq]||[]).forEach(o => {
      teamObjs.push({...(typeof o==='string'?{titre:o,progression:0,dateDebut:'',dateFin:''}:o), equipe:eq});
    });
  });
  return teamObjs;
}

/** Récupère les questions manager depuis les settings ou les questions par défaut */
export function getManagerQuestions(settings) {
  if ((settings?.questions_manager||[]).length > 0) {
    return {
      keys: settings.questions_manager.map((_,i) => 'q'+i),
      labels: settings.questions_manager.map(q => q.label||q),
      questions: settings.questions_manager.map((q,i) => ({key:'q'+i, label:q.label||q, type:q.type||'texte'})),
    };
  }
  const defaults = ['Retours sur les missions','Taux de staffing','Qualités','Axe d\'amélioration'];
  return {
    keys: ['retoursMissions','tauxStaffing','qualites','axeAmelioration'],
    labels: defaults,
    questions: defaults.map((l,i) => ({key:['retoursMissions','tauxStaffing','qualites','axeAmelioration'][i], label:l, type:'texte'})),
  };
}

/** Récupère les questions collab depuis les settings ou les questions par défaut */
export function getCollabQuestions(settings) {
  const DEFAULT_Q = ['Comment t\'es-tu senti(e) au travail ?','Réussites du mois','Objectifs M-1 atteints ?','Suggestions process','Objectifs mois suivant','Autres sujets','Axe d\'amélioration'];
  if ((settings?.questions_collab||[]).length > 0) {
    return settings.questions_collab.map((q,i) => ({key:'cq'+i, label:q.label||q, type:q.type||'texte'}));
  }
  return DEFAULT_Q.map((q,i) => ({key:'cq'+i, label:q, type:'texte'}));
}
