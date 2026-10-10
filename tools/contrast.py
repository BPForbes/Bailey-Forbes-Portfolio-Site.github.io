#!/usr/bin/env python3
"""
Contrast check for the token layer in css/styles.css, all four renderings.

The values here are the role tokens as DESIGN.md B1 records them; keep this
table in step with the stylesheet (the stylesheet is the implementation, this
is the proof). Run: python3 tools/contrast.py — exits non-zero on any pair
under its WCAG 2.2 AA floor (4.5:1 text, 3:1 control boundaries and focus).
"""
import sys, itertools
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
themes = {
 "dark": dict(page="#10120f",raised="#181a16",sunken="#1f221c",invert="#f3ead8",
   text="#ebe6d8",muted="#c4bdae",subtle="#8f897b",on_action="#0b0c0a",on_invert="#2a2418",on_invert_muted="#6b5e48",
   border="#2c2f28",border_strong="#3d4036",border_interactive="#6d7264",
   action="#c98a4a",action_hover="#e0b27a",accent="#7ea36a",focus="#e0b27a",ok="#9dc389",wait="#e0b27a",error="#e0685c"),
 "light": dict(page="#f4eee2",raised="#fbf7ee",sunken="#ebe3d2",invert="#fffaf0",
   text="#1f1b14",muted="#4a4336",subtle="#605847",on_action="#ffffff",on_invert="#2a2418",on_invert_muted="#5c5040",
   border="#d8cfbb",border_strong="#b9ad94",border_interactive="#7d7460",
   action="#8a4612",action_hover="#6b350c",accent="#3f6b33",focus="#8a4612",ok="#2f6a2a",wait="#8a4612",error="#a8281f"),
 "dark-hc": dict(page="#000000",raised="#0d0e0c",sunken="#161815",invert="#ffffff",
   text="#ffffff",muted="#f1ede4",subtle="#d9d4c7",on_action="#000000",on_invert="#000000",on_invert_muted="#2b2b2b",
   border="#6f746a",border_strong="#9ea396",border_interactive="#c9cdc3",
   action="#f3bd74",action_hover="#ffd59a",accent="#b8e0a4",focus="#ffffff",ok="#b8e0a4",wait="#f3bd74",error="#ff9d93"),
 "light-hc": dict(page="#ffffff",raised="#ffffff",sunken="#f1f1f1",invert="#ffffff",
   text="#000000",muted="#111111",subtle="#2a2a2a",on_action="#ffffff",on_invert="#000000",on_invert_muted="#2b2b2b",
   border="#8a8a8a",border_strong="#5a5a5a",border_interactive="#2a2a2a",
   action="#6b3400",action_hover="#4a2300",accent="#1f4d17",focus="#000000",ok="#1f4d17",wait="#6b3400",error="#9c1c12"),
}
fails=0
for name,t in themes.items():
    print(f"== {name}")
    checks=[]
    for s in ("page","raised","sunken"):
        for tx in ("text","muted","subtle","action_hover","accent","ok","wait","error"):
            checks.append((tx,s,4.5))
        checks.append(("action",s,3.0))  # large text / icon
        checks.append(("border_interactive",s,3.0))
        checks.append(("focus",s,3.0))
    checks += [("on_action","action",4.5),("on_invert","invert",4.5),("on_invert_muted","invert",4.5),("on_action","action_hover",4.5)]
    for fg,bg,req in checks:
        r=cr(t[fg],t[bg]); flag="" if r>=req else "  <-- FAIL"; 
        if r<req: fails+=1
        print(f"  {fg:>18} on {bg:<8} {r:5.2f} (need {req}){flag}")
print("FAILS:",fails)
sys.exit(1 if fails else 0)
