/* ═══════════════════════════════════════════════════
   NEXUS JS — coul-contact.net
   Modules: App, Modal, Toast, Dashboard, Contacts,
            Agenda, Messages, AI, Settings
   ═══════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

async function api(url, method='GET', body=null){
  const opts = { method, headers:{'Content-Type':'application/json'} };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

function groupColour(g){
  const m = {Famille:'#E74C3C',Travail:'#27AE60',Amis:'#F59E0B',VIP:'#9B59B6'};
  return m[g]||'#4A90D9';
}
function groupIcon(g){
  const m = {Famille:'🏠',Travail:'💼',Amis:'🤝',VIP:'👑',Favoris:'⭐'};
  return m[g]||'🏷️';
}
function initials(c){ return ((c.prenom||'?')[0]+(c.nom||'?')[0]).toUpperCase(); }
function fmtDate(s){ if(!s) return ''; const d=new Date(s+'T00:00:00'); return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }
function today(){ return new Date().toISOString().split('T')[0]; }
function nowTime(){ const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

/* ────────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────────── */
const Toast = {
  show(msg, type='success'){
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(()=>{ t.className='toast'; }, 3200);
  }
};

/* ────────────────────────────────────────────────────
   MODAL
──────────────────────────────────────────────────── */
const Modal = {
  _current: null,
  open(id){
    $('modalOverlay').classList.add('open');
    if(this._current) $(this._current).classList.remove('open');
    this._current = id;
    $(id).classList.add('open');
  },
  close(){
    $('modalOverlay').classList.remove('open');
    if(this._current){ $(this._current).classList.remove('open'); this._current=null; }
  }
};

/* ────────────────────────────────────────────────────
   APP NAVIGATION
──────────────────────────────────────────────────── */
const App = {
  nav(view){
    $$('.view').forEach(v=>v.classList.remove('active'));
    $$('.nav-btn').forEach(b=>b.classList.remove('active'));
    $(`view-${view}`).classList.add('active');
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    // Refresh data on show
    if(view==='dashboard') Dashboard.load();
    if(view==='contacts')  Contacts.load();
    if(view==='agenda')    Agenda.load();
    if(view==='messages')  Messages.load();
  },
  init(){
    $$('.nav-btn').forEach(btn=>{
      btn.addEventListener('click',()=> this.nav(btn.dataset.view));
    });
    Dashboard.load();
  }
};

/* ────────────────────────────────────────────────────
   DASHBOARD
──────────────────────────────────────────────────── */
const Dashboard = {
  async load(){
    // Greeting
    const h = new Date().getHours();
    const greet = h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';
    $('dashGreeting').textContent = `${greet} !`;
    $('dashDate').textContent = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    const [stats, events, contacts] = await Promise.all([
      api('/api/stats'),
      api(`/api/evenements?date=${today()}`),
      api('/api/contacts')
    ]);

    // Stats cards
    const sd = $('dashStats'); sd.innerHTML='';
    [
      {icon:'👥',val:stats.contacts,  label:'Contacts',    color:'var(--accent)'},
      {icon:'❤️',val:stats.favoris,   label:'Favoris',     color:'var(--danger)'},
      {icon:'📅',val:stats.events_today,label:"Aujourd'hui",color:'var(--success)'},
      {icon:'💬',val:stats.messages,  label:'Messages',    color:'var(--warning)'},
    ].forEach(s=>{
      sd.innerHTML += `<div class="stat-card">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-value" style="color:${s.color}">${s.val}</div>
        <div class="stat-label">${s.label}</div>
      </div>`;
    });

    // Events
    const el = $('dashEventsList'); el.innerHTML='';
    if(!events.length){ el.innerHTML='<p style="color:var(--text-muted);font-size:13px">Aucun événement aujourd\'hui</p>'; }
    else events.forEach(ev=>{
      el.innerHTML += `<div class="ev-item">
        <div class="ev-dot" style="background:${ev.couleur||'var(--accent)'}"></div>
        <div class="ev-info">
          <strong>${ev.titre}</strong>
          <div class="ev-meta">${ev.heure_debut||''} ${ev.heure_fin?'– '+ev.heure_fin:''} ${ev.lieu?'· '+ev.lieu:''}</div>
        </div>
      </div>`;
    });

    // Recent contacts
    const cl = $('dashContactsList'); cl.innerHTML='<div class="rc-grid"></div>';
    const grid = cl.querySelector('.rc-grid');
    contacts.slice(0,6).forEach(c=>{
      const col = groupColour(c.groupe);
      grid.innerHTML += `<div class="rc-item" onclick="App.nav('contacts')">
        <div class="avatar" style="background:${col}">${initials(c)}</div>
        <div><div class="rc-name">${c.prenom} ${c.nom}</div>
             <div class="rc-tel">${c.telephone||''}</div></div>
      </div>`;
    });
  }
};

/* ────────────────────────────────────────────────────
   CONTACTS
──────────────────────────────────────────────────── */
const Contacts = {
  _groupe: 'Tous',
  _contacts: [],

  async load(){
    const groupes = await api('/api/groupes');
    this._renderGroupes(groupes);
    await this.fetchContacts();
  },

  _renderGroupes(groupes){
    const el = $('groupsList'); el.innerHTML='';
    ['Tous','Favoris',...groupes.map(g=>g.nom)].forEach(g=>{
      const icon = groupIcon(g);
      const btn = document.createElement('button');
      btn.className = `group-btn${g===this._groupe?' active':''}`;
      btn.innerHTML = `<span>${icon}</span> ${g}`;
      btn.onclick = ()=>{ this._groupe=g; el.querySelectorAll('.group-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); this.fetchContacts(); };
      el.appendChild(btn);
    });
  },

  async fetchContacts(){
    const q = $('contactSearch').value;
    const params = new URLSearchParams();
    if(q) params.set('q',q);
    if(this._groupe==='Favoris') params.set('favori','1');
    else if(this._groupe!=='Tous') params.set('groupe',this._groupe);
    this._contacts = await api(`/api/contacts?${params}`);
    this._render();
  },

  search(val){ clearTimeout(this._st); this._st=setTimeout(()=>this.fetchContacts(),250); },

  _render(){
    const el = $('contactsList'); el.innerHTML='';
    if(!this._contacts.length){
      el.innerHTML='<p style="text-align:center;padding:40px;color:var(--text-muted)">Aucun contact trouvé</p>';
      return;
    }
    el.innerHTML = `<p style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${this._contacts.length} contact(s)</p>`;
    this._contacts.forEach(c=>{
      const col = groupColour(c.groupe);
      const card = document.createElement('div');
      card.className = 'contact-card';
      card.innerHTML = `
        <div class="avatar" style="background:${col}">${initials(c)}</div>
        <div class="contact-info">
          <div class="contact-name">${c.prenom} ${c.nom}
            ${c.favori?'<span style="color:var(--warning)">⭐</span>':''}
            <span class="contact-badge gc-${c.groupe.replace(/é/g,'e').replace(/[^a-zA-Z]/g,'')}">${groupIcon(c.groupe)} ${c.groupe}</span>
          </div>
          <div class="contact-meta">📞 ${c.telephone||'—'}  ${c.email?'📧 '+c.email:''}</div>
        </div>
        <div class="contact-actions">
          <button class="action-btn" onclick="event.stopPropagation();Contacts.openForm(${c.id})" title="Modifier">✏️</button>
          <button class="action-btn" onclick="event.stopPropagation();Contacts.toggleFav(${c.id})" title="Favori">⭐</button>
          <button class="action-btn danger" onclick="event.stopPropagation();Contacts.del(${c.id},'${c.prenom}')" title="Supprimer">🗑️</button>
        </div>`;
      card.onclick = ()=> this.showDetail(c);
      el.appendChild(card);
    });
  },

  async showDetail(c){
    // Reuse form as detail view
    this.openForm(c.id);
  },

  async openForm(id=null){
    $('modalContactTitle').textContent = id?'Modifier contact':'Nouveau contact';
    if(id){
      const c = await api(`/api/contacts/${id}`);
      $('fContactId').value = c.id;
      $('fPrenom').value = c.prenom||'';
      $('fNom').value = c.nom||'';
      $('fTel').value = c.telephone||'';
      $('fTel2').value = c.telephone2||'';
      $('fEmail').value = c.email||'';
      $('fAdresse').value = c.adresse||'';
      $('fVille').value = c.ville||'';
      $('fPays').value = c.pays||"Côte d'Ivoire";
      $('fGroupe').value = c.groupe||'Général';
      $('fNotes').value = c.notes||'';
      $('fFavori').checked = !!c.favori;
    } else {
      ['fContactId','fPrenom','fNom','fTel','fTel2','fEmail','fAdresse','fNotes'].forEach(id=>$(id).value='');
      $('fVille').value='Abidjan'; $('fPays').value="Côte d'Ivoire"; $('fGroupe').value='Général'; $('fFavori').checked=false;
    }
    Modal.open('modalContact');
  },

  async save(){
    const prenom = $('fPrenom').value.trim();
    const nom = $('fNom').value.trim();
    if(!prenom||!nom){ Toast.show('Prénom et Nom obligatoires','error'); return; }
    const data = {
      prenom,nom,telephone:$('fTel').value,telephone2:$('fTel2').value,
      email:$('fEmail').value,adresse:$('fAdresse').value,
      ville:$('fVille').value,pays:$('fPays').value,
      groupe:$('fGroupe').value,notes:$('fNotes').value,
      favori:$('fFavori').checked?1:0
    };
    const id = $('fContactId').value;
    if(id){ await api(`/api/contacts/${id}`,'PUT',data); Toast.show('Contact mis à jour ✓'); }
    else  { await api('/api/contacts','POST',data); Toast.show('Contact créé ✓'); }
    Modal.close();
    this.fetchContacts();
  },

  async del(id,prenom){
    if(!confirm(`Supprimer ${prenom} ?`)) return;
    await api(`/api/contacts/${id}`,'DELETE');
    Toast.show('Contact supprimé'); this.fetchContacts();
  },

  async toggleFav(id){
    await api(`/api/contacts/${id}/favori`,'POST');
    this.fetchContacts();
  },

  async aiSearch(){
    const q = $('contactSearch').value.trim();
    if(!q){ Toast.show('Saisissez une requête de recherche','error'); return; }
    Toast.show('🧠 Recherche IA en cours…');
    const res = await api('/api/ai/search_contacts','POST',{query:q});
    this._contacts = res.contacts||[];
    this._render();
    Toast.show(`${this._contacts.length} résultat(s) IA`);
  }
};

/* ────────────────────────────────────────────────────
   AGENDA
──────────────────────────────────────────────────── */
const Agenda = {
  _date: new Date(),
  selectedDate: today(),

  load(){ this._renderCal(); this._renderDay(); },

  _renderCal(){
    const y = this._date.getFullYear(), m = this._date.getMonth();
    $('calMonth').textContent = this._date.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

    // Get events for month
    const monthStr = `${y}-${String(m+1).padStart(2,'0')}`;
    api(`/api/evenements?month=${monthStr}`).then(evs=>{
      const evDates = new Set(evs.map(e=>e.date_debut));
      const grid = $('calGrid'); grid.innerHTML='';
      const first = new Date(y,m,1);
      const dow = (first.getDay()+6)%7; // Monday=0
      const days = new Date(y,m+1,0).getDate();
      const todayStr = today();
      // Empty cells
      for(let i=0;i<dow;i++) grid.innerHTML+='<div class="cal-empty"></div>';
      for(let d=1;d<=days;d++){
        const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cls = ['cal-day',
          ds===todayStr?'today':'',
          ds===this.selectedDate?'selected':'',
          evDates.has(ds)?'has-event':'',
        ].join(' ');
        grid.innerHTML += `<div class="${cls}" onclick="Agenda.selectDay('${ds}')">${d}</div>`;
      }
    });
  },

  selectDay(ds){ this.selectedDate=ds; this._renderCal(); this._renderDay(); },
  prevMonth(){ this._date.setMonth(this._date.getMonth()-1); this._renderCal(); },
  nextMonth(){ this._date.setMonth(this._date.getMonth()+1); this._renderCal(); },

  async _renderDay(){
    $('selectedDayLabel').textContent = fmtDate(this.selectedDate);
    const evs = await api(`/api/evenements?date=${this.selectedDate}`);
    const el = $('dayEventsList'); el.innerHTML='';
    if(!evs.length){ el.innerHTML='<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px">Aucun événement</p>'; return; }
    evs.forEach(ev=>{
      el.innerHTML += `<div class="event-card">
        <div class="ev-bar" style="background:${ev.couleur||'var(--accent)'}"></div>
        <div class="ev-body">
          <div class="ev-title">${ev.titre}</div>
          ${ev.heure_debut?`<div class="ev-time">🕐 ${ev.heure_debut}${ev.heure_fin?' – '+ev.heure_fin:''}</div>`:''}
          ${ev.lieu?`<div class="ev-place">📍 ${ev.lieu}</div>`:''}
        </div>
        <div class="ev-actions">
          <button class="action-btn" onclick="Agenda.openForm(${ev.id})" title="Modifier">✏️</button>
          <button class="action-btn danger" onclick="Agenda.del(${ev.id},'${ev.titre.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>`;
    });
  },

  async openForm(id=null, dateStr=null){
    $('modalEventTitle').textContent = id?'Modifier événement':'Nouvel événement';
    if(id){
      const ev = (await api(`/api/evenements?date=`))||{};
      // Fetch all and find
      const all = await api('/api/evenements');
      const e = all.find(x=>x.id===id)||{};
      $('fEventId').value=e.id||'';
      $('fEvTitre').value=e.titre||'';
      $('fEvDate').value=e.date_debut||this.selectedDate;
      $('fEvType').value=e.type_event||'Rendez-vous';
      $('fEvHdeb').value=e.heure_debut||'';
      $('fEvHfin').value=e.heure_fin||'';
      $('fEvLieu').value=e.lieu||'';
      $('fEvCouleur').value=e.couleur||'#4A90D9';
      $('fEvDesc').value=e.description||'';
    } else {
      ['fEventId','fEvTitre','fEvHdeb','fEvHfin','fEvLieu','fEvDesc'].forEach(id=>$(id).value='');
      $('fEvDate').value = dateStr||this.selectedDate;
      $('fEvType').value='Rendez-vous'; $('fEvCouleur').value='#4A90D9';
    }
    Modal.open('modalEvent');
  },

  async save(){
    const titre = $('fEvTitre').value.trim();
    const date  = $('fEvDate').value;
    if(!titre||!date){ Toast.show('Titre et date obligatoires','error'); return; }
    const data = {
      titre, date_debut:date, heure_debut:$('fEvHdeb').value,
      heure_fin:$('fEvHfin').value, lieu:$('fEvLieu').value,
      type_event:$('fEvType').value, couleur:$('fEvCouleur').value,
      description:$('fEvDesc').value
    };
    const id = $('fEventId').value;
    if(id){ await api(`/api/evenements/${id}`,'PUT',data); Toast.show('Événement mis à jour ✓'); }
    else  { await api('/api/evenements','POST',data); Toast.show('Événement créé ✓'); }
    Modal.close(); this.selectedDate=date; this.load();
  },

  async del(id,titre){
    if(!confirm(`Supprimer "${titre}" ?`)) return;
    await api(`/api/evenements/${id}`,'DELETE');
    Toast.show('Événement supprimé'); this._renderDay(); this._renderCal();
  }
};

/* ────────────────────────────────────────────────────
   MESSAGES
──────────────────────────────────────────────────── */
const Messages = {
  _mode: 'individual',
  _selected: null,         // single contact
  _selectedIds: new Set(), // group mode
  _contacts: [],
  _aiMsg: '',

  async load(){
    this._contacts = await api('/api/contacts');
    this._renderContacts();
  },

  setMode(m){
    this._mode=m; this._selected=null; this._selectedIds.clear();
    $('btnModeIndiv').classList.toggle('active',m==='individual');
    $('btnModeGroup').classList.toggle('active',m==='group');
    this._renderContacts();
    this._renderCompose();
  },

  filterContacts(q){
    const low=q.toLowerCase();
    const items = $$('.msg-contact-item');
    items.forEach(i=>{ i.style.display=i.dataset.name.includes(low)?'':'none'; });
  },

  _renderContacts(){
    const el = $('msgContactsList'); el.innerHTML='';
    this._contacts.forEach(c=>{
      const col = groupColour(c.groupe);
      const sel = this._mode==='individual'
        ? (this._selected?.id===c.id)
        : this._selectedIds.has(c.id);
      const item = document.createElement('div');
      item.className = `msg-contact-item${sel?' selected':''}`;
      item.dataset.name = `${c.prenom} ${c.nom}`.toLowerCase();
      item.innerHTML = `
        ${this._mode==='group'?`<input type="checkbox" ${sel?'checked':''} style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0" onclick="event.stopPropagation();Messages.toggleSelect(${c.id})">`:''}
        <div class="avatar" style="background:${col};width:34px;height:34px;font-size:12px;flex-shrink:0">${initials(c)}</div>
        <div>
          <div style="font-size:12px;font-weight:600">${c.prenom} ${c.nom}</div>
          <div style="font-size:11px;color:var(--text-muted)">${c.telephone||''}</div>
        </div>`;
      item.onclick = ()=> this._mode==='individual'? this.selectContact(c) : this.toggleSelect(c.id);
      el.appendChild(item);
    });
  },

  async selectContact(c){
    this._selected=c;
    this._renderContacts();
    await this._renderCompose();
  },

  toggleSelect(id){
    if(this._selectedIds.has(id)) this._selectedIds.delete(id);
    else this._selectedIds.add(id);
    this._renderContacts();
    if(this._selectedIds.size) this._renderCompose();
    else { $('msgComposePanel').innerHTML='<div class="msg-empty"><p>💬</p><p>Sélectionnez un contact<br>pour envoyer un message</p></div>'; }
  },

  async _renderCompose(){
    const p = $('msgComposePanel');
    if(this._mode==='individual' && !this._selected){
      p.innerHTML='<div class="msg-empty"><p>💬</p><p>Sélectionnez un contact<br>pour envoyer un message</p></div>';
      return;
    }

    const msgs = this._selected? await api(`/api/messages/${this._selected.id}`) : [];
    const dest = this._mode==='individual'
      ? `✉️ À : ${this._selected.prenom} ${this._selected.nom} — ${this._selected.telephone||''}`
      : `✉️ Envoi groupé à ${this._selectedIds.size} contact(s)`;

    p.innerHTML = `
      <div class="msg-recipient-bar">${dest}</div>
      <div class="msg-type-bar">
        <label><input type="radio" name="msgType" value="SMS" checked> SMS</label>
        <label><input type="radio" name="msgType" value="WhatsApp"> WhatsApp</label>
        <label><input type="radio" name="msgType" value="Email"> Email</label>
      </div>
      <div class="msg-history" id="msgHistory"></div>
      <div class="msg-input-area">
        <div class="msg-toolbar">
          <button class="btn-ai-search" onclick="Messages.openAIGenerator()">🧠 Générer avec IA</button>
          <button class="btn-outline" onclick="Messages.sendAudio()" style="font-size:12px;padding:8px 12px">🎤 Audio</button>
        </div>
        <div class="msg-compose-row">
          <textarea id="msgInput" placeholder="Saisissez votre message…" rows="3" onkeydown="if(event.ctrlKey&&event.key==='Enter'){Messages.send();event.preventDefault()}"></textarea>
          <button class="btn-send" onclick="Messages.send()">📤</button>
        </div>
      </div>`;

    const h = $('msgHistory');
    msgs.forEach(m=>{
      const sent = m.direction==='envoyé';
      h.innerHTML += `<div class="bubble-row ${sent?'sent':'recv'}">
        <div class="bubble ${sent?'sent':'recv'}">
          ${m.contenu}
          <div class="bubble-time">${sent?'✓ ':''} ${m.created_at.slice(11,16)}</div>
        </div>
      </div>`;
    });
    h.scrollTop = h.scrollHeight;

    if(this._aiMsg){ $('msgInput').value=this._aiMsg; this._aiMsg=''; }
  },

  async send(){
    const inp = $('msgInput');
    if(!inp) return;
    const txt = inp.value.trim();
    if(!txt){ Toast.show('Message vide','error'); return; }
    const type = document.querySelector('input[name="msgType"]:checked')?.value||'SMS';

    if(this._mode==='individual'){
      if(!this._selected){ Toast.show('Sélectionnez un contact','error'); return; }
      await api('/api/messages','POST',{contact_id:this._selected.id,contenu:txt,type_msg:type});
      Toast.show(`Message envoyé à ${this._selected.prenom} ✓`);
    } else {
      const ids = [...this._selectedIds];
      if(!ids.length){ Toast.show('Sélectionnez des contacts','error'); return; }
      await api('/api/messages','POST',{contact_ids:ids,contenu:txt,type_msg:type});
      Toast.show(`Message envoyé à ${ids.length} contact(s) ✓`);
    }
    inp.value='';
    await this._renderCompose();
  },

  openAIGenerator(){ Modal.open('modalAIMsg'); },

  async generateAI(){
    const sujet = $('aiMsgSujet').value.trim();
    if(!sujet){ Toast.show('Saisissez un sujet','error'); return; }
    $('aiMsgResult').value='⏳ Génération en cours…';
    const res = await api('/api/ai/generate_message','POST',{
      sujet, destinataire:$('aiMsgDest').value||'le destinataire',
      type:$('aiMsgType').value, ton:$('aiMsgTon').value
    });
    $('aiMsgResult').value = res.message||'';
  },

  useAIMessage(){
    const txt = $('aiMsgResult').value.trim();
    if(!txt||txt.startsWith('⏳')){ Toast.show('Générez d\'abord un message','error'); return; }
    this._aiMsg = txt;
    Modal.close();
    this._renderCompose();
  },

  sendAudio(){
    Toast.show('Audio disponible via Twilio / WhatsApp Business API','error');
  }
};

/* ────────────────────────────────────────────────────
   AI CHAT
──────────────────────────────────────────────────── */
const AI = {
  _sessionId: 'nexus_'+Date.now(),

  init(){
    const suggestions = [
      ['🔍 Contacts VIP',          'Montre-moi tous mes contacts VIP'],
      ['✉️ Message professionnel', 'Génère un message professionnel pour rappeler une réunion'],
      ['📅 Planifier ma semaine',  'Aide-moi à planifier ma semaine'],
      ['📊 Résumé contacts',       'Donne-moi un résumé de mes contacts'],
      ['🎂 Anniversaires',         'Qui a un anniversaire ce mois-ci ?'],
      ['✍️ Email partenariat',     'Rédige un email formel pour proposer un partenariat'],
      ['🤝 Suivi client',          'Comment assurer un bon suivi client ?'],
      ['📞 Script appel',          'Prépare un script pour un appel de prospection'],
    ];
    const el = $('aiSuggestions');
    suggestions.forEach(([label,prompt])=>{
      el.innerHTML += `<button class="ai-suggestion" onclick="AI.quickSend('${prompt.replace(/'/g,"\\'")}')"><span>›</span> ${label}</button>`;
    });
    this._addMsg('assistant', '👋 Bonjour ! Je suis **NEXUS IA**, votre assistant intelligent.\n\nJe peux vous aider à :\n• 🔍 Rechercher des contacts\n• ✉️ Rédiger des messages\n• 📅 Planifier des événements\n• 📊 Analyser vos données\n\nQue puis-je faire pour vous ?');
  },

  onKey(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); this.send(); } },

  async send(){
    const inp = $('aiInput');
    const txt = inp.value.trim();
    if(!txt) return;
    inp.value='';
    this._addMsg('user', txt);
    const thinking = this._addMsg('assistant','⏳ Réflexion en cours…', true);
    const res = await api('/api/ai/chat','POST',{message:txt, session_id:this._sessionId});
    thinking.remove();
    this._addMsg('assistant', res.reply||'⚠️ Erreur');
  },

  quickSend(prompt){ $('aiInput').value=prompt; this.send(); },

  _addMsg(role, text, thinking=false){
    const h = $('aiHistory');
    const row = document.createElement('div');
    row.className = `ai-msg-row ${role}`;
    const isUser = role==='user';
    row.innerHTML = isUser
      ? `<div class="ai-bubble user">${this._md(text)}<div class="ai-bubble-time">${nowTime()}</div></div>`
      : `<div class="ai-avatar">🧠</div><div class="ai-bubble assistant${thinking?' ai-thinking':''}">${this._md(text)}<div class="ai-bubble-time">NEXUS IA · ${nowTime()}</div></div>`;
    h.appendChild(row);
    h.scrollTop = h.scrollHeight;
    return row;
  },

  _md(t){ // lightweight markdown: bold, bullet, newline
    return t
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n• /g,'<br>• ')
      .replace(/\n/g,'<br>');
  },

  clear(){
    $('aiHistory').innerHTML='';
    this._sessionId='nexus_'+Date.now();
    this._addMsg('assistant','Conversation effacée. Comment puis-je vous aider ?');
  }
};

/* ────────────────────────────────────────────────────
   SETTINGS
──────────────────────────────────────────────────── */
const Settings = {
  async save(){
    const key = $('apiKeyInput').value.trim();
    if(!key){ Toast.show('Clé vide','error'); return; }
    const r = await api('/api/ai/key','POST',{key});
    if(r.ok){ Toast.show('Clé API sauvegardée ✓'); $('apiStatus').style.color='var(--success)'; $('apiStatus').textContent='✓ Configurée'; }
  },
  async test(){
    $('apiStatus').textContent='⏳ Test en cours…'; $('apiStatus').style.color='var(--warning)';
    const r = await api('/api/ai/test');
    if(r.ok){ $('apiStatus').textContent='✓ API fonctionnelle !'; $('apiStatus').style.color='var(--success)'; Toast.show('API OK ✓'); }
    else    { $('apiStatus').textContent='✗ '+r.result.slice(0,80); $('apiStatus').style.color='var(--danger)'; Toast.show('Échec du test','error'); }
  }
};

/* ────────────────────────────────────────────────────
   BOOT
──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', ()=>{
  App.init();
  AI.init();
  // Close modal on Escape
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') Modal.close(); });
});
