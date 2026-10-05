type PixelPortrait = { rows: string[]; colors: Record<string, string> };
const ink = '#17303e';
const portraits: Record<string, PixelPortrait> = {
  bulbasaur: { colors: { x: ink, a: '#77bf9a', b: '#ade6b3', c: '#428a72', l: '#6da64b', d: '#356348', w: '#fff8df', r: '#db5862' }, rows: [
    '................','......dd........','.....dllld......','....dllllld.....','...dlllldlld....','...xdddddddx....','..xxaaaaaaaaxx..','..xabbaabaaabx..','..xawxaawxaacx..','..xaaxaaxaacxx..','...xaarraacxaa..','..xaaaaaacxaaax.','..xaacaaaacaaax.','..xxcxxaaxxcaxx.','...xx..xx..xx...','................'] },
  squirtle: { colors: { x: ink, a: '#6bbfd7', b: '#a2e0e6', c: '#37859f', s: '#a97c4a', p: '#f6d9a0', w: '#fff8df' }, rows: [
    '................','.....xxxxx......','....xabbabx.....','...xabbbaaax....','...xawxaawax....','...xaxxaaxax....','....xaaaaax.....','.....xxxxx......','...xxssppsxx....','..xaasppppsaax..','..xaasppppsaax..','...xxsppppsxx...','.....xppppx..xx.','....xacxxcaxxaax','....xxx..xxxxxx.','................'] },
  lapras: { colors: { x: ink, a: '#6ab4d2', b: '#a6dded', s: '#889d9e', p: '#e9e0c2', w: '#fff8df' }, rows: [
    '................','.........xx.....','........xaxxx...','........xabbaax.','.......xabwxaax.','.......xaaaaxx..','.......xaax.....','.......xaax.....','.....xxxaax.....','...xxsssaax.....','..xasspsaaax....','.xabsssssaaax...','xabbppppppaax...','.xxpppppppxx....','..xaxx..xxaax...','...xx....xxx....'] },
  geodude: { colors: { x: ink, a: '#ad966c', b: '#d4bf8d', c: '#7d6d56', w: '#fff8df' }, rows: [
    '................','................','.....xxxxxx.....','....xabbbaax....','...xabbaaaaax...','..xabbaaaacaax..','..xawxxaaxxwax..','xxxaxxxaaxxxcxxx','xaaxaaaaaaaaxacx','xabxaaxxxaacxbax','xxxxaax..xacxxxx','...xaaxxxaacx...','....xaaaaacx....','.....xxxxxx.....','................','................'] },
  pikachu: { colors: { x: ink, a: '#f1cc43', b: '#fff08a', c: '#caa037', r: '#e4675a', w: '#fff8df' }, rows: [
    '..xx........xx..','..xax......xax..','..xaax....xaax..','...xaax..xaax...','...xaaaaaaaax...','..xabbbaaabaax..','..xawxaawxaacx..','..xrxxaaxxarcx..','..xaarraaaacxx..','...xaaaaaacx..xx','...xabbaaaax.xax','..xabbbaaacxxaax','..xaaaaaacxaxxx.','...xaaxxaacxx...','...xxx..xxx.....','................'] },
  meowth: { colors: { x: ink, a: '#e9dec0', b: '#fff3d4', c: '#b6a78c', r: '#d88d86', g: '#f3c74c', w: '#fff' }, rows: [
    '..xx........xx..','..xax......xax..','..xraxx..xxrax..','...xaggggaaax...','..xabbggabbabx..','..xabwxawxbaax..','xxxaxxaxxaaxx...','..xaaaaaaaaxxx..','xxxaaarrraaax...','...xaaaaaaax....','....xaaaaax..xx.','...xabbaaaaxxaax','...xaaaaacx..xax','....xaxxcx..xax.','....xx..xxxxxx..','................'] },
  vulpix: { colors: { x: ink, a: '#d98b54', b: '#f3b875', c: '#ae643e', t: '#e8a759', w: '#fff5db' }, rows: [
    '................','................','..xx......xxx...','..xax....xtttx..','..xaxx..xttxttx.','...xaaaaxttxttx.','..xabbaaxxttxttx','..xabwxacxttxttx','..xaxxaacxtxttx.','...xaaaacxtttx..','....xaaaacxxx...','...xaaaaaaacx...','...xaacaaaacx...','...xaxxcxxcax...','...xx..xx.xx....','................'] },
  charmander: { colors: { x: ink, a: '#e69354', b: '#ffc078', c: '#b86741', p: '#ffe3a4', f: '#ef6551', g: '#ffd352', r: '#b86741', w: '#fff5df' }, rows: [
    '................','.....xxxx.......','....xabbax......','...xabbbaax.....','...xawxaaxax....','...xaxxaaxax....','....xaaaaax.....','.....xaarx......','.....xppax...ff.','....xappax..fgf.','...xaapppaaxfgf.','...xaapppaaxxf..','....xappaxaaax..','....xacxxcaxx...','....xxx..xxx....','................'] },
  'charizard-mega-x': { colors: { x: ink, a: '#31536d', b: '#517891', c: '#223b51', t: '#54ced7', w: '#cefaff' }, rows: [
    '..x..........x..','..xx..x..x..xx..','..xtx.xaax.xtx..','..xttxaaaxtttx..','...xtxaaxaxtx...','x...xatwatax...x','xx...xaaaax...xx','xtx..xaaaax..xtx','xttxxaattaxxxttx','.xtxaattttaxttx.','..xxaattttaaxx..','...xaattttaax...','....xaattax..tt.','....xacxxcaxatt.','....xxx..xxxxt..','................'] },
};
portraits.ivysaur = { ...portraits.bulbasaur, colors: { ...portraits.bulbasaur.colors, l: '#e081a2', d: '#87506e' } };
portraits.wartortle = { ...portraits.squirtle, rows: ['..xx......xx....','..xaxxxxxxaax...','..xxabbabaxx....', ...portraits.squirtle.rows.slice(3)], colors: { ...portraits.squirtle.colors, a: '#82b7e0', b: '#d3e7f6' } };
portraits.ninetales = { ...portraits.vulpix, colors: { ...portraits.vulpix.colors, a: '#e4d4a6', b: '#fff0c5', c: '#b9a376', t: '#f4e6b4' } };
const portraitPaths = Object.fromEntries(Object.entries(portraits).map(([id, sprite]) => [id, Object.entries(sprite.colors).map(([key, fill]) => ({ fill, d: sprite.rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === key ? [`M${x * 4} ${y * 4}h4v4h-4z`] : [])).join('') }))]));

export default function SpeciesPortrait({ id }: { id: string }) {
  const sprite = portraitPaths[id];
  return <span className="species-portrait" aria-hidden="true"><svg viewBox="0 0 64 64" shapeRendering="crispEdges" role="presentation" focusable="false">
    {sprite ? sprite.map(({ fill, d }, index) => <path key={index} fill={fill} d={d} />) : <><path d="M12 8h40v48H12z" fill="#d8e7df" stroke={ink} strokeWidth="4" /><text x="32" y="39" textAnchor="middle" fill={ink} fontFamily="var(--pixel-font)" fontSize="20">{id.slice(0, 1).toUpperCase()}</text></>}
  </svg></span>;
}
