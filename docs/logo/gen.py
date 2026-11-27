import os, textpath as T
Y='#FFB01D'; INK='#1F1F1C'; W='#FFFFFF'; OR='#F2460F'; DARK='#1F1F1C'
FLAME_O='M50 0 C58 18 82 36 82 70 C82 98 66 116 50 116 C34 116 18 98 18 72 C18 56 26 44 34 36 C34 50 40 58 46 60 C42 40 44 18 50 0 Z'
FLAME_I='M50 64 C58 76 66 84 66 96 C66 106 59 112 50 112 C41 112 34 106 34 96 C34 86 42 76 50 64 Z'
def flame(cx, top, h, c1, c2):
    s=h/116.0
    return f'<g transform="translate({cx-50*s:.2f} {top:.2f}) scale({s:.4f})"><path d="{FLAME_O}" fill="{c1}"/><path d="{FLAME_I}" fill="{c2}"/></g>'
# ---- marks: return (svg, w, h) drawn at origin, given height h
def mark1(h, bg_c, fl_c, in_c):
    r=h/2; return (f'<circle cx="{r}" cy="{r}" r="{r}" fill="{bg_c}"/>'+flame(r, h*0.17, h*0.66, fl_c, in_c), h, h)
def mark2(h, body_c, fl_c, in_c):
    s=h/128.0
    g=(f'<g transform="scale({s:.4f})" fill="{body_c}">'
       '<path fill-rule="evenodd" d="M36 0 H64 A8 8 0 0 1 72 8 V22 A6 6 0 0 1 66 28 H34 A6 6 0 0 1 28 22 V8 A8 8 0 0 1 36 0 Z M40 7 H60 A3 3 0 0 1 63 10 V16 A3 3 0 0 1 60 19 H40 A3 3 0 0 1 37 16 V10 A3 3 0 0 1 40 7 Z"/>'
       '<rect x="6" y="30" width="88" height="86" rx="32"/>'
       '<path d="M20 112 H80 V124 A4 4 0 0 1 76 128 H24 A4 4 0 0 1 20 124 Z"/></g>')
    g+=flame(50*s, 46*s, 60*s, fl_c, in_c)
    return (g, 100*s, h)
def mark3(h, a_c, fl_c, in_c):
    s=h/110.0
    g=f'<g transform="scale({s:.4f})"><path d="M46 0 H74 L120 110 H93 L60 30 L27 110 H0 Z" fill="{a_c}"/></g>'
    g+=flame(60*s, 44*s, 66*s, fl_c, in_c)
    return (g, 120*s, h)
# ---- wordmark
def word(size, c1, c2, x=0, base=0):
    d1,w1=T.text('AMARILLA','800',size,x,base,track=-15)
    d2,w2=T.text('GAS','500',size,x+w1+size*0.04,base,track=60)
    return f'<path d="{d1}" fill="{c1}"/><path d="{d2}" fill="{c2}"/>', w1+size*0.04+w2
def lockup_h(markfn, mcols, wcols, size=100, pad=0, gapk=0.30, mk=1.8):
    cap=T.capheight('800',size); mh=cap*mk
    m,mw,_=markfn(mh,*mcols)
    gap=size*gapk; wsvg,ww=word(size,*wcols,x=mw+gap, base=mh/2+cap/2)
    W_=mw+gap+ww; H_=mh
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W_+2*pad:.1f} {H_+2*pad:.1f}">{m}{wsvg}</svg>'
def lockup_v(markfn, mcols, wcols, size=100, mh=150):
    m,mw,_=markfn(mh,*mcols); cap=T.capheight('800',size)
    _,ww=word(size,*wcols); gap=size*0.38
    wsvg,_=word(size,*wcols,x=0,base=mh+gap+cap)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ww:.1f} {mh+gap+cap:.1f}"><g transform="translate({(ww-mw)/2:.1f} 0)">{m}</g>{wsvg}</svg>'
def icon(markfn, mcols, bg, k=0.62, dy=0):
    mh=512*k; m,mw,_=markfn(mh,*mcols)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="{bg}"/><g transform="translate({(512-mw)/2:.1f} {(512-mh)/2+dy:.1f})">{m}</g></svg>'
V={
 '1-llama': dict(fn=mark1, onY=(INK,Y,W), onD=(Y,INK,W), wY=(INK,INK), wD=(W,Y),
                 icon=dict(mcols=(INK,Y,W), bg=Y, k=0.70)),
 '2-garrafa': dict(fn=mark2, onY=(INK,Y,W), onD=(Y,DARK,W), wY=(INK,INK), wD=(W,Y),
                 icon=dict(mcols=(INK,Y,W), bg=Y, k=0.66)),
 '3-a-llama': dict(fn=mark3, onY=(INK,INK,Y), onD=(Y,W,DARK), wY=(INK,INK), wD=(W,Y),
                 icon=dict(mcols=(Y,W,DARK), bg=INK, k=0.56, dy=-6)),
}
out='svg'; os.makedirs(out,exist_ok=True)
for k,v in V.items():
    open(f'{out}/{k}-fondo-amarillo.svg','w').write(lockup_h(v['fn'],v['onY'],v['wY']))
    open(f'{out}/{k}-fondo-oscuro.svg','w').write(lockup_h(v['fn'],v['onD'],v['wD']))
    open(f'{out}/{k}-vertical-amarillo.svg','w').write(lockup_v(v['fn'],v['onY'],v['wY']))
    open(f'{out}/{k}-icono.svg','w').write(icon(v['fn'],**v['icon']))
print(os.listdir(out))

# ---- assets finales de la app (opción 2: garrafa)
def icon_full(markfn, mcols, bg, k):
    mh=512*k; m,mw,_=markfn(mh,*mcols)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="{bg}"/><g transform="translate({(512-mw)/2:.1f} {(512-mh)/2:.1f})">{m}</g></svg>'
v=V['2-garrafa']; A='app'; os.makedirs(A,exist_ok=True)
files={
 'logo.svg': lockup_v(v['fn'],v['onY'],v['wY']),
 'logo-oscuro.svg': lockup_v(v['fn'],v['onD'],v['wD']),
 'logo-horizontal.svg': lockup_h(v['fn'],v['onY'],v['wY']),
 'logo-horizontal-oscuro.svg': lockup_h(v['fn'],v['onD'],v['wD']),
 'isotipo.svg': mark2(128,INK,Y,W)[0].join(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 128">','</svg>']),
 'favicon.svg': icon(v['fn'],**v['icon']),
 'icono-completo.svg': icon_full(v['fn'],(INK,Y,W),Y,0.66),
 'icono-maskable.svg': icon_full(v['fn'],(INK,Y,W),Y,0.5),
}
for n,s in files.items(): open(f'{A}/{n}','w').write(s)
