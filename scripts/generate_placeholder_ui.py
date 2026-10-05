"""Generate original, replaceable 32px pixel sprites for items and battle status.

Existing replacement art is preserved unless --force is explicitly passed.
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'ui' / 'icons'
PALETTE = {'x': '#17303e', 'w': '#fff4ce', 'a': '#ffcf48', 'b': '#ce8e35', 'g': '#79bd80', 'c': '#5bc1d4', 'd': '#3e7ca2', 'r': '#ed795b', 'p': '#b895df'}
ICONS = {
    'item-none': ['............','............','............','............','..xxxxxxxx..','..xxxxxxxx..','............','............','............','............','............','............'],
    'item-sitrus-berry': ['......xx....','.....xggx...','....xggx....','...xxxxxx...','..xaaawaax..','.xaaawaaaax.','.xaaaaaaaax.','.xaaaaabbax.','.xaabbbbbax.','..xabbbbax..','...xxxxxx...','............'],
    'item-leftovers': ['....xxggx...','....xggx....','...xxxxxxx..','..xrrrrrrrx.','.xrwrrrrrrrx','.xrrrrrrrxx.','..xrrrrrxx..','...xwwwx....','...xwwwx....','..xrrrrrx...','...xxxxx....','............'],
    'item-assault-vest': ['..xxx..xxx..','.xcccxxcccx.','xccwwwwccccx','xccwccwccccx','.xccccccccx.','..xccxxccx..','..xccxxccx..','..xccxxccx..','..xccxxccx..','..xccxxccx..','..xxxxxxxx..','............'],
    'item-x-attack': ['....xxxx....','....xccx....','...xxxxxx...','..xrrrrrrx..','..xrwwwwrx..','..xrrwwrrx..','..xrwwwwrx..','..xrrrrrrx..','..xrrrrrrx..','..xrrrrrrx..','...xxxxxx...','............'],
    'item-charizardite-x': ['....xxxx....','...xpwwpx...','..xppwpppx..','.xpppwppppx.','xppppwpppppx','xpppwwwppppx','.xpppwppppx.','..xppwpppx..','...xppppx...','....xxxx....','............','............'],
    'item-fire-stone': ['....xxxx....','...xraarx...','..xraaaarx..','.xraawaaaarx','xraaawaaarrx','xraawwaaarrx','.xraaaaaarrx','..xraaarrrx.','...xrrrrrx..','....xxxxx...','............','............'],
    'item-tm-swift': ['...xxxxxx...','..xaaaaaax..','.xawaaaaaax.','xawaaaaaaaax','xaaaaxxaaabx','xaaaxwwxaabx','xaaaxwwxaabx','xaaaaxxaaabx','xaaaaaaaabbx','.xaaaaabbbx.','..xaaaaaax..','...xxxxxx...'],
    'item-tm-thunderbolt': ['...xxxxxx...','..xccccccx..','.xcwccccccx.','xcwccccccccx','xccccxxccc dx'.replace(' ', ''),'xccc xwwxcddx'.replace(' ', ''),'xcccxwwxcddx','xccccxxccddx','xcccccccdddx','.xccccddddx.','..xccccccx..','...xxxxxx...'],
    'status-burned': ['.....rr.....','....rarr....','....raar....','...raaar....','..raaaarr...','..rawaaarr..','.rawwwaaaar.','.rawwwwaaar.','.rawwwwaa ar.'.replace(' ', ''),'..rawwaa ar..'.replace(' ', ''),'...raaar....','....rrr.....'],
    'status-paralyzed': ['.....aaaa...','....aaaab...','...aaaab....','..aaaab.....','..aaaaaaa...','.....aaab...','....aaab....','...aaab.....','..aaab......','..aab.......','..ab........','..b.........'],
    'status-charged': ['.....aa.....','.....aa.....','....aaaa....','...aawwaa...','..aaawwaaa..','aaawwwwwwaaa','aaawwwwwwaaa','..aaawwaaa..','...aawwaa...','....aaaa....','.....aa.....','.....aa.....'],
    'stage-buff': ['.....gg.....','....gggg....','...gggggg...','..gggggggg..','.gggggggggg.','gggggggggggg','....gggg....','....gggg....','....gggg....','....gggg....','....gggg....','............'],
    'stage-debuff': ['....rrrr....','....rrrr....','....rrrr....','....rrrr....','....rrrr....','....rrrr....','rrrrrrrrrrrr','.rrrrrrrrrr.','..rrrrrrrr..','...rrrrrr...','....rrrr....','.....rr.....'],
}

def svg(rows):
    paths = []
    for key, color in PALETTE.items():
        cells = ''.join(f'M{x + 2} {y + 2}h1v1h-1z' for y, row in enumerate(rows) for x, cell in enumerate(row) if cell == key)
        if cells:
            paths.append(f'<path fill="{color}" d="{cells}"/>')
    return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges">' + ''.join(paths) + '</svg>\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--force', action='store_true', help='Replace existing named icons with the pixel sprites')
    args = parser.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, rows in ICONS.items():
        path = ROOT / f'{name}.svg'
        if not path.exists() or args.force:
            path.write_text(svg(rows), encoding='utf-8')
    print(f'Ready: {len(ICONS)} named pixel icons in {ROOT}')
