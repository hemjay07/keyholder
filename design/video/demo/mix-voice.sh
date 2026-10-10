#!/usr/bin/env bash
# design/video/demo/mix-voice.sh [narration.webm] — clean the founder's narration and mix it under the film's music.
# Voice: high-pass 80 Hz, gentle denoise, de-ess, light compression, -16 LUFS. Music: ducked under the voice
# (sidechain), -24 LUFS bed. Output: keyholder-film-voice.mp4 (video copied, faststart).
set -euo pipefail
cd "$(dirname "$0")"
IN="${1:-$HOME/Downloads/narration.webm}"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film-silent.mp4)
ffmpeg -v error -y -i "$IN" -af "highpass=f=80,afftdn=nf=-25,deesser=i=0.4,acompressor=threshold=-20dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=7" -ar 48000 -ac 1 voice-clean.wav
ffmpeg -v error -y -i film-silent.mp4 -i voice-clean.wav -stream_loop -1 -i ../cuts/115.mp3 -filter_complex "\
[2:a]atrim=0:$D,afade=in:st=0:d=1,afade=out:st=$(python3 -c "print($D-4)"):d=4,loudnorm=I=-24:TP=-3[m];\
[1:a]apad,atrim=0:$D,asplit=2[v][sc];\
[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];\
[duck][v]amix=inputs=2:weights='1 1':normalize=0,alimiter=limit=0.95[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 192k -t "$D" -movflags +faststart keyholder-film-voice.mp4
echo "wrote $(pwd)/keyholder-film-voice.mp4"
