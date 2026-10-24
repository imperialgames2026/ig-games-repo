"""Original, exact betting cloth art. Presentation markings do not enable wagers."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import random
OUT=Path(__file__).resolve().parents[1]/'unity/PracticeBridge/Assets'
OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
GOLD='#dfd1a1'; WHITE='#f3ecd2'; RED='#a82c3b'
def cloth():
 im=Image.new('RGB',(2048,1024)); p=im.load();r=random.Random(77)
 for y in range(1024):
  for x in range(2048):
   v=r.randrange(4)+(1 if x%3==0 else 0);p[x,y]=(7+v,73+v,51+v)
 return im,ImageDraw.Draw(im)
def text(d,xy,s,size=40,color=WHITE,bold=True):
 d.text(xy,s,font=ImageFont.truetype(BOLD if bold else FONT,size),fill=color,anchor='mm')
im,d=cloth();d.rounded_rectangle((22,22,2026,1002),radius=90,outline=GOLD,width=5)
text(d,(1024,100),'IMPERIAL GAMING',84,GOLD)
for left in [95,1100]:
 for i,n in enumerate(['4','5','SIX','8','NINE','10']):
  x=left+i*141;d.rectangle((x,190,x+141,350),outline=GOLD,width=3);text(d,(x+70,270),n,38)
 text(d,(left+423,440),'COME',85,'#ec776c');d.rounded_rectangle((left,515,left+846,755),radius=60,outline=GOLD,width=3)
 text(d,(left+423,570),'FIELD',52);text(d,(left+423,670),'2   3   4   9   10   11   12',35)
 d.rounded_rectangle((left-15,800,left+861,980),radius=35,outline=GOLD,width=4)
 text(d,(left+423,834),'PASS LINE  •  PAYS 1:1',35)
 text(d,(left+423,883),'COME OUT: 7 / 11 WIN • 2 / 3 / 12 LOSE',22)
 text(d,(left+423,930),'POINT: REPEAT YOUR NUMBER BEFORE A 7',22)
text(d,(1024,470),'PRACTICE',22,GOLD);text(d,(1024,520),'ONLY',22,GOLD)
im.save(OUT/'CrapsCloth.png',optimize=True)
im,d=cloth();x0,y0,cw,ch=260,190,142,170
# Standard single-zero three-row layout, ascending columns.
reds={1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}
d.rectangle((70,y0,x0,y0+3*ch),fill='#12844e',outline=GOLD,width=4);text(d,(165,380),'0',65);text(d,(165,500),'35:1',30)
for col in range(12):
 for row in range(3):
  n=col*3+3-row;x=x0+col*cw;y=y0+row*ch
  d.rectangle((x,y,x+cw,y+ch),fill=RED if n in reds else '#172a25',outline=GOLD,width=3);text(d,(x+cw/2,y+ch/2),str(n),45)
for i,t in enumerate(['1st 12','2nd 12','3rd 12']):
 x=x0+i*4*cw;d.rectangle((x,700,x+4*cw,815),outline=GOLD,width=3);text(d,(x+2*cw,757),t,40)
for i,t in enumerate(['1–18','EVEN','RED','BLACK','ODD','19–36']):
 x=x0+i*2*cw;d.rectangle((x,815,x+2*cw,945),fill=RED if t=='RED' else '#101a19' if t=='BLACK' else None,outline=GOLD,width=3);text(d,(x+cw,854),t,32);text(d,(x+cw,917),'PAYS 1:1',23)
text(d,(1024,90),'IMPERIAL GAMING',84,GOLD)
im.save(OUT/'RouletteCloth.png',optimize=True)
print('Created original roulette and craps cloth textures.')
