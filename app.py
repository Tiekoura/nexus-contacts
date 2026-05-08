"""
NEXUS Web — Flask Backend
coul-contact.net
"""

import os, sys, json, sqlite3
from datetime import datetime
from flask import Flask, render_template, jsonify, request, g

app = Flask(__name__)
app.config['SECRET_KEY'] = 'nexus-coul-contact-2025'

# ── DB ─────────────────────────────────────────────────────────────────────
BASE = os.path.dirname(__file__)
DB_PATH = os.path.join(os.environ.get('RENDER_DISK', BASE), 'nexus.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
    return db

@app.teardown_appcontext
def close_db(e=None):
    db = getattr(g, '_database', None)
    if db: db.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prenom TEXT NOT NULL, nom TEXT NOT NULL,
        telephone TEXT, telephone2 TEXT, email TEXT,
        adresse TEXT, ville TEXT, pays TEXT DEFAULT 'Côte d''Ivoire',
        groupe TEXT DEFAULT 'Général', notes TEXT,
        favori INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS evenements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT NOT NULL, description TEXT,
        date_debut TEXT NOT NULL, date_fin TEXT,
        heure_debut TEXT, heure_fin TEXT, lieu TEXT,
        type_event TEXT DEFAULT 'Rendez-vous',
        couleur TEXT DEFAULT '#4A90D9',
        contact_id INTEGER, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER, contenu TEXT NOT NULL,
        type_msg TEXT DEFAULT 'SMS', direction TEXT DEFAULT 'envoyé',
        statut TEXT DEFAULT 'envoyé', created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS groupes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT UNIQUE NOT NULL, couleur TEXT DEFAULT '#4A90D9'
    )""")

    c.execute("SELECT COUNT(*) FROM groupes")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO groupes (nom, couleur) VALUES (?,?)", [
            ("Général","#4A90D9"),("Famille","#E74C3C"),
            ("Travail","#27AE60"),("Amis","#F39C12"),("VIP","#9B59B6"),
        ])

    c.execute("SELECT COUNT(*) FROM contacts")
    if c.fetchone()[0] == 0:
        demo = [
            ("Kouamé","Assi","+225 07 01 23 45 67","","kassi@email.ci","Cocody","Abidjan","Côte d'Ivoire","Travail","Directeur commercial",1),
            ("Aya","Koffi","+225 05 45 67 89 01","+225 07 89 01 23 45","akoffi@email.ci","Plateau","Abidjan","Côte d'Ivoire","Famille","Sœur",1),
            ("Ibrahim","Coulibaly","+225 01 23 45 67 89","","icoulibaly@email.ci","Yopougon","Abidjan","Côte d'Ivoire","Amis","Ami d'enfance",0),
            ("Mariam","Traoré","+225 07 67 89 01 23","","mtraore@email.ci","Marcory","Abidjan","Côte d'Ivoire","Travail","Collègue RH",0),
            ("Jean-Pierre","Bédié","+225 05 34 56 78 90","","jpbedie@email.ci","Deux-Plateaux","Abidjan","Côte d'Ivoire","VIP","Associé",1),
            ("Adjoua","Mensah","+225 07 56 78 90 12","","amensah@email.ci","Treichville","Abidjan","Côte d'Ivoire","Famille","Cousine",0),
        ]
        c.executemany("INSERT INTO contacts (prenom,nom,telephone,telephone2,email,adresse,ville,pays,groupe,notes,favori) VALUES (?,?,?,?,?,?,?,?,?,?,?)", demo)
        today = datetime.now().strftime("%Y-%m-%d")
        c.executemany("INSERT INTO evenements (titre,description,date_debut,date_fin,heure_debut,heure_fin,lieu,type_event,couleur) VALUES (?,?,?,?,?,?,?,?,?)", [
            ("Réunion d'équipe","Revue mensuelle des objectifs",today,today,"09:00","11:00","Salle de conférence A","Réunion","#27AE60"),
            ("Déjeuner avec Kouamé","Discussion partenariat",today,today,"12:30","14:00","Restaurant Le Plateau","Rendez-vous","#4A90D9"),
            ("Formation Python","Formation développement backend",today,today,"15:00","17:00","Centre de formation","Formation","#9B59B6"),
        ])
    conn.commit(); conn.close()

# ── UTILS ──────────────────────────────────────────────────────────────────
def row2dict(row):
    return dict(row) if row else None

def rows2list(rows):
    return [dict(r) for r in rows]

# ══════════════════════════════════════════════════════════════════════════
# ROUTES PAGES
# ══════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')

# ══════════════════════════════════════════════════════════════════════════
# API — CONTACTS
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/contacts', methods=['GET'])
def api_contacts():
    db = get_db(); c = db.cursor()
    q = request.args.get('q',''); groupe = request.args.get('groupe','')
    favori = request.args.get('favori','')
    sql = "SELECT * FROM contacts WHERE 1=1"
    params = []
    if q:
        sql += " AND (prenom LIKE ? OR nom LIKE ? OR telephone LIKE ? OR email LIKE ?)"
        s = f"%{q}%"; params += [s,s,s,s]
    if groupe and groupe not in ('Tous',''):
        sql += " AND groupe=?"; params.append(groupe)
    if favori == '1':
        sql += " AND favori=1"
    sql += " ORDER BY favori DESC, nom ASC, prenom ASC"
    return jsonify(rows2list(c.execute(sql, params).fetchall()))

@app.route('/api/contacts/<int:cid>', methods=['GET'])
def api_contact(cid):
    db = get_db(); c = db.cursor()
    row = c.execute("SELECT * FROM contacts WHERE id=?", (cid,)).fetchone()
    return jsonify(row2dict(row))

@app.route('/api/contacts', methods=['POST'])
def api_create_contact():
    db = get_db(); c = db.cursor(); d = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO contacts (prenom,nom,telephone,telephone2,email,adresse,ville,pays,groupe,notes,favori,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (d['prenom'],d['nom'],d.get('telephone',''),d.get('telephone2',''),d.get('email',''),
         d.get('adresse',''),d.get('ville',''),d.get('pays',"Côte d'Ivoire"),
         d.get('groupe','Général'),d.get('notes',''),int(d.get('favori',0)),now,now))
    db.commit()
    return jsonify({'id': c.lastrowid, 'ok': True})

@app.route('/api/contacts/<int:cid>', methods=['PUT'])
def api_update_contact(cid):
    db = get_db(); c = db.cursor(); d = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("UPDATE contacts SET prenom=?,nom=?,telephone=?,telephone2=?,email=?,adresse=?,ville=?,pays=?,groupe=?,notes=?,favori=?,updated_at=? WHERE id=?",
        (d['prenom'],d['nom'],d.get('telephone',''),d.get('telephone2',''),d.get('email',''),
         d.get('adresse',''),d.get('ville',''),d.get('pays',"Côte d'Ivoire"),
         d.get('groupe','Général'),d.get('notes',''),int(d.get('favori',0)),now,cid))
    db.commit(); return jsonify({'ok': True})

@app.route('/api/contacts/<int:cid>', methods=['DELETE'])
def api_delete_contact(cid):
    db = get_db()
    db.execute("DELETE FROM contacts WHERE id=?", (cid,))
    db.commit(); return jsonify({'ok': True})

@app.route('/api/contacts/<int:cid>/favori', methods=['POST'])
def api_toggle_favori(cid):
    db = get_db()
    db.execute("UPDATE contacts SET favori=1-favori WHERE id=?", (cid,))
    db.commit(); return jsonify({'ok': True})

# ── API — GROUPES ───────────────────────────────────────────────────────────
@app.route('/api/groupes', methods=['GET'])
def api_groupes():
    db = get_db()
    return jsonify(rows2list(db.execute("SELECT * FROM groupes ORDER BY nom").fetchall()))

# ══════════════════════════════════════════════════════════════════════════
# API — ÉVÉNEMENTS
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/evenements', methods=['GET'])
def api_evenements():
    db = get_db(); c = db.cursor()
    date = request.args.get('date',''); month = request.args.get('month','')
    sql = """SELECT e.*,c.prenom||' '||c.nom as contact_nom
             FROM evenements e LEFT JOIN contacts c ON e.contact_id=c.id WHERE 1=1"""
    params = []
    if date:
        sql += " AND e.date_debut=?"; params.append(date)
    elif month:
        sql += " AND e.date_debut LIKE ?"; params.append(f"{month}%")
    sql += " ORDER BY e.date_debut,e.heure_debut"
    return jsonify(rows2list(c.execute(sql, params).fetchall()))

@app.route('/api/evenements', methods=['POST'])
def api_create_event():
    db = get_db(); c = db.cursor(); d = request.json
    c.execute("INSERT INTO evenements (titre,description,date_debut,date_fin,heure_debut,heure_fin,lieu,type_event,couleur,contact_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (d['titre'],d.get('description',''),d['date_debut'],d.get('date_fin',d['date_debut']),
         d.get('heure_debut',''),d.get('heure_fin',''),d.get('lieu',''),
         d.get('type_event','Rendez-vous'),d.get('couleur','#4A90D9'),d.get('contact_id')))
    db.commit(); return jsonify({'id': c.lastrowid, 'ok': True})

@app.route('/api/evenements/<int:eid>', methods=['PUT'])
def api_update_event(eid):
    db = get_db(); c = db.cursor(); d = request.json
    c.execute("UPDATE evenements SET titre=?,description=?,date_debut=?,date_fin=?,heure_debut=?,heure_fin=?,lieu=?,type_event=?,couleur=? WHERE id=?",
        (d['titre'],d.get('description',''),d['date_debut'],d.get('date_fin',d['date_debut']),
         d.get('heure_debut',''),d.get('heure_fin',''),d.get('lieu',''),
         d.get('type_event','Rendez-vous'),d.get('couleur','#4A90D9'),eid))
    db.commit(); return jsonify({'ok': True})

@app.route('/api/evenements/<int:eid>', methods=['DELETE'])
def api_delete_event(eid):
    db = get_db()
    db.execute("DELETE FROM evenements WHERE id=?", (eid,))
    db.commit(); return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════════════════
# API — MESSAGES
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/messages/<int:cid>', methods=['GET'])
def api_messages(cid):
    db = get_db()
    rows = db.execute("SELECT * FROM messages WHERE contact_id=? ORDER BY created_at", (cid,)).fetchall()
    return jsonify(rows2list(rows))

@app.route('/api/messages', methods=['POST'])
def api_send_message():
    db = get_db(); c = db.cursor(); d = request.json
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ids = d.get('contact_ids', [d.get('contact_id')] if d.get('contact_id') else [])
    for cid in ids:
        c.execute("INSERT INTO messages (contact_id,contenu,type_msg,direction,statut,created_at) VALUES (?,?,?,?,?,?)",
            (cid, d['contenu'], d.get('type_msg','SMS'), 'envoyé', 'envoyé', now))
    db.commit(); return jsonify({'ok': True, 'count': len(ids)})

# ══════════════════════════════════════════════════════════════════════════
# API — STATS
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/stats', methods=['GET'])
def api_stats():
    db = get_db(); c = db.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    return jsonify({
        'contacts':  c.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
        'favoris':   c.execute("SELECT COUNT(*) FROM contacts WHERE favori=1").fetchone()[0],
        'events_today': c.execute("SELECT COUNT(*) FROM evenements WHERE date_debut=?", (today,)).fetchone()[0],
        'messages':  c.execute("SELECT COUNT(*) FROM messages").fetchone()[0],
    })

# ══════════════════════════════════════════════════════════════════════════
# API — IA
# ══════════════════════════════════════════════════════════════════════════

ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY','')
_conversations = {}   # session_id -> list

def claude(system, user, history=None, max_tokens=1024):
    import requests as req
    key = ANTHROPIC_KEY or app.config.get('ANTHROPIC_KEY','')
    if not key:
        return "⚠️ Clé API non configurée. Allez dans Paramètres pour ajouter votre clé Anthropic."
    msgs = list(history or []) + [{"role":"user","content":user}]
    try:
        r = req.post("https://api.anthropic.com/v1/messages",
            headers={"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},
            json={"model":"claude-opus-4-5","max_tokens":max_tokens,"system":system,"messages":msgs},
            timeout=30)
        r.raise_for_status()
        return r.json()["content"][0]["text"]
    except Exception as e:
        return f"⚠️ Erreur API: {str(e)[:120]}"

@app.route('/api/ai/chat', methods=['POST'])
def api_ai_chat():
    d = request.json
    sid = d.get('session_id','default')
    msg = d.get('message','')
    if not msg: return jsonify({'error':'empty'}), 400
    if sid not in _conversations: _conversations[sid] = []
    db = get_db(); c = db.cursor()
    stats = {
        'contacts': c.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
        'events':   c.execute("SELECT COUNT(*) FROM evenements").fetchone()[0],
    }
    system = f"""Tu es NEXUS IA, l'assistant intelligent de l'application coul-contact.net.
Contexte: {stats['contacts']} contacts, {stats['events']} événements.
Tu aides à: rechercher contacts, rédiger messages, planifier événements.
Réponds en français, sois concis et utile."""
    history = _conversations[sid][-10:]
    reply = claude(system, msg, history)
    _conversations[sid].append({"role":"user","content":msg})
    _conversations[sid].append({"role":"assistant","content":reply})
    return jsonify({'reply': reply})

@app.route('/api/ai/generate_message', methods=['POST'])
def api_ai_generate():
    d = request.json
    system = "Tu es un assistant de rédaction. Génère uniquement le texte du message, sans introduction."
    prompt = f"Message {d.get('type','professionnel')} de ton {d.get('ton','formel')} pour {d.get('destinataire','le destinataire')}.\nSujet: {d.get('sujet','')}\nMax 200 mots."
    return jsonify({'message': claude(system, prompt, max_tokens=400)})

@app.route('/api/ai/search_contacts', methods=['POST'])
def api_ai_search():
    d = request.json; q = d.get('query','')
    db = get_db()
    contacts = rows2list(db.execute("SELECT id,prenom,nom,telephone,email,groupe,notes FROM contacts").fetchall())
    import json as js
    system = 'Tu es un assistant de recherche. Retourne UNIQUEMENT {"ids":[...]} sans autre texte.'
    prompt = f"Contacts:\n{js.dumps(contacts,ensure_ascii=False)}\nRequête: {q}"
    raw = claude(system, prompt, max_tokens=200)
    try:
        ids = js.loads(raw.strip()).get('ids',[])
        result = [c for c in contacts if c['id'] in ids]
    except:
        result = []
    return jsonify({'contacts': result})

@app.route('/api/ai/key', methods=['POST'])
def api_set_key():
    global ANTHROPIC_KEY
    key = request.json.get('key','').strip()
    if key:
        ANTHROPIC_KEY = key
        app.config['ANTHROPIC_KEY'] = key
        return jsonify({'ok': True})
    return jsonify({'ok': False}), 400

@app.route('/api/ai/test', methods=['GET'])
def api_test_key():
    result = claude("Réponds uniquement 'OK'.", "Test connexion", max_tokens=10)
    return jsonify({'ok': 'ok' in result.lower(), 'result': result})

# ══════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

# Auto-init pour Render/Gunicorn (appelé au chargement du module)
init_db()
