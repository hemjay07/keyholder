# design/video/demo/cut.py — assembles the product demo from the recorded scenes: one caption per scene (every figure
# is on screen in the product itself), title and end cards, music under. Output: keyholder-demo.mp4 (1920x1080, 30 fps).
import subprocess, json, os
from PIL import Image, ImageDraw, ImageFont
FONT = os.path.abspath('../film/Geist-Regular.ttf'); MONO = os.path.abspath('../film/GeistMono-Regular.ttf')
BG, INK, SIG = '0xE6E2D9', '0x1B1A17', '0xA32F06'
SCENES = [  # (clip, start, end, caption)
  ('home', 0.5, 5.8, '$769M on Solana sits behind programs that can be upgraded with no waiting period.'),
  ('stages', 1.0, 18.0, 'Four Control Stages, from one key to cannot be changed. Each told with a real program.'),
  ('map', 2.6, 9.6, 'All 577 live programs on their stage. Height is the money traced to each.'),
  ('program', 0.6, 9.2, 'Kamino Lend: upgrades wait 24 h, but a 4-of-10 admin key can act at once. The weakest path sets the stage.'),
  ('signer', 0.8, 8.6, 'One signer key: 6 multisigs, $1.5B behind it, and it can act alone on two of them.'),
  ('votes', 0.6, 10.4, '53 open multisig votes could change control right now. One was approved 713 days ago.'),
  ('ask', 1.0, 9.6, 'Ask Keyholder: names and addresses answer straight from the record.'),
  ('drift', 3.0, 23.8, 'Drift lost $285M. Keyholder\'s rules flag the first control change 5.6 days before the money moved.'),
  ('build', 1.0, 14.0, 'require_stage: one line refuses money where control is weak. It refused a real devnet deposit 23 s after a multisig was weakened.'),
  ('self', 0.8, 7.4, 'Keyholder follows its own rule: its upgrade waits 48 hours behind a 2-of-3 multisig.'),
  ('changes', 0.6, 8.6, 'Every control change, read from mainnet, anchored on chain every day.'),
]
def esc(t): return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", "’").replace('%', '\\%')
def run(a): subprocess.run(a, check=True)
os.makedirs('seg', exist_ok=True)
segs = []
# This ffmpeg has no drawtext: captions and cards are drawn with PIL in Geist and overlaid.
hexc = lambda c: '#' + c[2:]
def card(name, lines, dur):
    im = Image.new('RGB', (1920, 1080), hexc(BG)); d = ImageDraw.Draw(im)
    total = sum(size + 36 for _, size, _, _ in lines) - 36; y = (1080 - total) // 2
    for txt, size, col, font in lines:
        f = ImageFont.truetype(font, size); w = d.textlength(txt, font=f)
        d.text(((1920 - w) / 2, y), txt, font=f, fill=hexc(col)); y += size + 36
    png = f'seg/{name}.png'; im.save(png); out = f'seg/{name}.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-t', str(dur), '-i', png, '-vf', f'fps=30,fade=in:0:12,fade=out:st={dur-0.4}:d=0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out])
    segs.append(out)
def caption_png(text, path):
    im = Image.new('RGBA', (1920, 150), (27, 26, 23, 220)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 38); words = text.split(); lines = ['']
    for w in words:
        t = (lines[-1] + ' ' + w).strip()
        if d.textlength(t, font=f) > 1776: lines.append(w)
        else: lines[-1] = t
    if len(lines) > 1: f = ImageFont.truetype(FONT, 32)
    lh = 44 if len(lines) > 1 else 0; y = (150 - (len(lines) * 40 + (len(lines) - 1) * 4)) // 2
    for ln in lines: d.text((72, y), ln, font=f, fill='#F4F1EA'); y += 44
    im.save(path)
card('00-title', [('Keyholder', 110, INK, FONT), ('the control record for Solana', 40, '0x5A564E', MONO)], 3.2)
for i, (clip, a, b, cap) in enumerate(SCENES):
    out = f'seg/{i+1:02d}-{clip}.mp4'
    cp = f'seg/{i+1:02d}-cap.png'; caption_png(cap, cp)
    fc = f"[0:v]scale=1920:1080,fps=30[v];[v][1:v]overlay=0:H-150,fade=in:0:9,fade=out:st={b-a-0.3}:d=0.3[o]"
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-to', str(b), '-i', f'raw/{clip}.webm', '-i', cp, '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out])
    segs.append(out)
card('99-end', [('Who can move it, how fast, and did that change?', 64, INK, FONT), ('keyholder-ashy.vercel.app', 40, SIG, MONO)], 4.0)
with open('seg/list.txt', 'w') as f: f.writelines(f"file '{os.path.basename(s)}'\n" for s in segs)
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', 'silent.mp4'])
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'silent.mp4'], capture_output=True, text=True).stdout)
run(['ffmpeg', '-v', 'error', '-y', '-i', 'silent.mp4', '-i', '../cuts/115.mp3', '-filter_complex', f"[1:a]atrim=0:{dur},afade=in:st=0:d=1.5,afade=out:st={dur-3}:d=3,volume=0.85[a]", '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'keyholder-demo.mp4'])
print(json.dumps({'duration_s': round(dur, 1), 'file': os.path.abspath('keyholder-demo.mp4')}))
