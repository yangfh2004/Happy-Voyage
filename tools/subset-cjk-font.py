"""Rebuild client/public/fonts/sea-names.ttf: Noto Sans SC limited to the CJK text the game ships.

Usage: python3 tools/subset-cjk-font.py path/to/NotoSansSC[wght].ttf
(Noto Sans SC variable font: https://github.com/google/fonts/tree/main/ofl/notosanssc)
"""
import glob, re, subprocess, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
CJK = re.compile(r'[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\u2014\u2018\u2019\u201c\u201d\u2026\u00b7]')
chars = set()
for pattern in ('client/src/**/*.ts', 'client/src/**/*.tsx', 'shared/src/**/*.ts', 'client/index.html'):
    for file in glob.glob(str(root / pattern), recursive=True):
        chars |= set(CJK.findall(Path(file).read_text(encoding='utf-8')))
text = ''.join(sorted(chars))
subprocess.run(['pyftsubset', sys.argv[1], f'--text={text}', '--layout-features=*', '--no-hinting',
                f'--output-file={root / "client/public/fonts/sea-names.ttf"}'], check=True)
print(f'{len(chars)} characters')
