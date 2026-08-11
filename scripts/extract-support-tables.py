"""
検証を通った算定表だけを seed 形式に落とす。

★通らなかった範囲は含めない。
  含めなければ参照は null を返し、「目安をお示しできません」となる。
  誤った数字を出すより、出さないほうがよい。
"""
import numpy as np, pymupdf, json, sys
from PIL import Image
SP=sys.argv[1]
BANDS=[(0,1),(1,2)]+[(k,k+2) for k in range(2,60,2)]
IDX={b:i for i,b in enumerate(BANDS)}
Y_BOT,DY,X_L,DX,NX,NY=2294.2,23.717,249.0,35.098,41,81

META={  # 表番号: (最上段の帯(目視), 子の構成キー, 説明)
 1:((24,26),"1:0","表1（子1人・0〜14歳）"),
 2:((28,30),"1:1","表2（子1人・15歳以上）"),
 3:((34,36),"2:00","表3（子2人・第1子及び第2子0〜14歳）"),
 4:((36,38),"2:10","表4（子2人・第1子15歳以上，第2子0〜14歳）"),
 5:((38,40),"2:11","表5（子2人・第1子及び第2子15歳以上）"),
 6:((40,42),"3:000","表6（子3人・第1子，第2子及び第3子0〜14歳）"),
 7:((42,44),"3:100","表7（子3人・第1子15歳以上，第2子及び第3子0〜14歳）"),
 8:((44,46),"3:110","表8（子3人・第1子及び第2子15歳以上，第3子0〜14歳）"),
 9:((44,46),"3:111","表9（子3人・第1子，第2子及び第3子15歳以上）"),
}
def render(n):
    d=pymupdf.open(f"{SP}/youiku-{n}.pdf"); pix=d[0].get_pixmap(matrix=pymupdf.Matrix(3,3))
    return np.array(Image.frombytes("RGB",(pix.width,pix.height),pix.samples).convert("L")).astype(float)
def grid(a):
    def cell(i,j):
        cx=X_L+DX*(i+0.5); cy=Y_BOT-DY*j
        p=a[int(cy-DY*0.30):int(cy+DY*0.30),int(cx-DX*0.30):int(cx+DX*0.30)]
        m=p[p>120]; return bool(np.mean(m<210)>0.5)
    return np.array([[cell(i,j) for i in range(NX)] for j in range(NY)])

out=[]; report=[]
for n,(top,key,ref) in META.items():
    a=render(n); G=grid(a); t=IDX[top]
    up=np.zeros((NY,NX),int)
    for i in range(NX):
        k=0
        for j in range(1,NY):
            if G[j,i]!=G[j-1,i]: k+=1
            up[j,i]=k
    down=np.zeros((NY,NX),int); k=t; down[NY-1,0]=k
    for j in range(NY-2,-1,-1):
        if G[j,0]!=G[j+1,0]: k-=1
        down[j,0]=k
    for j in range(NY):
        k=down[j,0]
        for i in range(1,NX):
            if G[j,i]!=G[j,i-1]: k-=1
            down[j,i]=k

    agree=(up==down)
    bad_cols=sorted(set(np.where(~agree)[1]))
    # ★不一致が右端の列だけなら、その列を除いて採用する
    maxCol = NX-1
    if bad_cols:
        if bad_cols == [NX-1]: maxCol = NX-2
        else:
            report.append((n, ref, "不採用", f"不一致{int((~agree).sum())}セル・{len(bad_cols)}列"))
            continue
    # ★除外後の範囲で単調性を検査する
    d2 = down[:, :maxCol+1]
    if True:
        pass
    if not (np.all(np.diff(d2,axis=0)>=0) and np.all(np.diff(d2,axis=1)<=0) and d2.min()>=0):
        report.append((n, ref, "不採用", "単調性の破れ")); continue

    rows=["".join(f"{d2[j,i]:02d}" for i in range(maxCol+1)) for j in range(NY)]
    out.append({
        "id": f"st_youiku_{n}_r1",
        "targetKey": "CHILD_SUPPORT",
        "childrenKey": key,
        "tableRef": ref,
        "version": 1,
        "status": "PUBLISHED",
        "verified": True,
        "sourceNote": ("裁判所公表「平成30年度司法研究（養育費，婚姻費用の算定に関する実証的研究）」"
                       "令和元年改定標準算定表 "
                       f"https://www.courts.go.jp/vc-files/courts/file5/youiku-{n}.pdf "
                       "帯グラフから機械的に抽出し、両端からの独立計数の一致・単調性・"
                       "図中の最上段ラベルとの照合で検証した。"),
        "payerStepMan": 25, "payeeStepMan": 25,
        "payerMaxMan": 2000, "payeeMaxMan": 25*maxCol,
        "bandLegend": [f"{lo}-{hi}" for lo,hi in BANDS[:int(d2.max())+1]],
        "grid": rows,
    })
    note = "採用" if maxCol==NX-1 else f"採用（権利者{25*(NX-1)}万の列を除外）"
    report.append((n, ref, note, f"帯数{int(d2.max())+1}"))

json.dump(out, open(f"{SP}/supportTables.json","w"), ensure_ascii=False, indent=1)
for r in report: print(f"  表{r[0]}: {r[2]:<28} {r[3]}   {r[1]}")
print(f"\n採用した表: {len(out)}/9")
