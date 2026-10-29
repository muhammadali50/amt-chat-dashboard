"""Heuristic scan of reachable Git blobs and local source, with values suppressed."""
import pathlib, re, subprocess, json
patterns = {
 'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY',
 'Supabase secret': rb'sb_secret_[A-Za-z0-9_-]{16,}',
 'JWT credential': rb'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
 'provider token': rb'(?:ghp_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]{16,}',
 'assigned credential': rb'''(?im)^[ \t]*(?:ADMIN_PASSWORD|SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY|AUTH_REDIS_REST_TOKEN)[ \t]*=[ \t]*["']?[^\s"']{8,}'''
}
findings = []
seen = set()
for line in subprocess.check_output(['git', 'rev-list', '--objects', '--all']).splitlines():
 parts = line.split(b' ', 1)
 if len(parts) != 2: continue
 oid, name = parts
 if oid in seen: continue
 seen.add(oid)
 if subprocess.check_output(['git','cat-file','-t',oid.decode()]).strip() != b'blob': continue
 data = subprocess.check_output(['git','cat-file','blob',oid.decode()])
 for label, pattern in patterns.items():
  if re.search(pattern,data): findings.append({'object':oid.decode()[:12],'file':name.decode(errors='replace'),'type':label})
for p in pathlib.Path('.').rglob('*'):
 if any(x in p.parts for x in ('.git','node_modules','.next','.agents','.codex','.aws')) or not p.is_file(): continue
 if p.stat().st_size > 5_000_000: continue
 for label,pattern in patterns.items():
  if re.search(pattern,p.read_bytes()): findings.append({'file':str(p),'type':label})
print(json.dumps({'findings':findings,'values':'suppressed','scope':'reachable Git blobs and local project files'},indent=2))
raise SystemExit(bool(findings))
