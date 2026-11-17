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
var CL=[],clFiltre='',clType='',clOuvert=null,clInfo=null;
var TYPES={femme:'Femme',homme:'Homme',societe:'Société',famille:'Famille'};
function typeCli(c){
  var t=norm(c.type);if(TYPES[t])return t;
  if(c.lieu==='FAMILLE'||c.famille)return 'famille';
  if(/\b(sarl|sas|sasu|eurl|sci|association|mairie|entreprise|societe|boutique|salon de|institut)\b/i.test(norm(c.nom)))return 'societe';
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
  clOuvert=null;
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
  z.innerHTML='<h2 class="titre-g">👩 Mes clientes</h2>'+etat(clInfo)
   +'<input id="cl-q" class="recherche" type="search" placeholder="🔍 Chercher un nom, une ville, un téléphone…" aria-label="Chercher une cliente" value="'+esc(clFiltre)+'" oninput="ESPACE.rechCl(this.value)">'
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
  var h='<button class="petit sec" onclick="ESPACE.fermerCl()">← Toutes les clientes</button>'
   +'<div class="fiche t-'+t+'"><div class="fh"><span class="tag">'+TYPES[t]+'</span><h2>'+esc(c.nom)+'</h2>'+(c.num?'<small>N° client '+esc(c.num)+'</small>':'')+'</div>';
  h+='<div class="actions">'+(c.tel?'<a class="btn-l" href="tel:'+esc(c.tel.replace(/\s/g,''))+'">📞 Appeler</a><a class="btn-l" href="sms:'+esc(c.tel.replace(/\s/g,''))+'">💬 SMS</a>':'')+(c.mail?'<a class="btn-l" href="mailto:'+esc(c.mail)+'">✉️ Écrire</a>':'')
   +'<button class="btn-l" onclick="ESPACE.bonPour(\''+c.id+'\')">📝 Bon de commande</button></div>';
  h+=ligne('📞','Téléphone',esc(c.tel))+ligne('✉️','Mail',esc(c.mail))+ligne('🏠','Adresse',esc([c.adresse,c.compl,[c.cp,c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')))
   +ligne('🎂','Naissance',c.naiss?esc(new Date(c.naiss+'T12:00:00').toLocaleDateString('fr-FR')):'')
   +ligne('⭐','Points fidélité','<b>'+c.points+' pts</b>'+(c.carte&&c.carte!=='------'?' · '+esc(c.carte):''))
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
  h+='<div class="boite"><h3>✏️ Modifier la fiche</h3><div class="champs">'
   +ch('e-tel','Téléphone',c.tel)+ch('e-mail','Mail',c.mail)+ch('e-adr','Adresse',c.adresse)+ch('e-cp','Code postal',c.cp)+ch('e-ville','Ville',c.ville)+ch('e-naiss','Date de naissance',c.naiss,'date')
   +'<div><label for="e-type">Type de fiche</label><select id="e-type">'+Object.keys(TYPES).map(function(k){return '<option value="'+TYPES[k]+'"'+(k===t?' selected':'')+'>'+TYPES[k]+'</option>';}).join('')+'</select></div>'
   +ch('e-fam','Nom de la famille (pour regrouper)',c.famille)+'</div>'
   +'<label for="e-rem" style="display:block;font-size:12.5px;font-weight:700;margin:10px 0 4px">Remarque</label><textarea id="e-rem" rows="3" style="width:100%;padding:10px;border:1.5px solid rgba(201,169,110,.7);border-radius:12px;font:inherit">'+esc(c.remarque)+'</textarea>'
   +'<button class="petit" onclick="ESPACE.enregCl(\''+c.id+'\')">Enregistrer</button><p id="e-msg" class="msg" role="status"></p></div>';
  return h;
}
function ch(id,l,v,ty){return '<div><label for="'+id+'">'+l+'</label><input id="'+id+'" type="'+(ty||'text')+'" value="'+esc(v||'')+'"></div>';}
ESPACE.enregCl=function(id){
  var c=CL.filter(function(x){return x.id===id;})[0];if(!c)return;
  var f={tel:$('e-tel').value.trim(),mail:$('e-mail').value.trim(),adresse:$('e-adr').value.trim(),cp:$('e-cp').value.trim(),ville:$('e-ville').value.trim(),naiss:$('e-naiss').value,remarque:$('e-rem').value,type:$('e-type').value,famille:$('e-fam').value.trim()};
  $('e-msg').textContent='Enregistrement…';
  ecrire('/app/client-maj',{id:id,champs:f},function(r){
    if(!r.ok){$('e-msg').textContent='⚠️ '+(r.j.erreur||'Erreur');return;}
    c.tel=f.tel;c.mail=f.mail;c.adresse=f.adresse;c.cp=f.cp;c.ville=f.ville;c.naiss=f.naiss;c.remarque=f.remarque;c.type=f.type;c.famille=f.famille;
    cacheSet('clients',{clients:CL});
    $('e-msg').textContent=r.differe?'📴 Gardé sur le téléphone, envoyé à Notion dès que le réseau revient.':'✅ Enregistré dans Notion.';
  });
};
ESPACE.bonPour=function(id){
  var c=CL.filter(function(x){return x.id===id;})[0];if(!c)return;
  var p=c.nom.split(/\s+/);
  var q='?prenom='+encodeURIComponent(p[0]||'')+'&nom='+encodeURIComponent(p.slice(1).join(' '))+'&mail='+encodeURIComponent(c.mail||'')+'&tel='+encodeURIComponent(c.tel||'');
  window._bonPref=true;$('f-bon').setAttribute('src','bon-salon.html'+q);aller('bon');
};

/* =============== TÂCHES =============== */
var TA=[],taInfo=null,taMsg='';
ESPACE.taches=function(){
  $('v-taches').innerHTML='<div class="liste" id="ta-zone"></div>';
  lire('taches','/app/taches',function(d,info){taInfo=info;if(d)TA=d.taches||[];dessTa();});
};
function dessTa(){
  var z=$('ta-zone');if(!z)return;var auj=new Date().toISOString().slice(0,10);
  var en=TA.filter(function(t){return t.etat!=='Terminé'&&t.etat!=='Archivé';}).sort(function(a,b){return (a.echeance||'9999').localeCompare(b.echeance||'9999');});
  var fi=TA.filter(function(t){return t.etat==='Terminé';}).sort(function(a,b){return (b.echeance||'').localeCompare(a.echeance||'');}).slice(0,15);
  function lg(t){var re=t.echeance&&t.echeance<auj&&t.etat!=='Terminé';
    return '<div class="tache'+(t.etat==='Terminé'?' fait':'')+'"><button class="coche'+(t.etat==='Terminé'?' on':'')+'" role="checkbox" aria-checked="'+(t.etat==='Terminé')+'" aria-label="Terminer : '+esc(t.nom)+'" onclick="ESPACE.cocherTa(\''+t.id+'\')">'+(t.etat==='Terminé'?'✓':'')+'</button><div><div class="tn">'+esc(t.nom)+'</div><div class="ts'+(re?' retard':'')+'">'+(t.type==='Publication'?'📱 Publication · ':'')+(t.echeance?(re?'⚠️ ':'')+esc(t.echeance.split('-').reverse().join('/')):'sans date')+(t.etat==='En cours'?' · en cours':'')+'</div></div></div>';}
  z.innerHTML='<h2 class="titre-g">✅ Mes tâches</h2>'+etat(taInfo)
   +'<div class="boite"><h3>À faire ('+en.length+')</h3>'+(en.length?en.map(lg).join(''):'<p class="vide">Rien à faire, bravo ! 🌸</p>')+'</div>'
   +'<div class="boite"><h3>➕ Nouvelle tâche</h3><div class="champs"><div style="flex:2;min-width:200px"><label for="ta-n">La tâche</label><input id="ta-n" type="text"></div><div><label for="ta-d">Pour le</label><input id="ta-d" type="date"></div></div><button class="petit" onclick="ESPACE.ajoutTa()">Ajouter</button> '+(taMsg?'<span class="msg" role="status">'+esc(taMsg)+'</span>':'')+'</div>'
   +(fi.length?'<div class="boite"><h3>Terminées récemment</h3>'+fi.map(lg).join('')+'</div>':'');
}
ESPACE.cocherTa=function(id){
  var t=TA.filter(function(x){return x.id===id;})[0];if(!t)return;
  t.etat=t.etat==='Terminé'?'Pas commencée':'Terminé';cacheSet('taches',{taches:TA});dessTa();
  ecrire('/app/tache-maj',{id:id,etat:t.etat},function(r){if(!r.ok){taMsg='⚠️ '+(r.j.erreur||'Erreur');dessTa();}});
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
var CA=[],caInfo=null,caTous=false;
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
    h+='<div class="tache'+(it.fait?' fait':'')+'"><button class="coche'+(it.fait?' on':'')+'" role="checkbox" aria-checked="'+it.fait+'" aria-label="Publié : '+esc(it.texte)+'" onclick="ESPACE.cocherCa('+i+')">'+(it.fait?'✓':'')+'</button><div style="flex:1"><div class="tn">'+esc(it.texte)+'</div></div><button class="mini" onclick="ESPACE.copierCa('+i+',this)">📋 Copier</button></div>';
  });
  var rest=CA.filter(function(x){return !x.fait;}).length;
  z.innerHTML='<h2 class="titre-g">📅 Calendrier éditorial</h2>'+etat(caInfo)
   +'<p class="vide" style="text-align:center">'+rest+' publication'+(rest>1?'s':'')+' à faire. « Copier » prépare le texte à coller dans ChatGPT.</p>'
   +'<div class="chips"><button class="chip'+(!caTous?' on':'')+'" onclick="ESPACE.voirCa(false)">À faire</button><button class="chip'+(caTous?' on':'')+'" onclick="ESPACE.voirCa(true)">Tout voir</button></div>'
   +'<div class="boite">'+(h||'<p class="vide">Tout est publié 🎉</p>')+'</div>';
}
ESPACE.voirCa=function(v){caTous=v;dessCa();};
ESPACE.cocherCa=function(i){
  var it=CA[i];if(!it)return;it.fait=!it.fait;cacheSet('calendrier',{items:CA});dessCa();
  ecrire('/app/calendrier-coche',{id:it.id,fait:it.fait},function(){});
};
ESPACE.copierCa=function(i,b){
  var it=CA[i];if(!it)return;
  copier(CONSIGNE+it.texte+(it.section?'\n(Étape du calendrier : '+it.section+')':''),function(){b.textContent='✅ Copié';setTimeout(function(){b.textContent='📋 Copier';},1800);});
};

/* =============== ANNIVERSAIRES =============== */
var AN=[],anInfo=null;
ESPACE.anniv=function(){
  $('v-anniv').innerHTML='<div class="liste" id="an-zone"></div>';
  lire('anniv','/app/anniv',function(d,info){anInfo=info;if(d)AN=d.anniv||[];dessAn();});
};
function dessAn(){
  var z=$('an-zone');if(!z)return;var now=new Date();now.setHours(0,0,0,0);
  var L=AN.map(function(a){var p=a.date.split('-'),m=+p[1]-1,j=+p[2],d=new Date(now.getFullYear(),m,j);if(d<now)d=new Date(now.getFullYear()+1,m,j);return{a:a,d:d,n:Math.round((d-now)/864e5)};}).sort(function(x,y){return x.n-y.n;});
  var h=L.slice(0,80).map(function(x){var a=x.a,pr=(a.nom||'').split(/\s+/)[0];
    var sms=a.tel?'<a class="mini" href="sms:'+esc(a.tel.replace(/\s/g,''))+'?&body='+encodeURIComponent('Joyeux anniversaire '+pr+' ! 🎂 Je pense à vous. Zulay — Les Essences Parfumées d\'Aphrodite')+'">💬 SMS</a>':'';
    return '<div class="tache"><div class="jour'+(x.n===0?' auj':'')+'">'+(x.n===0?'🎉':x.d.getDate()+'<small>'+x.d.toLocaleDateString('fr-FR',{month:'short'})+'</small>')+'</div><div style="flex:1"><div class="tn">'+esc(a.nom)+'</div><div class="ts">'+(a.qui==='Filleule'?'🌸 Filleule':'👩 Cliente')+' · '+(x.n===0?'aujourd\'hui !':x.n===1?'demain':'dans '+x.n+' jours')+'</div></div>'+sms+'</div>';}).join('');
  z.innerHTML='<h2 class="titre-g">🎂 Anniversaires</h2>'+etat(anInfo)+'<div class="boite">'+(h||'<p class="vide">Aucun anniversaire.</p>')+'</div>';
}

/* =============== FILLEULES =============== */
var FI=[],fiInfo=null,fiQ='';
ESPACE.filleules=function(){
  $('v-filleules').innerHTML='<div class="liste" id="fi-zone"></div>';
  lire('filleules','/app/filleules',function(d,info){fiInfo=info;if(d)FI=d.filleules||[];dessFi();});
};
function dessFi(){
  var z=$('fi-zone');if(!z)return;var q=norm(fiQ);
  var L=FI.filter(function(f){return !q||norm(f.nom+' '+f.ville+' '+f.tel).indexOf(q)>=0;});
  z.innerHTML='<h2 class="titre-g">🌸 Mes filleules</h2>'+etat(fiInfo)+'<input id="fi-q" class="recherche" type="search" placeholder="🔍 Chercher une filleule" aria-label="Chercher une filleule" value="'+esc(fiQ)+'" oninput="ESPACE.rechFi(this.value)">'
   +'<p class="maj">'+L.length+' filleule'+(L.length>1?'s':'')+'</p>'+L.map(function(f){return '<div class="boite t-'+(f.sexe==='M'?'homme':'femme')+'"><b>'+esc(f.nom)+'</b>'
   +ligne('📞','Téléphone',f.tel?'<a href="tel:'+esc(f.tel.replace(/\s/g,''))+'">'+esc(f.tel)+'</a>':'')+ligne('✉️','Mail',esc(f.mail))+ligne('📍','Ville',esc([f.cp,f.ville].filter(Boolean).join(' ')))
   +ligne('🎂','Naissance',f.naiss?esc(f.naiss.split('-').reverse().join('/')):'')+ligne('📅','Entrée',f.entree?esc(f.entree.split('-').reverse().join('/')):'')+(f.notes?'<div class="rem">📝 '+esc(f.notes)+'</div>':'')+'</div>';}).join('');
}
ESPACE.rechFi=function(v){fiQ=v;dessFi();var i=$('fi-q');if(i){i.focus();try{i.setSelectionRange(v.length,v.length);}catch(e){}}};

/* =============== FINANCES EXHALESSENCE (données gardées dans l'app) =============== */
var FIN_TAB='prix',FIN_AN=2026,PQ='';
var MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
ESPACE.finances=function(){
  $('v-finances').innerHTML='<div class="liste" id="fin-zone"></div>';dessFin();
};
function dessFin(){
  var D=window.DONNEES_EXH,z=$('fin-zone');if(!z||!D)return;
  var tabs=[['prix','🔢 Prix et points'],['comm','⭐ Points et commissions'],['marge','📊 Déclaration de marge']];
  var h='<h2 class="titre-g">💶 Suivi financier EXHALESSENCE</h2><div class="chips">'+tabs.map(function(t){return '<button class="chip'+(FIN_TAB===t[0]?' on':'')+'" onclick="ESPACE.tabFin(\''+t[0]+'\')">'+t[1]+'</button>';}).join('')+'</div>';
  if(FIN_TAB==='prix'){
    var q=norm(PQ);
    h+='<input id="pq" class="recherche" type="search" placeholder="🔍 Chercher un produit" aria-label="Chercher un produit" value="'+esc(PQ)+'" oninput="ESPACE.rechP(this.value)"><p class="vide">Prix conseillère : −50 % sur parfums et beauté, −30 % sur Home. Cases « — » : points à compléter.</p>';
    D.produits.forEach(function(g){
      var it=g.items.filter(function(i){return !q||norm(i.nom).indexOf(q)>=0;});if(!it.length)return;
      h+='<div class="boite"><h3>'+esc(g.titre)+'</h3><div class="tab"><div class="th"><span>Produit</span><span>Pts</span><span>Cons.</span><span>Client</span></div>'+it.map(function(i){return '<div class="tr"><span>'+esc(i.nom)+'</span><span>'+(i.pts==null?'—':i.pts)+'</span><span>'+eur(i.cons)+'</span><span>'+eur(i.client)+'</span></div>';}).join('')+'</div></div>';
    });
  }else{
    var ans=Object.keys(FIN_TAB==='comm'?D.commissions:D.marges).sort().reverse();
    h+='<div class="chips">'+ans.map(function(a){return '<button class="chip'+(+a===FIN_AN?' on':'')+'" onclick="ESPACE.anFin('+a+')">'+a+'</button>';}).join('')+'</div>';
    var rows=(FIN_TAB==='comm'?D.commissions:D.marges)[FIN_AN]||[];
    if(FIN_TAB==='comm'){
      var tp=0,tr=0,tt=0,tc=0;
      h+='<div class="boite"><h3>Année '+FIN_AN+'</h3><div class="tab"><div class="th c5"><span>Mois</span><span>Perso</span><span>Réseau</span><span>Total</span><span>Commission</span></div>'
       +rows.map(function(r,i){tp+=r[0];tr+=r[1];tt+=r[2];tc+=r[3];return '<div class="tr c5"><span>'+MOIS[i]+'</span><span>'+r[0]+'</span><span>'+r[1]+'</span><span>'+r[2]+'</span><span>'+eur(r[3])+'</span></div>';}).join('')
       +'<div class="tr c5 tot"><span>Total</span><span>'+tp+'</span><span>'+tr+'</span><span>'+tt+'</span><span>'+eur(tc)+'</span></div></div></div>';
    }else{
      var tv=0,ta=0,tk=0;
      h+='<div class="boite"><h3>Beauté &amp; Parfum '+FIN_AN+'</h3><div class="tab"><div class="th c5"><span>Mois</span><span>Ventes</span><span>Achats</span><span>Solde</span><span>Commission</span></div>'
       +rows.map(function(r,i){tv+=r[0];ta+=r[1];tk+=r[2];return '<div class="tr c5"><span>'+MOIS[i]+'</span><span>'+eur(r[0])+'</span><span>'+eur(r[1])+'</span><span>'+eur(r[0]-r[1])+'</span><span>'+eur(r[2])+'</span></div>';}).join('')
       +'<div class="tr c5 tot"><span>Total</span><span>'+eur(tv)+'</span><span>'+eur(ta)+'</span><span>'+eur(tv-ta)+'</span><span>'+eur(tk)+'</span></div></div></div>'
       +'<p class="vide">Avant 2023 : '+Object.keys(D.anciennesMarges).map(function(k){return k+' — '+D.anciennesMarges[k];}).join(' · ')+'. Le détail est dans Notion.</p>';
    }
  }
  z.innerHTML=h;
}
ESPACE.tabFin=function(t){FIN_TAB=t;if(t==='comm'&&!window.DONNEES_EXH.commissions[FIN_AN])FIN_AN=2025;dessFin();};
ESPACE.anFin=function(a){FIN_AN=a;dessFin();};
ESPACE.rechP=function(v){PQ=v;dessFin();var i=$('pq');if(i){i.focus();try{i.setSelectionRange(v.length,v.length);}catch(e){}}};

/* =============== PAGES D'ACTIVITÉ =============== */
ESPACE.creations=function(){};
ESPACE.exha=function(){};
})();
