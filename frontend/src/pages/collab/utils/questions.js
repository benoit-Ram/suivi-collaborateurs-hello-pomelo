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
  const DEFAULT_M = ['Retours sur les missions','Taux de staffing','Qualités','Axe d\'amélioration'];
  if ((settings?.questions_manager||[]).length > 0) {
    const qs = settings.questions_manager.map((q,i) => {
      const label = typeof q === 'object' ? (q.label || q.text || `Question ${i+1}`) : (q && !q.match(/^q\d+$/) ? q : DEFAULT_M[i] || `Question ${i+1}`);
      const type = typeof q === 'object' ? (q.type || 'texte') : 'texte';
      return {key:'q'+i, label, type};
    });
    return { keys: qs.map(q=>q.key), labels: qs.map(q=>q.label), questions: qs };
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
    return settings.questions_collab.map((q,i) => {
      const label = typeof q === 'object' ? (q.label || q.text || `Question ${i+1}`) : (q && !q.match(/^[cq]+\d+$/) ? q : DEFAULT_Q[i] || `Question ${i+1}`);
      const type = typeof q === 'object' ? (q.type || 'texte') : 'texte';
      return {key:'cq'+i, label, type};
    });
  }
  return DEFAULT_Q.map((q,i) => ({key:'cq'+i, label:q, type:'texte'}));
}
