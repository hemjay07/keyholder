# Restore the video sources and plans lost from /private/tmp/lv (cleared by macOS on 2026-10-01),
# by replaying, in order, the Write calls and file edits recorded in the session transcript.
# Only entries before 2026-10-01 are replayed, so this script never finds itself.
import json, re, os, subprocess
T = '/Users/mujeeb/.claude/projects/-Users-mujeeb-ledge/d18f8cb9-2796-46f9-8fe2-7a64100b9757.jsonl'
NEW = '/Users/mujeeb/controlplane/design/video'
CUTOFF = '2026-10-01'
os.makedirs(NEW + '/film', exist_ok=True); os.makedirs(NEW + '/cuts', exist_ok=True)
TARGETS = ['film2.html', 'arch.html', 'anatomy.html', 'film.html', 'SHOT-LIST.md', 'KEYHOLDER-DEMO-PLAN.md', 'VOICEOVER-TECHNICAL.md', 'X-PLAN.md', 'PLAN-FULL-FILM.md', 'BRIEF.md']
KEEP = ['BRIEF.md', 'film/film.html', 'film/film2.html', 'PLAN-FULL-FILM.md', 'KEYHOLDER-DEMO-PLAN.md', 'film/arch.html', 'film/anatomy.html', 'VOICEOVER-TECHNICAL.md', 'X-PLAN.md', 'cuts/watch.html']
log = []
def run(snippet, cwd):
    snippet = snippet.replace('/private/tmp/lv', NEW)
    return subprocess.run(['bash', '-c', snippet], cwd=cwd, capture_output=True, text=True, timeout=30).returncode
for line in open(T):
    try: d = json.loads(line)
    except Exception: continue
    if str(d.get('timestamp', '9999')) >= CUTOFF: continue
    m = d.get('message', {})
    if d.get('type') != 'assistant' or not isinstance(m.get('content'), list): continue
    for c in m['content']:
        if c.get('type') != 'tool_use': continue
        i = c.get('input', {})
        if c['name'] == 'Write' and i.get('file_path', '').startswith('/private/tmp/lv/'):
            rel = i['file_path'][len('/private/tmp/lv/'):]
            if rel in KEEP:
                open(os.path.join(NEW, rel), 'w').write(i['content']); log.append('W ' + rel)
        elif c['name'] == 'Bash':
            cmd = i.get('command', '')
            if not any(t in cmd for t in TARGETS) or 'restore.py' in cmd: continue
            cwd = NEW + '/film' if 'cd /private/tmp/lv/film' in cmd else NEW
            for blk in re.findall(r"python3 - (?:\"[^\"]*\" )?<<'EOF'\n(.*?)\nEOF", cmd, re.S):
                if any(t in blk for t in TARGETS) and "open(p,'w')" in blk and 'subprocess' not in blk:
                    rc = run("python3 - <<'EOF'\n" + blk + "\nEOF", cwd); log.append(f'P rc={rc} ' + [t for t in TARGETS if t in blk][0])
            for s in re.findall(r"(sed -i '' (?:'[^']*'|\"[^\"]*\")(?: -e (?:'[^']*'|\"[^\"]*\"))* [^\s&;|]+)", cmd):
                if any(t in s for t in TARGETS): rc = run(s, cwd); log.append(f'S rc={rc} ' + s[-45:])
            for f, body in re.findall(r"cat > (/private/tmp/lv/[A-Za-z\-\.]+\.md) <<'EOF'\n(.*?)\nEOF", cmd, re.S):
                open(f.replace('/private/tmp/lv', NEW), 'w').write(body + '\n'); log.append('C ' + f)
print('\n'.join(log))
