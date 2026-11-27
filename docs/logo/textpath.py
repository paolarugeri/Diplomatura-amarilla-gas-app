from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
F='node_modules/@fontsource/montserrat/files/montserrat-latin-%s-normal.woff'
_c={}
def font(w):
    if w not in _c: _c[w]=TTFont(F%w)
    return _c[w]
def text(s, w, size, x=0, y=0, track=0):
    """returns (d, width). y = baseline. track in em units/1000"""
    f=font(w); gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
    sc=size/upm; pen=SVGPathPen(None); cx=0; ds=[]
    for i,ch in enumerate(s):
        g=cmap[ord(ch)]; p=SVGPathPen(gs)
        tp=TransformPen(p,(sc,0,0,-sc,x+cx*sc,y))
        gs[g].draw(tp); ds.append(p.getCommands())
        cx+=gs[g].width + (track if i<len(s)-1 else 0)
    return ' '.join(ds), cx*sc
def capheight(w,size):
    f=font(w); return f['OS/2'].sCapHeight*size/f['head'].unitsPerEm
