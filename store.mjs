export class SqlStore{
 constructor(db){this.db=db;}
 async document(){return this.db.prepare('SELECT body, revision FROM buildboard_state WHERE key = ?').bind('owner').first();}
 async initialize(state){await this.db.prepare('INSERT OR IGNORE INTO buildboard_state (key,body,revision) VALUES (?,?,1)').bind('owner',JSON.stringify(state)).run();return this.document();}
 async save(state,revision){const result=await this.db.prepare('UPDATE buildboard_state SET body = ?, revision = revision + 1 WHERE key = ? AND revision = ?').bind(JSON.stringify(state),'owner',revision).run();return Number(result.meta?.changes||0)>0;}
 async session(hash){return this.db.prepare('SELECT csrf, expires_at FROM buildboard_sessions WHERE token_hash = ?').bind(hash).first();}
 async createSession(hash,csrf,expires){await this.db.prepare('DELETE FROM buildboard_sessions WHERE expires_at <= ?').bind(Date.now()).run();await this.db.prepare('INSERT INTO buildboard_sessions (token_hash,csrf,expires_at) VALUES (?,?,?)').bind(hash,csrf,expires).run();}
 async deleteSession(hash){await this.db.prepare('DELETE FROM buildboard_sessions WHERE token_hash = ?').bind(hash).run();}
 async limit(key){return this.db.prepare('SELECT attempts, reset_at FROM buildboard_login_limits WHERE key = ?').bind(key).first();}
 async failure(key,now){await this.db.prepare('INSERT INTO buildboard_login_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END').bind(key,now+900000,now,now,now+900000).run();}
 async clearLimit(key){await this.db.prepare('DELETE FROM buildboard_login_limits WHERE key = ?').bind(key).run();}
}
