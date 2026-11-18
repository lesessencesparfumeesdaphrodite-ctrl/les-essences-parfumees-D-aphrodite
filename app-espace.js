/* Mon espace : clientes, tâches, calendrier éditorial, anniversaires, filleules, finances.
   Utilise post(), esc(), code définis dans app.html. Les données sont gardées sur le téléphone (hors connexion). */
(function(){
var CH='aph-c-';
function cacheSet(k,v){try{localStorage.setItem(CH+k,JSON.stringify({t:Date.now(),d:v}));}catch(e){}}
function cacheGet(k){try{return JSON.parse(localStorage.getItem(CH+k));}catch(e){return null;}}
function $(id){return document.getElementById(id);}
function jolieDate(t){var d=new Date(t);return d.toLocaleDateString('fr-FR')+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
function eur(n){return String(Math.round(n*100)/100).replace('.',',')+' €';}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
/* lecture avec mémoire hors connexion */
function lire(nom,route,cb){
  var c=cacheGet(nom);
  if(c)cb(c.d,{cache:true,t:c.t});
  post(route).then(function(r){
    if(r.ok){cacheSet(nom,r.j);cb(r.j,{cache:false,t:Date.now()});}
    else if(!c)cb(null,{erreur:r.st===0?'Pas de réseau et rien en mémoire pour le moment.':(r.j.erreur||'Erreur')});
    else cb(c.d,{cache:true,t:c.t,horsligne:r.st===0});
  });
}
function etat(info){
  if(!info)return '';
  if(info.erreur)return '<p class="msg" style="color:#a3301f">'+esc(info.erreur)+'</p>';
  if(info.cache)return '<p class="maj">📴 Données du '+jolieDate(info.t)+(info.horsligne?' (pas de réseau)':' · mise à jour…')+'</p>';
  return '<p class="maj">✅ À jour ('+jolieDate(info.t)+')</p>';
}
/* écriture : mise en attente si pas de réseau */
function fileGet(){try{return JSON.parse(localStorage.getItem('aph-file')||'[]');}catch(e){return[];}}
function ecrire(route,body,done){
  post(route,body).then(function(r){
    if(r.st===0){var f=fileGet();f.push({route:route,body:body});try{localStorage.setItem('aph-file',JSON.stringify(f));}catch(e){}done({ok:true,differe:true});}
    else done(r);
  });
}
function vider(){
  var f=fileGet();if(!f.length||!code)return;
  try{localStorage.removeItem('aph-file');}catch(e){}
  var reste=[];
  (function n(i){
    if(i>=f.length){if(reste.length){try{localStorage.setItem('aph-file',JSON.stringify(reste));}catch(e){}}return;}
    post(f[i].route,f[i].body).then(function(r){if(r.st===0)reste.push(f[i]);n(i+1);});
  })(0);
}
window.addEventListener('online',vider);
window.viderFile=vider;
function copier(t,ok){
  function repli(){var a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(a);ok();}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,repli);else repli();
}
var ESPACE=window.ESPACE={};

/* =============== CLIENTES =============== */
var clPend=null,CL=[],clFiltre='',clType='',clOuvert=null,clInfo=null;
var TYPES={femme:'Femme',homme:'Homme',societe:'Société',famille:'Famille'};
function typeCli(c){
  var t=norm(c.type);if(TYPES[t])return t;
  if(c.lieu==='FAMILLE'||c.famille)return 'famille';
  if(/\b(sarl|sas|sasu|eurl|sci|association|mairie|entreprise|societe|boutique|institut|renovation|cabinet|garage|pharmacie|boulangerie|restaurant|ecole|menuiserie|plomberie|electricite|immobilier|agence|clinique|cse|batiment|construction|traiteur|pressing|coiffure|salon)\b/i.test(norm(c.nom)))return 'societe';
  return c.sexe==='M'?'homme':'femme';
}
function prodsHabituels(cs){
  var m={};
  cs.forEach(function(o){String(o.produits||'').split('\n').forEach(function(l){
    var r=/^\s*(\d+)\s*[×x]\s*(.+?)(?:\s+[—-]\s+[\d,. ]+€.*)?$/.exec(l);
    if(r){var n=r[2].replace(/\s+[—-]\s+.*$/,'').trim();m[n]=(m[n]||0)+(+r[1]);}
  });});
  return Object.keys(m).map(function(k){return[k,m[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
}
ESPACE.clients=function(){
  $('v-clients').innerHTML='<div class="liste" id="cl-zone"></div>';
  clOuvert=clPend||null;clPend=null;if(!clOuvert)clFrom=null;
  lire('clients','/app/clients',function(d,info){clInfo=info;if(d)CL=d.clients||[];dessCl();});
};
function dessCl(){
  var z=$('cl-zone');if(!z)return;
  if(clOuvert){var c=CL.filter(function(x){return x.id===clOuvert;})[0];if(c){z.innerHTML=ficheCl(c);return;}clOuvert=null;}
  var q=norm(clFiltre),n=0,html='',lettre='';
  var liste=CL.filter(function(c){
    if(clType&&typeCli(c)!==clType)return false;
    if(!q)return true;
    return norm(c.nom+' '+c.mail+' '+c.tel+' '+c.ville+' '+c.famille).indexOf(q)>=0;
  });
  liste.forEach(function(c){
    var L=norm(c.nom).charAt(0).toUpperCase();if(!/[A-Z]/.test(L))L='#';
    if(L!==lettre){lettre=L;html+='<div class="lettre">'+L+'</div>';}
    var t=typeCli(c);
    html+='<button class="rang t-'+t+'" onclick="ESPACE.ouvrirCl(\''+c.id+'\')"><span class="rn">'+esc(c.nom)+'</span><span class="rs">'+esc(c.ville||'')+(c.points?' · '+c.points+' pts':'')+'</span></button>';
  });
  var chips='<button class="chip'+(clType===''?' on':'')+'" onclick="ESPACE.typeCl(\'\')">Toutes</button>';
  Object.keys(TYPES).forEach(function(k){chips+='<button class="chip t-'+k+(clType===k?' on':'')+'" onclick="ESPACE.typeCl(\''+k+'\')">'+TYPES[k]+'</button>';});
  z.innerHTML='<h2 class="titre-g">Mes client(e)s</h2>'+etat(clInfo)
   +'<input id="cl-q" class="recherche" type="search" placeholder="🔍 Chercher un nom, une ville, un téléphone…" aria-label="Chercher un(e) client(e)" value="'+esc(clFiltre)+'" oninput="ESPACE.rechCl(this.value)">'
   +'<div class="chips">'+chips+'</div><p class="maj">'+liste.length+' fiche'+(liste.length>1?'s':'')+'</p>'+html;
}
ESPACE.rechCl=function(v){clFiltre=v;var p=document.activeElement;dessCl();var i=$('cl-q');if(i){i.focus();try{i.setSelectionRange(v.length,v.length);}catch(e){}}};
ESPACE.typeCl=function(t){clType=t;dessCl();};
ESPACE.ouvrirCl=function(id){clOuvert=id;dessCl();window.scrollTo(0,0);var z=$('cl-zone');if(z)z.scrollTop=0;};
ESPACE.fermerCl=function(){clOuvert=null;dessCl();};
function ligne(ic,l,v){return v?'<div class="fl"><span>'+ic+' '+l+'</span><b>'+v+'</b></div>':'';}
function ficheCl(c){
  var t=typeCli(c),auj=new Date().toISOString().slice(0,10);
  var hab=prodsHabituels(c.cmds);
  var bonsOk=c.bons.filter(function(b){return !b.utilise&&(!b.fin||b.fin>=auj)&&(b.type!=='Carte cadeau'||b.payee);});
  var bonsR=bonsOk.filter(function(b){return b.type!=='Carte cadeau';}),cartes=bonsOk.filter(function(b){return b.type==='Carte cadeau';});
  var h='<button class="petit sec" onclick="ESPACE.fermerCl()">← Tous les client(e)s</button>'
   +'<div class="fiche t-'+t+'"><div class="fh"><span class="tag">'+TYPES[t]+'</span><h2>'+esc(c.nom)+'</h2>'+(c.num?'<small>N° client '+esc(c.num)+'</small>':'')+'</div>';
  h+='<div class="actions">'+(c.tel?'<a class="btn-l" href="tel:'+esc(c.tel.replace(/\s/g,''))+'">📞 Appeler</a><a class="btn-l" href="sms:'+esc(c.tel.replace(/\s/g,''))+'">💬 SMS</a>':'')+(c.mail?'<a class="btn-l" href="mailto:'+esc(c.mail)+'">✉️ Écrire</a>':'')
   +'<button class="btn-l" onclick="ESPACE.bonPour(\''+c.id+'\')">📝 Bon de commande</button><button class="btn-l" onclick="ESPACE.editBox()">✏️ Modifier la fiche</button></div>'
   +'<div class="boite" id="edit-box" hidden><h3>✏️ Modifier la fiche</h3><div class="champs">'
   +ch('e-nom','Prénom NOM',c.nom)+ch('e-nn','Nom de naissance (nom de jeune fille)',c.nomNaiss)+ch('e-tel','Téléphone',c.tel)+ch('e-mail','Mail',c.mail)+ch('e-adr','Adresse',c.adresse)+ch('e-compl','Complément d\'adresse',c.compl)+ch('e-cp','Code postal',c.cp)+ch('e-ville','Ville',c.ville)+ch('e-naiss','Date de naissance',c.naiss,'date')
   +'<div><label for="e-sexe">Sexe</label><select id="e-sexe"><option value="F"'+(c.sexe!=='M'?' selected':'')+'>Femme</option><option value="M"'+(c.sexe==='M'?' selected':'')+'>Homme</option></select></div>'
   +'<div><label for="e-type">Type de fiche</label><select id="e-type">'+Object.keys(TYPES).map(function(k){return '<option value="'+TYPES[k]+'"'+(k===t?' selected':'')+'>'+TYPES[k]+'</option>';}).join('')+'</select></div>'
   +ch('e-fam','Nom de la famille (pour regrouper)',c.famille)+'</div>'
   +'<label for="e-rem" style="display:block;font-size:12.5px;font-weight:700;margin:10px 0 4px">Remarque</label><textarea id="e-rem" rows="3" style="width:100%;padding:10px;border:1.5px solid rgba(201,169,110,.7);border-radius:12px;font:inherit">'+esc(c.remarque)+'</textarea>'
   +'<button class="petit" onclick="ESPACE.enregCl(\''+c.id+'\')">Enregistrer</button><p id="e-msg" class="msg" role="status"></p></div>';
  h+=ligne('👰','Nom de naissance',esc(c.nomNaiss))+ligne('📞','Téléphone',esc(c.tel))+ligne('✉️','Mail',esc(c.mail))+ligne('🏠','Adresse',esc([c.adresse,c.compl,[c.cp,c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')))
   +ligne('🎂','Naissance',c.naiss?esc(new Date(c.naiss+'T12:00:00').toLocaleDateString('fr-FR')):'')
   +ligne('⭐','Points fidélité','<b>'+c.points+' pts</b>')
   +ligne('📍','Rencontrée','<span>'+esc(c.lieu)+'</span>')+ligne('🌸','Univers',esc(c.univers==='CREA'?'Créations':c.univers==='EXHA'?'EXHALESSENCE':''))
   +ligne('💻','Compte sur le site',c.compte?'✅ créé'+(c.compteLe?' le '+esc(new Date(c.compteLe+'T12:00:00').toLocaleDateString('fr-FR')):''):'❌ pas encore')
   +ligne('🧴','Diagnostic peau',esc(c.diag))+ligne('📦','BOX testée',esc(c.box))+ligne('🎁','Cadeau',esc(c.cadeau));
  if(c.remarque)h+='<div class="rem">📝 '+esc(c.remarque)+'</div>';
  h+='</div>';
  h+='<div class="boite"><h3>🎟️ Bons de réduction en cours</h3>'+(bonsR.length?bonsR.map(function(b){return '<div class="bon"><b>'+esc(b.code)+'</b> · '+b.montant+' € dès '+b.mini+' € · '+esc(b.type)+(b.fin?' · jusqu\'au '+esc(b.fin.split('-').reverse().join('/')):'')+'</div>';}).join(''):'<p class="vide">Aucun bon en cours.</p>')
   +'<h3 style="margin-top:12px">💳 Cartes cadeaux en cours</h3>'+(cartes.length?cartes.map(function(b){return '<div class="bon"><b>'+esc(b.code)+'</b> · '+b.montant+' €'+(b.fin?' · jusqu\'au '+esc(b.fin.split('-').reverse().join('/')):'')+'</div>';}).join(''):'<p class="vide">Aucune carte cadeau.</p>')+'</div>';
  h+='<div class="boite"><h3>🛍️ Ce qu\'elle commande souvent</h3>'+(hab.length?hab.map(function(p){return '<div class="hab"><span>'+esc(p[0])+'</span><b>× '+p[1]+'</b></div>';}).join(''):'<p class="vide">Pas encore de commande enregistrée.</p>')+'</div>';
  if(c.famille){
    var mem=CL.filter(function(x){return x.famille&&norm(x.famille)===norm(c.famille);}),all=[];
    mem.forEach(function(m){m.cmds.forEach(function(o){all.push(o);});});
    h+='<div class="boite t-famille"><h3>👨‍👩‍👧 Famille « '+esc(c.famille)+' »</h3><p class="vide">'+mem.map(function(m){return esc(m.nom);}).join(' · ')+'</p>'
      +(all.length?prodsHabituels(all).map(function(p){return '<div class="hab"><span>'+esc(p[0])+'</span><b>× '+p[1]+'</b></div>';}).join(''):'<p class="vide">Aucune commande de la famille.</p>')+'</div>';
  }
  h+='<div class="boite"><h3>📜 Historique des commandes ('+c.cmds.length+')</h3>'+(c.cmds.length?c.cmds.map(function(o){return '<div class="cmd"><div class="t"><strong>'+esc(o.numero)+' · '+esc(o.date)+'</strong><span>'+eur(o.total)+'</span></div><div class="s">'+esc(o.statut)+(o.origine?' · '+esc(o.origine):'')+'</div><div class="p">'+esc(o.produits)+'</div></div>';}).join(''):'<p class="vide">Aucune commande.</p>')+'</div>';
  return h;
}
function ch(id,l,v,ty){return '<div><label for="'+id+'">'+l+'</label><input id="'+id+'" type="'+(ty||'text')+'" value="'+esc(v||'')+'"></div>';}
ESPACE.enregCl=function(id){
  var c=CL.filter(function(x){return x.id===id;})[0];if(!c)return;
  var f={nom:$('e-nom').value.trim(),nomNaiss:$('e-nn').value.trim(),compl:$('e-compl').value.trim(),sexe:$('e-sexe').value,tel:$('e-tel').value.trim(),mail:$('e-mail').value.trim(),adresse:$('e-adr').value.trim(),cp:$('e-cp').value.trim(),ville:$('e-ville').value.trim(),naiss:$('e-naiss').value,remarque:$('e-rem').value,type:$('e-type').value,famille:$('e-fam').value.trim()};
  $('e-msg').textContent='Enregistrement…';
  ecrire('/app/client-maj',{id:id,champs:f},function(r){
    if(!r.ok){$('e-msg').textContent='⚠️ '+(r.j.erreur||'Erreur');return;}
    if(f.nom)c.nom=f.nom;c.nomNaiss=f.nomNaiss;c.compl=f.compl;c.sexe=f.sexe;c.tel=f.tel;c.mail=f.mail;c.adresse=f.adresse;c.cp=f.cp;c.ville=f.ville;c.naiss=f.naiss;c.remarque=f.remarque;c.type=f.type;c.famille=f.famille;
    cacheSet('clients',{clients:CL});
    $('e-msg').textContent=r.differe?'📴 Gardé sur le téléphone, envoyé à Notion dès que le réseau revient.':'✅ Enregistré dans Notion.';
  });
};
ESPACE.editBox=function(){var b=$('edit-box');if(!b)return;b.hidden=!b.hidden;if(!b.hidden)b.scrollIntoView({behavior:'smooth',block:'start'});};
ESPACE.bonPour=function(id){
  var c=CL.filter(function(x){return x.id===id;})[0];if(!c)return;
  var p=c.nom.split(/\s+/);
  var q='?prenom='+encodeURIComponent(p[0]||'')+'&nom='+encodeURIComponent(p.slice(1).join(' '))+'&mail='+encodeURIComponent(c.mail||'')+'&tel='+encodeURIComponent(c.tel||'');
  window._bonPref=true;$('f-bon').setAttribute('src','bon-salon.html'+q);aller('bon');
};

/* =============== TÂCHES =============== */
var TA=[],taInfo=null,taMsg='',taFin='';
function jourTa(e){return String(e||'').slice(0,10);}
ESPACE.taches=function(){
  $('v-taches').innerHTML='<div class="liste" id="ta-zone"></div>';
  lire('taches','/app/taches',function(d,info){taInfo=info;if(d)TA=d.taches||[];dessTa();});
};
function dessTa(){
  var z=$('ta-zone');if(!z)return;var auj=new Date().toISOString().slice(0,10);
  TA.forEach(function(t){t.echeance=jourTa(t.echeance);});
  var en=TA.filter(function(t){return t.etat!=='Terminé'&&t.etat!=='Archivé';}).sort(function(a,b){return (a.echeance||'9999').localeCompare(b.echeance||'9999');});
  var fi=TA.filter(function(t){return t.etat==='Terminé';}).sort(function(a,b){return (b.echeance||'').localeCompare(a.echeance||'');}).slice(0,15);
  function lg(t){var re=t.echeance&&t.echeance<auj&&t.etat!=='Terminé',e=t.etat==='Terminé'?'t':t.etat==='En cours'?'c':'p';
    return '<div class="tache'+(t.etat==='Terminé'?' fait':'')+'"><select class="etat-sel es-'+e+'" aria-label="État de la tâche : '+esc(t.nom)+'" onchange="ESPACE.etatTa(\''+t.id+'\',this.value)"><option value="Pas commencée"'+(e==='p'?' selected':'')+'>À faire</option><option value="En cours"'+(e==='c'?' selected':'')+'>En cours</option><option value="Terminé"'+(e==='t'?' selected':'')+'>Terminé</option></select><div><div class="tn">'+esc(t.nom)+'</div><div class="ts'+(re?' retard':'')+'">'+(t.type==='Publication'?'📱 Publication · ':'')+(t.echeance?(re?'⚠️ ':'')+esc(t.echeance.split('-').reverse().join('/')):'sans date')+'</div></div></div>';}
  z.innerHTML='<h2 class="titre-g">✅ Mes tâches</h2>'+etat(taInfo)+(taFin?'<p class="msg" role="status">'+esc(taFin)+'</p>':'')
   +(TA.length?'':'<p class="msg" style="color:#a3301f">Notion n\'a renvoyé aucune tâche (0 reçue). Dis-le moi : la connexion de l\'appli à cette page est à vérifier.</p>')+'<div class="boite"><h3>À faire ('+en.length+')</h3>'+(en.length?en.map(lg).join(''):'<p class="vide">Rien à faire, bravo ! 🌸</p>')+'</div>'
   +'<div class="boite"><h3>➕ Nouvelle tâche</h3><div class="champs"><div style="flex:2;min-width:200px"><label for="ta-n">La tâche</label><input id="ta-n" type="text"></div><div><label for="ta-d">Pour le</label><input id="ta-d" type="date"></div></div><button class="petit" onclick="ESPACE.ajoutTa()">Ajouter</button> '+(taMsg?'<span class="msg" role="status">'+esc(taMsg)+'</span>':'')+'</div>'
   +(fi.length?'<div class="boite"><h3>Terminées récemment</h3>'+fi.map(lg).join('')+'</div>':'');
}
ESPACE.etatTa=function(id,v){
  var t=TA.filter(function(x){return x.id===id;})[0];if(!t)return;
  t.etat=v;taMsg='';taFin=v==='Terminé'?'✅ « '+t.nom+' » est terminée : elle est dans « Terminées récemment » (en bas). Pour la remettre, change son état.':'';
  cacheSet('taches',{taches:TA});dessTa();
  ecrire('/app/tache-maj',{id:id,etat:v},function(r){if(!r.ok){taMsg='⚠️ '+(r.j.erreur||'Erreur');dessTa();}});
};
ESPACE.ajoutTa=function(){
  var n=$('ta-n').value.trim();if(!n){taMsg='Écrivez la tâche.';dessTa();return;}
  var d=$('ta-d').value;taMsg='Ajout…';
  ecrire('/app/tache-ajout',{nom:n,echeance:d,type:'Tâche'},function(r){
    if(!r.ok){taMsg='⚠️ '+(r.j.erreur||'Erreur');dessTa();return;}
    taMsg=r.differe?'📴 Sera ajoutée dès le retour du réseau.':'✅ Ajoutée.';
    TA.push({id:(r.j&&r.j.id)||'tmp'+Date.now(),nom:n,etat:'Pas commencée',echeance:d,type:'Tâche'});cacheSet('taches',{taches:TA});dessTa();
  });
};

/* =============== CALENDRIER ÉDITORIAL =============== */
var CA=[],caInfo=null,caTous=false,caFin='';
var CONSIGNE='Écris la publication ci-dessous pour Les Essences Parfumées d\'Aphrodite. Règles : respecter les 3 archétypes de contenu (Attraction pour accrocher, Qualification pour dire à qui ça s\'adresse avec une liste « C\'est fait pour vous si… », Conversion pour faire passer à l\'action : lien, contact, réservation, commande) ; après le texte, indiquer en une ligne comment les 3 archétypes sont remplis. Le texte est partagé tel quel sur Facebook, Instagram, TikTok et LinkedIn : gras uniquement en Unicode compatible Facebook (jamais d\'astérisques ni de Markdown), liens écrits en entier, emojis simples, texte pas trop long. Ne jamais écrire « artisanal » : écrire « fait main ». Terminer par la bonne conclusion et la bonne signature selon l\'univers.\n\nPublication à écrire : ';
ESPACE.calendrier=function(){
  $('v-calendrier').innerHTML='<div class="liste" id="ca-zone"></div>';
  lire('calendrier','/app/calendrier',function(d,info){caInfo=info;if(d)CA=d.items||[];dessCa();});
};
function dessCa(){
  var z=$('ca-zone');if(!z)return;var sect='',h='';
  CA.forEach(function(it,i){
    if(!caTous&&it.fait)return;
    if(it.section!==sect){sect=it.section;h+='<h3 class="sect">'+esc(sect||'Divers')+'</h3>';}
    var e=it.fait?'t':it.cours?'c':'p';
    h+='<div class="tache'+(it.fait?' fait':'')+'"><select class="etat-sel es-'+e+'" aria-label="État : '+esc(it.texte)+'" onchange="ESPACE.etatCa('+i+',this.value)"><option value="À faire"'+(e==='p'?' selected':'')+'>À faire</option><option value="En cours"'+(e==='c'?' selected':'')+'>En cours</option><option value="Terminé"'+(e==='t'?' selected':'')+'>Terminé</option></select><div style="flex:1"><div class="tn">'+esc(it.texte)+'</div></div><button class="mini" onclick="ESPACE.copierCa('+i+',this)">📋 Copier</button></div>';
  });
  var fin='';if(!caTous){CA.map(function(it,i){return{it:it,i:i};}).filter(function(x){return x.it.fait;}).slice(-10).reverse().forEach(function(x){fin+='<div class="tache fait"><select class="etat-sel es-t" aria-label="État : '+esc(x.it.texte)+'" onchange="ESPACE.etatCa('+x.i+',this.value)"><option value="À faire">À faire</option><option value="En cours">En cours</option><option value="Terminé" selected>Terminé</option></select><div style="flex:1"><div class="tn">'+esc(x.it.texte)+'</div></div></div>';});}
  var rest=CA.filter(function(x){return !x.fait;}).length;
  z.innerHTML='<h2 class="titre-g">📅 Calendrier éditorial</h2>'+etat(caInfo)+(caFin?'<p class="msg" role="status">'+esc(caFin)+'</p>':'')
   +'<p class="vide" style="text-align:center">'+rest+' publication'+(rest>1?'s':'')+' à faire. « Copier » prépare le texte à coller dans ChatGPT.</p>'
   +(CA.length?'':'<p class="msg" style="color:#a3301f">Notion n\'a renvoyé aucune ligne (0 reçue). Dis-le moi : la connexion de l\'appli à cette page est à vérifier.</p>')+'<div class="chips"><button class="chip'+(!caTous?' on':'')+'" onclick="ESPACE.voirCa(false)">À faire</button><button class="chip'+(caTous?' on':'')+'" onclick="ESPACE.voirCa(true)">Tout voir</button></div>'
   +'<div class="boite">'+(h||'<p class="vide">Tout est publié 🎉</p>')+'</div>'+(fin?'<div class="boite"><h3>Terminées récemment</h3>'+fin+'</div>':'');
}
ESPACE.voirCa=function(v){caTous=v;dessCa();};
ESPACE.etatCa=function(i,v){
  var it=CA[i];if(!it)return;it.fait=v==='Terminé';it.cours=v==='En cours';cacheSet('calendrier',{items:CA});
  caFin=v==='Terminé'?'✅ « '+it.texte+' » est terminée : elle est dans « Terminées récemment » (en bas). Pour la remettre, change son état.':'';dessCa();
  ecrire('/app/calendrier-coche',{id:it.id,etat:v},function(r){if(!r.ok){caFin='⚠️ '+((r.j&&r.j.erreur)||'Erreur');dessCa();}});
};
ESPACE.copierCa=function(i,b){
  var it=CA[i];if(!it)return;
  copier(CONSIGNE+it.texte+(it.section?'\n(Étape du calendrier : '+it.section+')':''),function(){b.textContent='✅ Copié';setTimeout(function(){b.textContent='📋 Copier';},1800);});
};

/* =============== ANNIVERSAIRES =============== */
var AN=[],anInfo=null;
function propre(n){return String(n||'').replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();}
function chipNom(n){var t=propre(n).split(/\s+/);if(t.length>=2&&t[0]===t[0].toUpperCase())return t[1]+' '+t[0].charAt(0)+'.';return t[0]||'';}
function cleN(s){return norm(s).split(/\s+/).filter(Boolean).sort().join(' ');}
function contactAn(a){
  var src=cacheGet(a.qui==='Filleule'?'filleules':'clients'),liste=src&&src.d?(a.qui==='Filleule'?src.d.filleules:src.d.clients)||[]:[],k=cleN(a.nom),mail='',tel=a.tel||'';
  for(var n=0;n<liste.length;n++){if(cleN(liste[n].nom)===k){mail=liste[n].mail||'';tel=liste[n].tel||'';break;}}
  if(mail&&a.qui!=='Filleule')return{k:'auto',t:'✉️ Mail automatique (part tout seul)'};
  if(mail)return{k:'mail',t:'✉️ Mail à envoyer',mail:mail};
  if(tel)return{k:'sms',t:'💬 SMS à envoyer',tel:tel};
  return{k:'non',t:'Pas d\'envoi (ni mail ni téléphone)'};
}
ESPACE.anniv=function(){
  ANM=null;
  $('v-anniv').innerHTML='<div class="liste" id="an-zone"></div>';
  lire('anniv','/app/anniv',function(d,info){anInfo=info;if(d)AN=(d.anniv||[]).map(function(a){a.nom=propre(a.nom);return a;});dessAn();});
  lire('clients','/app/clients',function(d){if(d)dessAn();});
  lire('filleules','/app/filleules',function(d){if(d)dessAn();});
};
var ANM=null,clFrom=null,fiPend=null,fiFrom=false;
ESPACE.ouvrirAn=function(i){
  var a=AN[i];if(!a)return;var fil=a.qui==='Filleule',src=cacheGet(fil?'filleules':'clients'),liste=src&&src.d?(fil?src.d.filleules:src.d.clients)||[]:[],k=cleN(a.nom),f=null;
  for(var n=0;n<liste.length;n++){if(cleN(liste[n].nom)===k){f=liste[n];break;}}
  if(!f){var z=$('an-zone');if(z&&!z.querySelector('.msg.intr'))z.insertAdjacentHTML('afterbegin','<p class="msg intr" style="color:#a3301f">Fiche de '+esc(a.nom)+' introuvable (le nom n\'est pas écrit pareil dans les fiches).</p>');return;}
  if(fil){fiPend=f.id;fiQ='';fiFrom=true;aller('filleules');}else{CL=liste;clPend=f.id;clFrom='anniv';aller('clients');}
};
ESPACE.moisAn=function(d){var t=new Date();if(!ANM)ANM={y:t.getFullYear(),m:t.getMonth()};if(d===0){ANM={y:t.getFullYear(),m:t.getMonth()};}else{var x=new Date(ANM.y,ANM.m+d,1);ANM={y:x.getFullYear(),m:x.getMonth()};}dessAn();};
function dessAn(){
  var z=$('an-zone');if(!z)return;var now=new Date();now.setHours(0,0,0,0);
  if(!ANM)ANM={y:now.getFullYear(),m:now.getMonth()};
  var Y=ANM.y,M=ANM.m,jm={};
  AN.forEach(function(a,ix){var p=a.date.split('-');if(+p[1]-1===M){a._i=ix;(jm[+p[2]]=jm[+p[2]]||[]).push(a);}});
  var prem=new Date(Y,M,1),dec=(prem.getDay()+6)%7,nb=new Date(Y,M+1,0).getDate(),cells='',tot=Math.ceil((dec+nb)/7)*7;
  var J=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
  for(var k=0;k<tot;k++){
    var jr=k-dec+1,ok=jr>=1&&jr<=nb,dt=new Date(Y,M,jr),auj=ok&&dt.getTime()===now.getTime(),we=(k%7)>=5;
    var evs=ok&&jm[jr]?jm[jr].map(function(a){return '<button class="ev '+(a.qui==='Filleule'?'fil':'cli')+'" onclick="ESPACE.ouvrirAn('+a._i+')" aria-label="Ouvrir la fiche de '+esc(a.nom)+'">🎂 '+esc(chipNom(a.nom))+'</button>';}).join(''):'';
    cells+='<div class="cj'+(ok?'':' hors')+(we?' we':'')+'"><span class="nj'+(auj?' auj':'')+'">'+(ok?jr:new Date(Y,M,jr).getDate())+'</span>'+evs+'</div>';
  }
  var L=[];Object.keys(jm).forEach(function(d){jm[d].forEach(function(a){L.push({a:a,j:+d});});});L.sort(function(x,y){return x.j-y.j;});
  var liste=L.map(function(x){var a=x.a,pr=chipNom(a.nom).split(' ')[0],c=contactAn(a),dt=new Date(Y,M,x.j),n=Math.round((dt-now)/864e5);
    var btn=c.k==='mail'?'<a class="mini" href="mailto:'+esc(c.mail)+'?subject='+encodeURIComponent('Joyeux anniversaire !')+'&body='+encodeURIComponent('Joyeux anniversaire '+pr+' ! Je pense à vous. Zulay — Les Essences Parfumées d\'Aphrodite')+'">Envoyer</a>':c.k==='sms'?'<a class="mini" href="sms:'+esc(c.tel.replace(/\s/g,''))+'?&body='+encodeURIComponent('Joyeux anniversaire '+pr+' ! Je pense à vous. Zulay — Les Essences Parfumées d\'Aphrodite')+'">Envoyer</a>':'';
    return '<div class="tache" style="cursor:pointer" onclick="if(!event.target.closest(\'a\'))ESPACE.ouvrirAn('+a._i+')"><div class="jour '+(a.qui==='Filleule'?'fil':'cli')+(n===0?' auj':'')+'">'+(n===0?'🎉':x.j+'<small>'+dt.toLocaleDateString('fr-FR',{month:'short'})+'</small>')+'</div><div style="flex:1"><div class="tn">'+esc(a.nom)+'</div><div class="ts">'+(a.qui==='Filleule'?'Filleul(e)':'Client(e)')+(n>=0?' · '+(n===0?'aujourd\'hui':n===1?'demain':'dans '+n+' jours'):'')+'</div><div class="ts"><span class="stat">'+c.t+'</span></div></div>'+btn+'</div>';}).join('');
  z.innerHTML='<h2 class="titre-g">Anniversaires</h2>'+etat(anInfo)+(AN.length?'':'<p class="msg" style="color:#a3301f">Notion n\'a renvoyé aucun anniversaire (0 reçu). Dis-le moi : la connexion de l\'appli à cette base est à vérifier.</p>')
   +'<div class="cal-nav"><button class="mini" onclick="ESPACE.moisAn(-1)" aria-label="Mois précédent">‹</button><b>'+MOIS[M]+' '+Y+'</b><button class="mini" onclick="ESPACE.moisAn(1)" aria-label="Mois suivant">›</button><button class="mini" onclick="ESPACE.moisAn(0)">Aujourd\'hui</button></div>'
   +'<div class="chips"><span class="ev cli" style="font-size:12px">Client(e)s</span><span class="ev fil" style="font-size:12px">Filleul(e)s</span></div>'
   +'<div class="cal"><div class="cal-h">'+J.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div class="cal-g">'+cells+'</div></div>'
   +'<div class="boite"><h3>Ce mois-ci ('+L.length+')</h3>'+(liste||'<p class="vide">Aucun anniversaire ce mois-ci.</p>')+'</div>';
}

/* =============== FILLEULES =============== */
var FI=[],fiInfo=null,fiQ='';
ESPACE.filleules=function(){if(!fiPend)fiFrom=false;
  $('v-filleules').innerHTML='<div class="liste" id="fi-zone"></div>';
  lire('filleules','/app/filleules',function(d,info){fiInfo=info;if(d)FI=d.filleules||[];dessFi();if(fiPend){var c=$('fc-'+fiPend);if(c){c.scrollIntoView({block:'start'});c.style.outline='2px solid #c9a96e';}fiPend=null;}});
};
function dateFr(d){return d?d.split('-').reverse().join('/'):'';}
function dessFi(){
  var z=$('fi-zone');if(!z)return;var q=norm(fiQ);
  var L=FI.filter(function(f){return !q||norm(f.nom+' '+f.ville+' '+f.tel).indexOf(q)>=0;});
  z.innerHTML='<h2 class="titre-g">Mes filleul(e)s</h2>'+etat(fiInfo)+'<input id="fi-q" class="recherche" type="search" placeholder="🔍 Chercher un(e) filleul(e)" aria-label="Chercher un(e) filleul(e)" value="'+esc(fiQ)+'" oninput="ESPACE.rechFi(this.value)">'
   +'<button class="petit" onclick="ESPACE.nouvFi()">➕ Ajouter un(e) filleul(e)</button><div id="fi-add" hidden class="boite" style="margin-top:8px"><div class="champs">'+ch('na-nom','Prénom NOM','')+ch('na-agr','N° d\'agrément','')+ch('na-tel','Téléphone','')+ch('na-mail','Mail','')+ch('na-ent','Date d\'entrée','','date')+'<div><label for="na-sexe">Sexe</label><select id="na-sexe"><option value="F">Femme</option><option value="M">Homme</option></select></div></div><button class="petit" onclick="ESPACE.ajoutFi()">Enregistrer ce(tte) filleul(e)</button> <span id="na-m" class="msg" role="status"></span></div>'
   +'<p class="maj">'+L.length+' filleul(e)'+(L.length>1?'s':'')+'</p>'+L.map(function(f){var id=f.id;return '<div class="boite t-'+(f.sexe==='M'?'homme':'femme')+'" id="fc-'+id+'"><b>'+esc(f.nom)+'</b>'+(f.agrement?' <span class="stat">N° agrément '+esc(f.agrement)+'</span>':'')+(f.nomNaiss?' <small>(née '+esc(f.nomNaiss)+')</small>':'')
   +'<label class="cn" for="fn-'+id+'" style="display:block;font-size:12.5px;font-weight:700;margin:8px 0 3px">Note</label><textarea id="fn-'+id+'" rows="2" placeholder="Écrire ici…" style="width:100%;padding:8px;border:1.5px solid rgba(201,169,110,.7);border-radius:12px;font:inherit" onchange="ESPACE.noteFi(\''+id+'\',this)">'+esc(f.notes)+'</textarea><span class="msg" id="fm-'+id+'" role="status"></span>'
   +ligne('📞','Téléphone',f.tel?'<a href="tel:'+esc(f.tel.replace(/\s/g,''))+'">'+esc(f.tel)+'</a>':'')+ligne('✉️','Mail',esc(f.mail))+ligne('🏠','Adresse',esc([f.adresse,f.compl,[f.cp,f.ville].filter(Boolean).join(' '),f.pays].filter(Boolean).join(', ')))
   +ligne('🎂','Naissance',esc(dateFr(f.naiss)))+ligne('📅','Entrée',esc(dateFr(f.entree)))
   +'<button class="petit sec" onclick="ESPACE.editFi(\''+id+'\')">✏️ Modifier la fiche</button>'
   +'<div id="fe-'+id+'" hidden style="margin-top:8px"><div class="champs">'+ch('fe-nom-'+id,'Prénom NOM',f.nom)+ch('fe-agr-'+id,'N° d\'agrément',f.agrement)+ch('fe-nn-'+id,'Nom de naissance (nom de jeune fille)',f.nomNaiss)+ch('fe-tel-'+id,'Téléphone',f.tel)+ch('fe-mail-'+id,'Mail',f.mail)+ch('fe-adr-'+id,'Adresse',f.adresse)+ch('fe-compl-'+id,'Complément d\'adresse',f.compl)+ch('fe-cp-'+id,'Code postal',f.cp)+ch('fe-ville-'+id,'Ville',f.ville)+ch('fe-pays-'+id,'Pays',f.pays)+ch('fe-naiss-'+id,'Date de naissance',f.naiss,'date')+ch('fe-ent-'+id,'Date d\'entrée',f.entree,'date')
   +'<div><label for="fe-sexe-'+id+'">Sexe</label><select id="fe-sexe-'+id+'"><option value="F"'+(f.sexe!=='M'?' selected':'')+'>Femme</option><option value="M"'+(f.sexe==='M'?' selected':'')+'>Homme</option></select></div></div>'
   +'<button class="petit" onclick="ESPACE.enregFi(\''+id+'\')">Enregistrer</button><p id="fx-'+id+'" class="msg" role="status"></p></div></div>';}).join('');
}
function majFi(id,champs,cb){
  ecrire('/app/filleule-maj',{id:id,champs:champs},function(r){
    if(!r.ok){cb('⚠️ '+(r.j.erreur||'Erreur'));return;}
    var f=FI.filter(function(x){return x.id===id;})[0];if(f)for(var k in champs)f[k]=champs[k];
    cacheSet('filleules',{filleules:FI});cb(r.differe?'📴 Gardé sur le téléphone, envoyé à Notion dès que le réseau revient.':'✅ Enregistré dans Notion.');
  });
}
ESPACE.noteFi=function(id,el){var m=$('fm-'+id);m.textContent='Enregistrement…';majFi(id,{notes:el.value},function(t){m.textContent=t;});};
ESPACE.editFi=function(id){var b=$('fe-'+id);if(b)b.hidden=!b.hidden;};
ESPACE.enregFi=function(id){
  var g=function(k){return $('fe-'+k+'-'+id).value.trim();};
  var c={nom:g('nom'),agrement:g('agr'),nomNaiss:g('nn'),tel:g('tel'),mail:g('mail'),adresse:g('adr'),compl:g('compl'),cp:g('cp'),ville:g('ville'),pays:g('pays'),naiss:g('naiss'),entree:g('ent'),sexe:g('sexe')};
  var m=$('fx-'+id);m.textContent='Enregistrement…';majFi(id,c,function(t){m.textContent=t;});
};
ESPACE.nouvFi=function(){var b=$('fi-add');if(b)b.hidden=!b.hidden;};
ESPACE.ajoutFi=function(){
  var g=function(k){return $(k).value.trim();},m=$('na-m');
  if(!g('na-nom')){m.textContent='Écrivez le prénom et le nom.';return;}
  var c={nom:g('na-nom'),agrement:g('na-agr'),tel:g('na-tel'),mail:g('na-mail'),entree:g('na-ent'),sexe:g('na-sexe')||'F'};
  m.textContent='Enregistrement…';
  ecrire('/app/filleule-ajout',{champs:c},function(r){
    if(!r.ok){m.textContent='⚠️ '+(r.j.erreur||'Erreur');return;}
    c.id=(r.j&&r.j.id)||'tmp'+Date.now();c.notes='';c.naiss='';c.nomNaiss='';c.adresse='';c.compl='';c.cp='';c.ville='';c.pays='';
    FI.push(c);FI.sort(function(a,b){return (a.nom||'').localeCompare(b.nom||'');});cacheSet('filleules',{filleules:FI});dessFi();
    var z=$('fi-add');if(z)z.hidden=true;
  });
};
ESPACE.rechFi=function(v){fiQ=v;dessFi();var i=$('fi-q');if(i){i.focus();try{i.setSelectionRange(v.length,v.length);}catch(e){}}};

/* =============== FINANCES EXHALESSENCE (données gardées dans l'app) =============== */
var FIN_TAB=null,FIN_AN=new Date().getFullYear(),PQ='',FINN=[],FINMSG='';
var MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
ESPACE.finances=function(){FIN_TAB=null;$('v-finances').innerHTML='<div class="liste" id="fin-zone"></div>';dessFin();lire('fin','/app/fin',function(d){if(d){FINN=d.lignes||[];if(FIN_TAB&&FIN_TAB!=='prix')dessFin();}});};
function dessFin(){
  var D=window.DONNEES_EXH,z=$('fin-zone');if(!z||!D)return;
  var h='<h2 class="titre-g">Suivi financier EXHALESSENCE</h2>';
  if(!FIN_TAB){z.innerHTML=h+'<div class="hubf"><button class="nv" onclick="ESPACE.tabFin(\'marge\')"><span>Déclaration de marge</span></button><button class="nv" onclick="ESPACE.tabFin(\'comm\')"><span>Points et commissions</span></button><button class="nv" onclick="ESPACE.tabFin(\'prix\')"><span>Points et prix par produit</span></button></div>';return;}
  h+='<h3 class="sect" style="text-align:center">'+({prix:'Points et prix par produit',comm:'Points et commissions',marge:'Déclaration de marge'})[FIN_TAB]+'</h3>';
  if(FIN_TAB==='prix'){
    var q=norm(PQ);
    h+='<input id="pq" class="recherche" type="search" placeholder="🔍 Chercher un produit" aria-label="Chercher un produit" value="'+esc(PQ)+'" oninput="ESPACE.rechP(this.value)"><p class="vide">Prix conseillère : −50 % sur parfums et beauté, −30 % sur Home. Cases « — » : points à compléter.</p>';
    D.produits.forEach(function(g){
      var it=g.items.filter(function(i){return !q||norm(i.nom).indexOf(q)>=0;});if(!it.length)return;
      h+='<div class="boite"><h3>'+esc(g.titre)+'</h3><div class="tab"><div class="th"><span>Produit</span><span>Pts</span><span>Cons.</span><span>Client</span></div>'+it.map(function(i){return '<div class="tr"><span>'+esc(i.nom)+'</span><span>'+(i.pts==null?'—':i.pts)+'</span><span>'+eur(i.cons)+'</span><span>'+eur(i.client)+'</span></div>';}).join('')+'</div></div>';
    });
  }else{
    h+=tabEdit(FIN_TAB,FIN_AN,'ESPACE.anFin');
  }
  z.innerHTML=h;
}
ESPACE.tabFin=function(t){FIN_TAB=t;FINMSG='';dessFin();};

var TYPE_N={marge:'Marge EXHA',comm:'Points EXHA',urssaf:'URSSAF créations'};
var KEYS={marge:['ventes','achats','commission'],comm:['perso','reseau','total','commission'],urssaf:['ventes','achats','paypal','declaration','paiement']};
function statRow(type,an,m){var D=window.DONNEES_EXH,C=window.DONNEES_CREA;var src=type==='marge'?D.marges:type==='comm'?D.commissions:C.urssaf;return ((src||{})[an]||[])[m]||[];}
function ligneFin(type,an,m){return FINN.filter(function(x){return x.type===TYPE_N[type]&&x.annee===an&&x.mois===m+1;})[0];}
function fv(type,an,m){var st=statRow(type,an,m),ln=ligneFin(type,an,m);return KEYS[type].map(function(k,i){return ln&&ln[k]!=null?ln[k]:(st[i]!==undefined?st[i]:null);});}
function cel(type,an,m,i,v,lib){return '<input class="cel" inputmode="decimal" aria-label="'+esc(lib+' '+MOIS[m]+' '+an)+'" value="'+(v==null?'':esc(String(v).replace('.',',')))+'" onchange="ESPACE.celFin(\''+type+'\','+an+','+m+','+i+',this)">';}
function anneesFin(type){
  var D=window.DONNEES_EXH,C=window.DONNEES_CREA,src=type==='marge'?D.marges:type==='comm'?D.commissions:C.urssaf,s={};
  Object.keys(src||{}).forEach(function(a){s[a]=1;});FINN.forEach(function(x){if(x.type===TYPE_N[type])s[x.annee]=1;});s[new Date().getFullYear()]=1;s[new Date().getFullYear()+1]=1;
  return Object.keys(s).map(Number).sort(function(a,b){return b-a;});
}
function tabEdit(type,an,fnAn){
  var D=window.DONNEES_EXH,m,r,h='',tot=[];
  h+='<div class="chips">'+anneesFin(type).map(function(a){return '<button class="chip'+(a===an?' on':'')+'" onclick="'+fnAn+'('+a+')">'+a+'</button>';}).join('')+'</div>';
  if(FINMSG)h+='<p class="msg" role="status">'+esc(FINMSG)+'</p>';
  var labs={marge:['Ventes','Achats','Solde','Commission'],comm:['Perso','Réseau','Total','Commission'],urssaf:['Ventes','Achats','PayPal','Déclar.','Payé']};
  var ks=KEYS[type],nc=ks.length+(type==='marge'?1:0),cls=nc===4?'c5':nc===5?'c5':'c6';
  if(type==='comm')cls='c5';if(type==='marge')cls='c5';if(type==='urssaf')cls='c6';
  h+='<div class="boite"><h3>Année '+an+'</h3><p class="vide">Touche une case pour écrire ou corriger : c\'est enregistré tout de suite dans Notion.</p><div class="tab"><div class="th '+cls+'"><span>Mois</span>'+labs[type].map(function(l){return '<span>'+l+'</span>';}).join('')+'</div>';
  var T=[0,0,0,0,0,0];
  for(m=0;m<12;m++){
    r=fv(type,an,m);var cells='';
    if(type==='marge'){T[0]+=r[0]||0;T[1]+=r[1]||0;T[2]+=r[2]||0;cells=cel(type,an,m,0,r[0],'Ventes')+cel(type,an,m,1,r[1],'Achats')+'<span>'+eur((r[0]||0)-(r[1]||0))+'</span>'+cel(type,an,m,2,r[2],'Commission');}
    else{r.forEach(function(v,i){T[i]+=v||0;cells+=cel(type,an,m,i,v,labs[type][i]);});}
    h+='<div class="tr '+cls+'"><span>'+MOIS[m].slice(0,4)+'.</span>'+cells+'</div>';
  }
  var tl=type==='marge'?[eur(T[0]),eur(T[1]),eur(T[0]-T[1]),eur(T[2])]:type==='comm'?[T[0],T[1],T[2],eur(T[3])]:T.slice(0,5).map(eur);
  h+='<div class="tr '+cls+' tot"><span>Total</span>'+tl.map(function(v){return '<span>'+v+'</span>';}).join('')+'</div></div></div>';
  if(type==='marge')h+='<p class="vide">Avant 2023 : '+Object.keys(D.anciennesMarges).map(function(k){return k+' — '+D.anciennesMarges[k];}).join(' · ')+'.</p>';
  return h;
}
ESPACE.celFin=function(type,an,m,i,el){
  var raw=el.value.trim().replace(',','.').replace(/\s/g,''),v=raw===''?0:parseFloat(raw);
  if(isNaN(v)){el.style.borderColor='#a3301f';FINMSG='⚠️ Écris seulement un nombre.';return;}
  var k=KEYS[type][i],ln=ligneFin(type,an,m);if(!ln){ln={type:TYPE_N[type],annee:an,mois:m+1};FINN.push(ln);}
  ln[k]=v;var vals={};vals[k]=v;cacheSet('fin',{lignes:FINN});FINMSG='Enregistrement…';
  var redraw=function(){if(type==='urssaf')dessUr();else dessFin();};redraw();
  ecrire('/app/fin-maj',{type:TYPE_N[type],annee:an,mois:m+1,vals:vals},function(r){FINMSG=!r.ok?'⚠️ '+(r.j.erreur||'Erreur'):(r.differe?'📴 Gardé sur le téléphone, envoyé à Notion dès que le réseau revient.':'✅ Enregistré dans Notion.');redraw();});
};
ESPACE.anFin=function(a){FIN_AN=a;FINMSG='';dessFin();};
ESPACE.rechP=function(v){PQ=v;dessFin();var i=$('pq');if(i){i.focus();try{i.setSelectionRange(v.length,v.length);}catch(e){}}};

/* =============== PAGES D'ACTIVITÉ =============== */
ESPACE.retourInterne=function(v){
  if(v==='filleules'&&fiFrom){fiFrom=false;aller('anniv',true);return true;}
  if(v==='clients'&&clOuvert){clOuvert=null;if(clFrom){clFrom=null;aller('anniv');return true;}dessCl();return true;}
  if(v==='finances'&&FIN_TAB){FIN_TAB=null;dessFin();return true;}
  return false;
};
ESPACE.tarifs=function(){
  var D=window.DONNEES_CREA,z=$('v-tarifs');
  z.innerHTML='<div class="liste"><h2 class="titre-g">Tarifs finitions et suppléments</h2><p class="vide" style="text-align:center">Ces suppléments s\'ajoutent au prix de vente brut.</p>'
   +'<div class="boite"><h3>Finition (type de plâtre)</h3>'+D.finitions.map(function(f){return '<div class="hab"><span>'+esc(f[0])+'</span><b>'+eur(f[1])+'</b></div>';}).join('')+'</div>'
   +'<div class="boite"><h3>Suppléments de personnalisation (prix unitaire)</h3>'+D.supplements.map(function(f){return '<div class="hab"><span>'+esc(f[0])+'</span><b>'+eur(f[1])+'</b></div>';}).join('')+'</div>'
   +'<div class="boite"><h3>Comment le prix est calculé</h3>'+D.formules.map(function(f){return '<p class="vide" style="margin:6px 0">'+esc(f)+'</p>';}).join('')+'</div></div>';
};
var UR_AN=new Date().getFullYear();
function dessUr(){var z=$('v-urssaf');if(!z)return;
  z.innerHTML='<div class="liste"><h2 class="titre-g">Ventes et URSSAF (créations)</h2><p class="vide" style="text-align:center">Uniquement tes créations plâtre résine.</p>'+tabEdit('urssaf',UR_AN,'ESPACE.anUr')+'<p class="vide">Ventes = payé par les clients · Achats = pour tes créations · PayPal = reçu après frais · Déclar. = chiffre déclaré à l\'URSSAF · Payé = versé à l\'URSSAF.</p></div>';}
ESPACE.anUr=function(a){UR_AN=a;FINMSG='';dessUr();};
ESPACE.urssaf=function(){FINMSG='';dessUr();lire('fin','/app/fin',function(d){if(d){FINN=d.lignes||[];dessUr();}});};

/* =============== GUIDE OLFACTIF (copie privée gardée dans ton Notion, lue avec le code de l'application : aucun autre code) =============== */
var GD=null,GD_Q='',GD_MSG='';
try{localStorage.removeItem('aph-gd-code');localStorage.removeItem('aph-gd-enc');}catch(x){}
function gdNorm(e){return String(e||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b1 million\b/g,'one million');}
function gdMatch(e,t){return t.split(' ').every(function(x){return /^\d+$/.test(x)?new RegExp('(^| )'+x+'( |$)').test(e):e.indexOf(x)>=0;});}
function gdMsg(t){var m=$('gd-m');if(m)m.textContent=t||'';}
function dessGd(){var z=$('v-guide');if(!z)return;
  var h='<div class="liste"><h2 class="titre-g">Guide olfactif</h2>';
  if(!GD){
    h+='<p class="vide" style="text-align:center" role="status">'+esc(GD_MSG||'Ouverture…')+'</p>';
  }else{
    h+='<input id="gd-q" class="recherche" type="search" placeholder="🔍 Un parfum ou une référence (ex. 100)" aria-label="Rechercher une référence ou un parfum" value="'+esc(GD_Q)+'" oninput="ESPACE.gdRech(this.value)"><p class="vide" id="gd-n" role="status"></p><div id="gd-res"></div>';
  }
  z.innerHTML=h+'</div>';if(GD)gdResultats();
}
function gdResultats(){var e=gdNorm(GD_Q),n=$('gd-n'),t=$('gd-res');if(!n||!t)return;
  if(e.length<2){n.textContent='Tape au moins 2 lettres, ou une référence (ex. 100).';t.innerHTML='';return;}
  var a=GD.filter(function(x){return gdMatch(x.txt,e);});
  n.textContent=a.length?a.length+' référence'+(a.length>1?'s':''):'Aucun résultat.';
  t.innerHTML=a.slice(0,80).map(function(x){return '<div class="boite"><b style="font-size:18px">Réf. '+esc(x.ref)+'</b><br><small>'+esc([x.g,x.fam,x.note].filter(Boolean).join(' · '))+'</small><ul style="margin:6px 0 0;padding-left:18px;line-height:1.7">'+x.eq.map(function(q){return '<li>'+esc(q)+'</li>';}).join('')+'</ul></div>';}).join('');
}
ESPACE.gdRech=function(v){GD_Q=v;gdResultats();};
ESPACE.guide=function(){
  if(!GD){GD_MSG='Ouverture…';dessGd();}
  lire('guide','/app/guide',function(d,info){
    if(d&&d.eq&&d.eq.length){
      var neuf=!GD;
      GD=d.eq.map(function(e){e.txt=gdNorm('ref '+e.ref+' '+e.eq.join(' ')+' '+(e.fam||'')+' '+(e.g||''));return e;});
      if(neuf)dessGd();else gdResultats();
    }else if(!GD){GD_MSG=(info&&info.erreur)||'Le guide n\'est pas disponible pour le moment.';dessGd();}
  });
};
})();
