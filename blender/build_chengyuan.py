"""Rebuild Chengyuan as a reproducible Blender -> raw GLB -> Web3D asset.
Run: /usr/local/bin/3dpy blender/build_chengyuan.py
"""
from pathlib import Path
import sys
import json
import math
import random
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from chengyuan_lib import Model, Props, Ledger, create_materials, F1, F2, RNG

SPECS = {
    "living":   {"cx": 0, "cz": 2.75, "w": 12, "d": 10.5},
    "study":    {"cx": -10, "cz": 4, "w": 8, "d": 8},
    "guest":    {"cx": -10, "cz": -4, "w": 8, "d": 8, "window": "back"},
    # Keep the 8 m frontage but return the rear third to circulation: 64 -> 42.7 m².
    "gym":      {"cx": 10, "cz": 16/3, "w": 8, "d": 16/3},
    "kitchen":  {"cx": 10, "cz": -4, "w": 8, "d": 8, "window": "back"},
    "dining":   {"cx": 3, "cz": -5.25, "w": 6, "d": 5.5, "window": "back"},
    "bath1":    {"cx": -4.5, "cz": -5.25, "w": 3, "d": 5.5, "wet": True, "window": "back"},
    "shower1":  {"cx": -1.5, "cz": -5.25, "w": 3, "d": 5.5, "wet": True, "window": "back"},
    "master":   {"cx": -10, "cz": 0, "w": 8, "d": 16},
    "bedroom2": {"cx": 10, "cz": -4, "w": 8, "d": 8, "window": "back"},
    "gaming":   {"cx": 10, "cz": 4, "w": 8, "d": 8, "door": True},
    "bath2":    {"cx": -3, "cz": -5.25, "w": 6, "d": 5.5, "wet": True, "window": "back"},
    "shower2":  {"cx": 3, "cz": -5.25, "w": 6, "d": 5.5, "wet": True, "window": "back"},
}
ROOMS = json.loads((ROOT / "src" / "rooms.json").read_text())
GROUP = {1: "Floor1", 2: "Floor2"}
CUT = {1: "Cut1", 2: "Cut2"}
b = None


def tree(group, x, z, height=5.5, potted=True, seed=None):
    """Branching olive with folded leaves; landscape trees add roots and a mulch bed."""
    # A private seed keeps new garden trees from changing the established interiors.
    rng = random.Random(seed) if seed is not None else RNG
    base = .02
    if potted:
        b.cylinder(group, "clay", (x, base + .22, z), .48, .44, .56, segments=28)
        b.cylinder(group, "soil", (x, base + .45, z), .5, .05)
        trunk_base = base + .4
    else:
        b.cylinder(group, "grassAlt", (x, .012, z), 1.15, .024, segments=36)
        b.cylinder(group, "soil", (x, .027, z), .88, .032, segments=36)
        trunk_base = .04
        for root in range(7):
            angle = root * math.tau / 7 + rng.uniform(-.18, .18)
            reach = height * rng.uniform(.055, .08)
            b.rod(group, "walnut", (x, .09, z),
                  (x + math.cos(angle) * reach, .035, z + math.sin(angle) * reach),
                  height * .0035, 10)
    b.rod(group, "walnut", (x, trunk_base, z), (x + .12, height * .63, z - .08), height * .035, 14)
    branch_count = 20 if potted else 28
    leaf_steps = 28 if potted else 34
    for branch in range(branch_count):
        a = branch * 2.39996
        y = height * (.40 + (branch % 6) * .075)
        start = (x + .06, y, z)
        end = (x + math.cos(a) * height * (.19 + (branch % 3) * .025), y + height * .16, z + math.sin(a) * height * .2)
        b.rod(group, "walnut", start, end, height * .008, 9)
        for j in range(leaf_steps):
            t = (j + 1) / (leaf_steps + 1)
            for leaf in range(2):
                px = start[0] + (end[0] - start[0]) * t + rng.uniform(-.38, .38)
                py = start[1] + (end[1] - start[1]) * t + rng.uniform(-.24, .34)
                pz = start[2] + (end[2] - start[2]) * t + rng.uniform(-.38, .38)
                ang = a + rng.uniform(-1.7, 1.7) + leaf * 1.2
                length = rng.uniform(.16, .30) * height / 5.5
                ux, uz = math.cos(ang), math.sin(ang)
                vx, vz = -uz, ux
                tilt = rng.uniform(-.13, .13)
                verts = [(px - ux * length, py - .045, pz - uz * length),
                         (px + vx * length * .38, py + tilt, pz + vz * length * .38),
                         (px + ux * length, py + .055, pz + uz * length),
                         (px - vx * length * .38, py - tilt, pz - vz * length * .38)]
                b.quad(group, "leaf" if (j + leaf) % 3 else "leafLight", verts)
        # Outer leaf clusters round out the mature crown without changing the
        # established potted trees or consuming the house's shared random seed.
        for cluster_leaf in range(0 if potted else 30):
            angle = rng.uniform(0, math.tau)
            radius = height * .075 * math.sqrt(rng.random())
            px = end[0] + math.cos(angle) * radius
            py = end[1] + rng.uniform(-.045, .065) * height
            pz = end[2] + math.sin(angle) * radius
            ang = rng.uniform(0, math.tau)
            length = rng.uniform(.16, .28) * height / 5.5
            ux, uz = math.cos(ang), math.sin(ang)
            vx, vz = -uz, ux
            tilt = rng.uniform(-.13, .13)
            verts = [(px - ux * length, py - .045, pz - uz * length),
                     (px + vx * length * .38, py + tilt, pz + vz * length * .38),
                     (px + ux * length, py + .055, pz + uz * length),
                     (px - vx * length * .38, py - tilt, pz - vz * length * .38)]
            b.quad(group, "leaf" if cluster_leaf % 3 else "leafLight", verts)


def hip_roof(group, x, z, w, d, y, rise):
    ridge = max(.3, d / 2 - w * .32)
    verts = [(x-w/2,y,z-d/2),(x+w/2,y,z-d/2),(x+w/2,y,z+d/2),(x-w/2,y,z+d/2),
             (x,y+rise,z-ridge),(x,y+rise,z+ridge)]
    b.mesh(group, "blackMetal", verts, [(0,4,5,3),(1,2,5,4),(0,1,4),(3,5,2)], smooth=False)
    b.box(group, "walnut", (x,y-.07,z), (w-.12,.12,d-.12), .025)
    # Standing seams / tile channels follow the actual roof slopes.
    for side in (-1, 1):
        for i in range(25):
            zz = z - d / 2 + .3 + i * (d - .6) / 24
            rz = max(z-ridge, min(z+ridge, zz))
            b.rod(group, "blackMetal", (x + side*w/2,y+.025,zz), (x,y+rise+.025,rz), .026, 8)
    b.rod(group, "bronze", (x,y+rise+.04,z-ridge), (x,y+rise+.04,z+ridge), .055, 12)
    for side in (-1, 1):
        b.box(group, "blackMetal", (x+side*w/2,y-.02,z), (.14,.2,d+.25), .035)
        b.box(group, "blackMetal", (x,y-.02,z+side*d/2), (w+.2,.2,.14), .035)


def moon_gate(room, g, base, x, z):
    # A true open circular screen in the YZ plane, with spaced timber lattice.
    radius = 1.35
    cy = base + 1.55
    points = []
    for i in range(65):
        a = i / 64 * math.tau
        points.append((x, cy + math.sin(a)*radius, z + math.cos(a)*radius))
    for a, c in zip(points, points[1:]):
        b.rod(g, "walnut", a, c, .065, 10)
    for offset in (-.8,-.4,0,.4,.8):
        half = math.sqrt(radius*radius-offset*offset)
        b.rod(g, "walnut", (x,cy-half,z+offset),(x,cy+half,z+offset),.025,8)
    for offset in (-.8,-.4,.4,.8):
        half = math.sqrt(radius*radius-offset*offset)
        b.rod(g, "walnut", (x,cy+offset,z-half),(x,cy+offset,z+half),.025,8)
    b.box(g,"limestone",(x,base+.12,z),(.5,.24,3.15),.04)
    p.note(room,"月洞木格景观屏",x,cy,z)


def build_architecture():
    # 56 x 48 m landscaped plot with genuinely separate garage and trimmed lawn.
    b.box("Site","grass",(0,-.22,0),(56,.4,48),.02)
    for i in range(10):
        b.box("Site","grassAlt",(-25+i*5.5,-.008,-1),(2.7,.018,45),.005)
    b.box("Site","limestone",(0,.01,12),(31,.16,4),.04)
    b.box("Site","limestone",(19,.015,7),(8,.17,24),.04)
    b.box("Site","marble",(0,.06,8.8),(29,.22,1.4),.04)
    for i in range(9):
        b.box("Site","limestone",(-12+i*3,.1,15),(2.1,.16,1.25),.06)
    b.box("Site","limestone",(-18,.13,-2),(5.5,.24,12),.12)
    b.box("Site","water",(-18,.27,-2),(5.1,.06,11.6),.01)
    for x in (-24,24):
        b.box("Site","limestone",(x,.7,0),(.35,1.4,42),.035)
        b.box("Site","grass",(x-math.copysign(.6,x),.75,0),(.9,1.25,39),.22)
    b.box("Site","limestone",(0,.7,-20),(48,1.4,.35),.035)
    b.box("Site","grass",(0,.75,-19.4),(45,1.25,.9),.22)
    # Garage with sectional door, wall sconces and a properly scaled car outside.
    b.box("Site","plaster",(20,1.65,-6),(8,3.3,.28),.03)
    for x in (16,24):
        b.box("Site","plaster",(x,1.65,-1),(.28,3.3,10),.03)
    b.box("Site","blackMetal",(20,3.38,-1),(8.8,.28,10.8),.05)
    b.box("Site","walnut",(20,3.22,-1),(8.3,.08,10.2),.02)
    for i in range(9):
        b.box("Site","blackMetal",(20,.38+i*.31,4),(7.6,.06,.12),.015)
    b.box("Site","black",(19.8,.65,8.5),(2.05,.65,4.6),.26)
    b.box("Site","black",(19.8,1.03,8.2),(1.78,.55,2.55),.23)
    b.box("Site","glass",(19.8,1.22,8.55),(1.67,.5,1.6),.16)
    for sx in (-1,1):
        for sz in (-1,1):
            b.cylinder("Site","rubber",(19.8+sx*1.01,.48,8.5+sz*1.48),.36,.22,segments=28,rotation=(0,0,math.pi/2))
            b.cylinder("Site","steel",(19.8+sx*1.125,.48,8.5+sz*1.48),.2,.025,segments=20,rotation=(0,0,math.pi/2))
    for sx in (-1,1):
        b.box("Site","emissiveWarm",(19.8+sx*.65,.7,10.82),(.45,.18,.04),.04)
    for x in (-13,-7,0,7,13):
        b.cylinder("Site","blackMetal",(x,.48,13.8),.045,.9)
        b.cylinder("Site","emissiveWarm",(x,.91,13.8),.11,.16)
    for x,z,h in [(-20,-12,5.8),(-20,10,5.2),(24,-14,6.2),(10,-16,5.4),(-9,-16,4.8),(-20,1,4.7)]:
        tree("Site",x,z,h)
    # Five mature garden trees sit behind the rear facade, with varied heights
    # and overlapping crowns rather than an evenly spaced decorative row.
    for x,z,h,seed in [(-16,-14.8,9.4,9101),(-7,-14.2,10.6,9102),(2,-15.5,9.8,9103),(11,-13.9,11.0,9104),(19,-15.2,9.6,9105)]:
        tree("Site",x,z,h,potted=False,seed=seed)

    # Raised foundation and second-floor side wings around a genuine double-height void.
    b.box("ExteriorShell","limestone",(0,.28,0),(28.6,.56,16.6),.035)
    for x in (-10,10):
        b.box("ExteriorShell","limestone",(x,3.91,0),(8.25,.28,16.3),.025)
    b.box("ExteriorShell","limestone",(0,3.91,-5.25),(12.2,.28,5.7),.025)
    # A real upper gallery connects the stair landing and both bedroom wings.
    b.box("ExteriorShell","limestone",(0,3.91,-1.55),(11.75,.28,1.7),.025)
    b.box("Floor2","oak",(0,F2-.055,-1.55),(12,.11,1.7),.015)
    b.box("ExteriorShell","limestone",(-4.95,3.91,.05),(1.85,.28,1.5),.025)
    b.box("Floor2","oak",(-5,F2-.055,.05),(2,.11,1.5),.015)
    for x in (-4+i*1.4 for i in range(8)):
        b.rod("Floor2","blackMetal",(x,F2,-.7),(x,F2+.96,-.7),.022)
    b.rod("Floor2","bronze",(-4,F2+.96,-.7),(5.8,F2+.96,-.7),.032)
    b.rod("Floor2","blackMetal",(-4,F2+.46,-.7),(5.8,F2+.46,-.7),.018)
    for x in (-14,-6,6,14):
        b.box("ExteriorShell","limestone",(x,3.85,8),(.42,6.7,.42),.035)
    for y in (.62,3.88,7.35):
        if y == .62:
            for side in (-1,1):
                b.box("ExteriorShell","blackMetal",(side*7.65,y,8.02),(13.2,.18,.24),.025)
        else:
            b.box("ExteriorShell","blackMetal",(0,y,8.02),(28.5,.18,.24),.025)
    for x,w in [(-10,7.4),(0,11.4),(10,7.4)]:
        if x == 0:
            # A genuine 2.4 m entry opening; no hidden glass plane across the camera path.
            for side in (-1,1):
                b.box("ExteriorShell","glass",(side*3.45,2.12,8.04),(4.5,2.85,.035),.005)
        else:
            b.box("ExteriorShell","glass",(x,2.12,8.04),(w,2.85,.035),.005)
        b.box("ExteriorShell","glass",(x,5.57,8.04),(w,2.72,.035),.005)
        for i in range(-2,3):
            # The two central ground-floor mullions would bisect the open doorway.
            if x == 0 and i in (-1,0,1):
                b.box("ExteriorShell","blackMetal",(x+i*w/5,5.57,8.08),(.045,2.72,.07),.008)
            else:
                b.box("ExteriorShell","blackMetal",(x+i*w/5,3.82,8.08),(.045,6.25,.07),.008)
    b.box("ExteriorShell","plaster",(0,3.85,-8),(28,6.7,.32),.025)
    for x in (-14,14):
        # Side walls are assembled around real openings rather than glass buried in a solid box.
        b.box("ExteriorShell","plaster",(x,1.0,0),(.32,.9,16),.02)
        b.box("ExteriorShell","plaster",(x,3.85,0),(.32,.75,16),.02)
        b.box("ExteriorShell","plaster",(x,7.0,0),(.32,.7,16),.02)
        for z in (-6.8,0,6.8):
            b.box("ExteriorShell","plaster",(x,4.0,z),(.32,5.4,2.35),.02)
        for z in (-4,4):
            for y,h in ((2.15,2.4),(5.65,2.25)):
                b.box("ExteriorShell","glass",(x+(-.18 if x<0 else .18),y,z),(.035,h,4.8),.005)
                for dz in (-2.4,0,2.4):
                    b.box("ExteriorShell","blackMetal",(x+(-.2 if x<0 else .2),y,z+dz),(.06,h,.045),.008)
    # Double entrance doors are visibly open, with their leaves outside the route.
    for side in (-1,1):
        b.box("FrontDetails","walnut",(side*1.24,1.95,8.15),(.13,2.9,.22),.02)
        hinge_x=side*1.14
        yaw=side*math.radians(75)
        local_center=-side*.54
        dx,dz=local_center*math.cos(yaw),-local_center*math.sin(yaw)
        leaf_x,leaf_z=hinge_x+dx,8.19+dz
        b.box("FrontDetails","walnut",(leaf_x,1.95,leaf_z),(1.08,2.75,.10),.025,ry=yaw)
        for j in range(4):
            local=-side*(.16+j*.22)
            px=hinge_x+local*math.cos(yaw)
            pz=8.19-local*math.sin(yaw)
            b.box("FrontDetails","blackMetal",(px,1.95,pz),(.018,2.5,.115),.004,ry=yaw)
        local=-side*.89
        px=hinge_x+local*math.cos(yaw)
        pz=8.19-local*math.sin(yaw)
        b.rod("FrontDetails","bronze",(px,1.3,pz+.07),(px,2.25,pz+.07),.022)
    b.box("FrontDetails","walnut",(0,3.4,8.15),(2.6,.14,.22),.02)
    b.box("FrontDetails","bronze",(-1.4,2.25,8.22),(.55,.36,.05),.025)
    # Timber privacy screens give the facade a modern Chinese rhythm.
    for x0 in (-12.8,12.8):
        for i in range(8):
            b.box("FrontDetails","walnut",(x0+(i-3.5)*.18,2.05,8.3),(.065,2.85,.12),.015)
    for x in (-10,10):
        hip_roof("Roof",x,0,9.5,17.7,7.46,1.28)
    hip_roof("Roof",0,-5.2,13.4,6.8,7.52,.95)
    # Build the flat roof and timber soffit around a real skylight opening.
    for mat,y,h in (("blackMetal",7.48,.3),("walnut",7.3,.1)):
        b.box("Roof",mat,(-4.375,y,2.75),(4.55,h,11.5),.025)
        b.box("Roof",mat,(4.375,y,2.75),(4.55,h,11.5),.025)
        b.box("Roof",mat,(0,y,-1.75),(4.2,h,2.5),.02)
        b.box("Roof",mat,(0,y,6.9),(4.2,h,3.2),.02)
    b.box("Roof","glass",(0,7.48,2.4),(4.2,.035,5.8),.005)
    for x in (-2.1,0,2.1):
        b.box("Roof","bronze",(x,7.52,2.4),(.055,.06,5.9),.01)
    # Full-height wet-room partitions, including the formerly missing ground-floor left wall.
    for x in (-6,-3,0,6):
        if x == 6:
            # A real kitchen / dining connecting door, used in both directions.
            for za,zb in ((-8,-5.2),(-3.6,-2.5)):
                b.box("Floor1","plaster",(x,F1+1.5,(za+zb)/2),(.14,3.0,zb-za),.018)
            b.box("Floor1","plaster",(x,F1+2.65,-4.4),(.14,.7,1.6),.018)
            for zz in (-5.2,-3.6):
                b.box("Floor1","walnut",(x,F1+1.14,zz),(.19,2.28,.07),.012)
            b.box("Floor1","walnut",(x,F1+2.28,-4.4),(.19,.07,1.74),.012)
        else:
            b.box("Floor1","plaster",(x,F1+1.5,-5.25),(.14,3.0,5.5),.018)
    for x in (-6,0,6):
        b.box("Floor2","plaster",(x,F2+1.5,-5.25),(.14,3.0,5.5),.018)
    # The one-third surrendered by the gym remains a real, walkable passage
    # between the living room, kitchen and the smaller gym.
    b.box("Floor1","oak",(10,F1-.055,4/3),(8,.11,8/3),.015)
    for i in range(4):
        b.box("Floor1","walnut",(7.2+i*1.85,F1+.003,4/3),(.006,.006,2.48),.001)
    for x in (6.07,13.93):
        b.box("Floor1","walnut",(x,F1+.07,4/3),(.07,.14,8/3-.08),.008)
    b.box("Floor1","walnut",(10,F1+.07,8/3-.08),(7.86,.14,.07),.008)

    # Merge collinear cutaway curb intervals before creating geometry. Neighbouring
    # rooms often share only part of an edge, so box-level deduplication is not enough.
    curb_segments = {}
    for room in ROOMS:
        s = SPECS[room["id"]]
        base = F1 if room["floor"] == 1 else F2
        g = CUT[room["floor"]]
        rear = s["cz"]-s["d"]/2
        curb_segments.setdefault((g,"rear",base,round(rear,5)),[]).append((s["cx"]-s["w"]/2,s["cx"]+s["w"]/2))
        for x in (s["cx"]-s["w"]/2,s["cx"]+s["w"]/2):
            curb_segments.setdefault((g,"side",base,round(x,5)),[]).append((rear+.065,s["cz"]+s["d"]/2))
    for (g,axis,base,fixed),intervals in curb_segments.items():
        merged=[]
        for start,end in sorted(intervals):
            if merged and start <= merged[-1][1]+.00001:
                merged[-1]=(merged[-1][0],max(end,merged[-1][1]))
            else:
                merged.append((start,end))
        for start,end in merged:
            if axis == "rear":
                b.box(g,"limestone",((start+end)/2,base+.26,fixed),(end-start,.52,.13),.025)
            else:
                b.box(g,"limestone",(fixed,base+.26,(start+end)/2),(.13,.52,end-start),.025)
    # Open-riser stair and continuous bronze handrail.
    h = (F2-F1)/18
    for i in range(18):
        b.box("Floor1","oak",(-5.15,F1+h*(i+1),5.4-i*.29),(1.45,.12,.36),.025)
        b.box("Floor1","emissiveWarm",(-5.15,F1+h*(i+1)-.073,5.585-i*.29),(1.1,.018,.025),.004)
        if i % 2 == 0:
            b.rod("Floor1","bronze",(-4.35,F1+h*(i+1),5.4-i*.29),(-4.35,F1+h*(i+1)+.88,5.4-i*.29),.015)
    b.rod("Floor1","bronze",(-4.35,F1+.9,5.5),(-4.35,F2+.9,.5),.035)


def build_living(room,g,base,s):
    p.sofa(room,g,base,-2.2,.5,3.15,0,"三米榆木藤编主沙发")
    p.sofa(room,g,base,3.6,2.4,2.7,-math.pi/2,"独立亚麻双人沙发")
    p.chair(room,g,base,-2.8,4.9,.15,"圈椅一")
    p.chair(room,g,base,-.9,5.1,-.12,"圈椅二")
    p.table(room,g,base,-1.1,3.1,2.3,1.15,.42,"walnut","低矮实木茶几")
    p.table(room,g,base,-4.4,1.2,.7,.7,.55,"walnut","左侧边几")
    p.table(room,g,base,4.5,4.2,.7,.7,.55,"walnut","右侧边几")
    p.rug(room,g,base,0,3.1,8.4,5.6,"fabric","超大手工羊毛地毯")
    p.television(room,g,base,0,base+1.65,6.65,3.1,"一百英寸超窄边电视")
    p.table(room,g,base,0,6.5,4.8,.6,.42,"walnut","悬浮电视矮柜")
    b.box(g,"marble",(0,base+1.6,6.85),(5.8,3.0,.18),.025)
    p.note(room,"整面天然石材电视背景",0,base+1.6,6.85)
    moon_gate(room,g,base,4.8,-1.65)
    p.lamp(room,g,base,-4.4,2.5,1.75,"古铜落地阅读灯")
    p.pendant(room,g,base,0,2.6,4.7,"挑空客厅主吊灯")
    p.table(room,g,base,-1.1,3.1,.65,.42,.49,"bronze","古铜茶盘")
    b.cylinder(g,"jade",(-1.1,base+.61,3.1),.11,.18,.08)
    p.note(room,"翡翠釉茶壶",-1.1,base+.61,3.1)
    p.cup(room,g,base,-.75,base+.51,3.05,"品茗杯一")
    p.cup(room,g,base,-1.42,base+.51,3.04,"品茗杯二")
    p.cup(room,g,base,-1.1,base+.51,3.36,"品茗杯三")
    p.book(room,g,base,3.6,base+.56,2.4,1)
    p.book(room,g,base,3.62,base+.63,2.42,2)
    p.vase(room,g,base,-4.4,base+.61,1.2,"粗陶落地花器","clay")
    p.branches(room,g,base,-4.4,base+1.01,1.2,"舒展插花枝条")
    p.plant(room,g,base,5.1,-1.6,1.65,"角落编织发财树")
    p.cushion(room,g,base,-2.9,base+.82,.45,"fabricRust","赭色靠垫")
    p.cushion(room,g,base,-1.55,base+.82,.45,"fabricDark","墨绿靠垫")
    p.rug(room,g,base,3.6,2.1,.75,1.3,"fabricRust","沙发搭毯")
    p.artwork(room,g,base,-5.82,base+1.9,1.8,1.25,1.5,"左侧水墨立轴",math.pi/2)
    p.artwork(room,g,base,5.82,base+1.9,1.8,1.25,1.5,"右侧水墨立轴",-math.pi/2)
    b.box(g,"emissiveWarm",(0,base+5.7,2.7),(7.5,.045,.08),.008)
    p.note(room,"挑顶隐藏灯带",0,base+5.7,2.7)
    for i in range(3):
        b.cylinder(g,"emissiveWarm",(-3+i*3,base+5.65,1.4),.11,.04,segments=20)
        p.note(room,f"挑顶筒灯 {i+1}",-3+i*3,base+5.65,1.4)


def build_study(room,g,base,s):
    p.table(room,g,base,-10,3.7,3.2,1.25,.78,"walnut","三米二书画书桌")
    p.chair(room,g,base,-10,2.65,0,"书桌主椅")
    p.chair(room,g,base,-12.2,5.8,math.pi,"茶叙客椅一")
    p.chair(room,g,base,-10.7,5.8,math.pi,"茶叙客椅二")
    p.monitor(room,g,base,-10,base+1.55,3.5,"书房显示器")
    b.box(g,"black",(-9.25,base+.88,3.65),(.52,.035,.34),.02)
    p.note(room,"笔记本电脑",-9.25,base+.88,3.65)
    p.shelf(room,g,base,-10.65,.25,6.0,2.75,5,"六米整墙藏书架")
    for i in range(6):
        p.book(room,g,base,-12.5+i*.43,base+.42,.54,i+1,True)
    p.lamp(room,g,base,-11.25,3.75,1.25,"桌面阅读灯")
    p.table(room,g,base,-11.45,5.45,.8,.65,.48,"walnut","茶叙小圆桌")
    b.cylinder(g,"jade",(-11.45,base+.61,5.45),.1,.17)
    p.note(room,"茶叙陶壶",-11.45,base+.61,5.45)
    p.cup(room,g,base,-11.2,base+.53,5.45,"客用茶杯一")
    p.cup(room,g,base,-11.7,base+.53,5.45,"客用茶杯二")
    p.rug(room,g,base,-10,3.9,5.8,4.5,"fabric","书房静音地毯")
    p.artwork(room,g,base,-13.82,base+1.8,3.8,1.2,1.6,"竹枝水墨图",math.pi/2)
    p.plant(room,g,base,-6.8,6.6,1.15,"窗边阔叶植物")
    p.vase(room,g,base,-8.7,base+.86,3.6,"毛笔笔筒","clay")
    for i in range(4):
        b.rod(g,"walnut",(-8.85+i*.08,base+1.0,3.6),(-8.85+i*.08,base+1.38,3.6),.012,8)
        p.note(room,f"毛笔 {i+1}",-8.85+i*.08,base+1.2,3.6)
    b.box(g,"paper",(-10.1,base+.85,4.05),(1.1,.018,.7),.003)
    p.note(room,"摊开书画宣纸",-10.1,base+.85,4.05)
    b.cylinder(g,"black",(-9.65,base+.9,4.05),.07,.08)
    p.note(room,"砚台",-9.65,base+.9,4.05)
    b.box(g,"bronze",(-10.55,base+.88,4.05),(.42,.05,.08),.015)
    p.note(room,"古铜镇纸",-10.55,base+.88,4.05)
    p.pendant(room,g,base,-10,4.1,2.85,"书房纸质吊灯")


def build_bedroom(room,g,base,s,master=False):
    x,z = s["cx"],s["cz"]-(2.2 if master else 0)
    bed_z=z-1.0
    head_z=bed_z-1.085
    p.bed(room,g,base,x,bed_z,2.45 if master else 2.0,"主卧软包床与配套床品" if master else "完整软包双人床")
    p.rug(room,g,base,x,z+1.1,6.4 if master else 5.5,7 if master else 5.2,"fabric","卧室大面积羊毛毯")
    # Art now belongs to an actual headboard wall instead of floating behind the bed.
    if master:
        wall_z=head_z-.18
        b.box(g,"plaster",(x,base+1.5,wall_z),(5.9,3.0,.12),.025)
        for side in (-1,1):
            b.box(g,"walnut",(x+side*2.72,base+1.5,wall_z+.075),(.18,2.85,.06),.015)
        art_z=wall_z+.075
    else:
        art_z=s["cz"]-s["d"]/2+.15
    p.artwork(room,g,base,x,base+2.05,art_z,2.2,1.0,"床头山水装饰画")
    for side in (-1,1):
        nx=x+side*1.55
        nz=z-.75
        p.table(room,g,base,nx,nz,.72,.58,.48,"walnut",f"{'左' if side<0 else '右'}床头柜")
        p.lamp(room,g,base,nx,nz,1.1,f"{'左' if side<0 else '右'}床头灯")
        b.box(g,"bronze",(nx,base+.39,nz+.301),(.23,.018,.022),.006)
        b.box(g,"walnut",(nx,base+.28,nz+.298),(.58,.012,.018),.003)
        # Low, warm night lights sit on the wall-side edge, away from cups and vases.
        b.box(g,"emissiveWarm",(nx,base+.095,nz-.27),(.34,.025,.035),.006)
    wardrobe_z=s["cz"]-s["d"]/2+.55
    p.shelf(room,g,base,x-(2.9 if master else 2.6),wardrobe_z,2.2 if master else 2.4,2.65,4,"整墙衣柜与开放格",cabinet=True)
    p.sofa(room,g,base,x+(2.4 if master else 2.1),z+2.3,2.2 if master else 1.8,-math.pi/2,"床尾休憩沙发")
    bench_z=z+(3.2 if master else 2.4)
    p.table(room,g,base,x,bench_z,2.1,.62,.45,"walnut","床尾凳")
    b.box(g,"fabricDark",(x,base+.545,bench_z),(1.86,.12,.52),.055)
    p.note(room,"床尾凳软包",x,base+.55,bench_z)
    p.plant(room,g,base,x+3.1,z+2.7,1.15,"卧室窗边绿植")
    p.television(room,g,base,x+3.65,base+1.6,z+1.0,1.8,"卧室壁挂电视",-math.pi/2)
    for i in range(6):
        p.book(room,g,base,x-2.7+(i%3)*.34,base+.823+(i//3)*.061,z+2.5,i+1)
    p.cushion(room,g,base,x-.45,base+1.05,bed_z-.45,"fabricRust","床品靠枕一")
    p.cushion(room,g,base,x+.35,base+1.05,bed_z-.45,"fabricDark","床品靠枕二")
    p.vase(room,g,base,x-1.55,base+.55,z-.75,"床头陶罐","clay")
    p.cup(room,g,base,x+1.72,base+.55,z-.68,"夜间水杯")
    p.pendant(room,g,base,x,z,2.95,"卧室漫反射吊灯")
    # Stitched duvet edges and restrained, usable desk accessories.
    for side in (-1,1):
        b.box(g,"fabricDark",(x+side*.88,base+.807,bed_z+.15),(.018,.012,1.5),.003)
    b.box(g,"paper",(x-2.75,base+.803,z+2.68),(.52,.018,.36),.006,ry=.08)
    b.rod(g,"bronze",(x-2.55,base+.825,z+2.51),(x-2.27,base+.825,z+2.58),.009,8)
    b.cylinder(g,"clay",(x-3.22,base+.88,z+2.55),.065,.18,segments=18)
    for i in range(3):
        b.rod(g,"walnut",(x-3.25+i*.025,base+.91,z+2.55),(x-3.25+i*.025,base+1.13,z+2.55),.007,8)
    b.box(g,"bronze",(x-3.88,base+1.35,z+.8),(.06,.32,.18),.02)
    p.note(room,"卧室温控面板",x-3.88,base+1.35,z+.8)
    b.box(g,"fabricDark",(x+2.8,base+.35,z-2.2),(.85,.65,.5),.08)
    p.note(room,"旅行收纳箱",x+2.8,base+.35,z-2.2)
    p.table(room,g,base,x-2.7,z+2.6,1.5,.65,.74,"walnut","卧室书画兼梳妆桌")
    p.chair(room,g,base,x-2.7,z+3.25,math.pi,"卧室书桌椅")
    p.mirror(room,g,base,x-3.9,base+1.65,z+1.8,1.0,1.55,"卧室全身镜",math.pi/2)
    p.lamp(room,g,base,x-2.7,z+2.6,1.15,"卧室桌面灯")
    for side in (-1,1):
        b.box(g,"fabricDark",(x+side*.2,base+.06,z+1.75),(.25,.1,.55),.08)
        b.box(g,"bronze",(x+side*2.85,base+1.25,s["cz"]-s["d"]/2+.2),(.08,.11,.16),.015)
    p.note(room,"床边居家拖鞋",x,base+.06,z+1.75)
    if room == "guest":
        # A proper luggage rack makes the ground-floor guest room read as a room to stay in.
        lx,lz=x+2.55,z-1.55
        for i in range(4):
            b.box(g,"walnut",(lx,base+.43,lz+(i-1.5)*.12),(1.05,.055,.075),.012)
        for side in (-1,1):
            b.rod(g,"blackMetal",(lx+side*.43,base+.42,lz-.2),(lx+side*.43,base+.04,lz+.25),.018)
        b.box(g,"fabricRust",(lx,base+.69,lz),(.82,.46,.38),.08)
        b.rod(g,"bronze",(lx-.16,base+.94,lz),(lx+.16,base+.94,lz),.018)
    elif master:
        b.box(g,"bronze",(x+.45,base+.625,bench_z),(.62,.035,.4),.025)
        p.vase(room,g,base,x+.45,base+.65,bench_z,"主卧床头香薰","jade")
        for side in (-1,1):
            b.box(g,"fabric",(x+side*1.7,base+.12,wardrobe_z+.65),(.62,.22,.45),.04)
    else:
        # The second bedroom has its own reading / study identity.
        b.box(g,"blackMetal",(x-2.72,base+.835,z+2.63),(.55,.035,.36),.015)
        b.box(g,"blackMetal",(x-2.72,base+1.02,z+2.43),(.55,.32,.035),.015,rotation=(-.18,0,0))
        b.box(g,"screen",(x-2.72,base+1.025,z+2.455),(.48,.25,.012),.008,rotation=(-.18,0,0))
        b.cylinder(g,"blackMetal",(x-3.25,base+.82,z+2.85),.12,.035,segments=20)
        b.rod(g,"blackMetal",(x-3.25,base+.84,z+2.85),(x-3.25,base+1.22,z+2.85),.015)
        b.torus(g,"blackMetal",(x-3.25,base+1.23,z+2.85),.13,.022,rotation=(math.pi/2,0,0),arc=math.pi)


def build_gym(room,g,base,s):
    # Compress the old 8 m depth into the front 5.333 m; the rear third becomes circulation.
    def gz(z):
        return 8 - (8 - z) * 2 / 3

    b.box(g,"blackMetal",(8.2,base+.18,gz(3.2)),(1.15,.28,2.3),.12)
    b.box(g,"rubber",(8.2,base+.35,gz(3.2)),(.85,.06,1.85),.04)
    b.box(g,"blackMetal",(8.2,base+.34,gz(2.15)),(1.1,.34,.48),.09)
    for side in (-1,1):
        xx=8.2+side*.5
        b.rod(g,"blackMetal",(xx,base+.35,gz(2.35)),(xx,base+1.25,gz(2.1)),.045)
        b.box(g,"rubber",(xx,base+.43,gz(3.25)),(.16,.09,1.85),.035)
        b.rod(g,"blackMetal",(xx,base+1.15,gz(2.1)),(xx,base+1.12,gz(2.72)),.035)
        b.rod(g,"rubber",(xx,base+1.12,gz(2.58)),(xx,base+1.12,gz(2.82)),.05)
    # Continuous bridge, rear housing and display: the screen is no longer a loose box.
    b.rod(g,"blackMetal",(7.7,base+1.25,gz(2.1)),(8.7,base+1.25,gz(2.1)),.045)
    b.box(g,"blackMetal",(8.2,base+1.3,gz(2.08)),(.86,.44,.13),.035,rotation=(-.2,0,0))
    b.box(g,"screen",(8.2,base+1.3,gz(2.151)),(.68,.31,.018),.012,rotation=(-.2,0,0))
    for side in (-1,1):
        b.cylinder(g,"steel",(8.2+side*.48,base+.23,gz(4.22)),.09,.12,rotation=(0,0,math.pi/2))
    p.note(room,"商用跑步机",8.2,base+.5,gz(3.2))
    b.box(g,"blackMetal",(11.2,base+.22,gz(3.0)),(.65,.18,2.4),.05)
    b.box(g,"fabricDark",(11.2,base+.5,gz(3.5)),(.55,.14,.5),.06)
    b.cylinder(g,"blackMetal",(11.2,base+.53,gz(1.95)),.34,.46,rotation=(math.pi/2,0,0),segments=28)
    b.rod(g,"steel",(11.2,base+.25,gz(2.0)),(11.2,base+1.0,gz(1.7)),.04)
    b.rod(g,"blackMetal",(10.85,base+1.0,gz(1.7)),(11.55,base+1.0,gz(1.7)),.025)
    b.rod(g,"blackMetal",(11.2,base+.56,gz(1.95)),(11.2,base+1.0,gz(1.7)),.012)
    for side in (-1,1):
        b.box(g,"blackMetal",(11.2+side*.22,base+.42,gz(2.72)),(.18,.08,.42),.025)
    p.note(room,"磁阻划船机",11.2,base+.4,gz(3))
    b.box(g,"fabricDark",(9.8,base+.55,gz(5.7)),(.65,.18,1.65),.08)
    b.box(g,"blackMetal",(9.8,base+.28,gz(5.7)),(.45,.55,1.1),.025)
    p.note(room,"可调节力量训练凳",9.8,base+.55,gz(5.7))
    rack_z = 5.7
    b.box(g,"blackMetal",(12.8,base+.65,rack_z),(.65,1.25,2.4),.04)
    p.note(room,"三层哑铃收纳架",12.8,base+.65,rack_z)
    for i in range(8):
        z=4.9+i*.27
        b.rod(g,"steel",(12.42,base+.45+(i%2)*.4,z),(13.12,base+.45+(i%2)*.4,z),.035)
        for x in (12.38,13.16):
            b.cylinder(g,"rubber",(x,base+.45+(i%2)*.4,z),.11,.13,rotation=(0,0,math.pi/2))
        p.note(room,f"哑铃 {i+1}",12.8,base+.6,z)
    for i in range(2):
        p.rug(room,g,base,7.4+i*3.6,7.25,1.8,.9,"fabricDark" if i else "fabricRust",f"瑜伽垫 {i+1}")
    for i in range(2):
        b.cylinder(g,"fabricDark",(11.2+i*.55,base+.16,gz(6.9)),.14,.72,rotation=(math.pi/2,0,0))
        p.note(room,f"泡沫轴 {i+1}",11.2+i*.55,base+.16,gz(6.9))
    for i in range(3):
        b.box(g,"mirror",(6.15,base+1.55,gz(2.2+i*1.7)),(.035,2.5,1.6),.01)
        p.note(room,f"训练镜墙 {i+1}",6.15,base+1.55,gz(2.2+i*1.7))
    for i in range(2):
        p.bottle(room,g,base,8.8+i*.35,base+.05,gz(6.8),f"运动水壶 {i+1}","steel",.28)
    for i in range(2):
        p.towel(room,g,base,12.9,base+1.5,6.35+i*.45,f"训练毛巾 {i+1}")
    p.plant(room,g,base,13.45,7.45,1.1,"健身房绿植")
    b.cylinder(g,"white",(10,base+2.65,gz(.18)),.3,.06,rotation=(math.pi/2,0,0))
    p.note(room,"训练时钟",10,base+2.65,gz(.18))
    b.box(g,"black",(7,base+.25,gz(7.1)),(.4,.5,.32),.05)
    p.note(room,"蓝牙运动音箱",7,base+.25,gz(7.1))
    b.cylinder(g,"steel",(11.8,base+1.1,gz(7.1)),.35,.12)
    b.cylinder(g,"blackMetal",(11.8,base+.55,gz(7.1)),.035,1.1)
    p.note(room,"落地循环风扇",11.8,base+1.1,gz(7.1))
    for i in range(2):
        b.cylinder(g,"rubber",(13.25,base+.25+i*.28,gz(2.0)),.28,.1,rotation=(0,0,math.pi/2))
        p.note(room,f"杠铃片 {i+1}",13.25,base+.25+i*.28,gz(2.0))
    p.pendant(room,g,base,10,gz(4),2.9,"健身房防眩顶灯")


def build_kitchen(room,g,base,s):
    b.box(g,"walnut",(10,base+.46,-7.25),(7.1,.9,.72),.035)
    b.box(g,"marble",(10,base+.95,-7.25),(7.25,.1,.82),.025)
    p.note(room,"七米石材后操作台",10,base+.9,-7.25)
    b.box(g,"walnut",(13.25,base+1.35,-6.9),(1.1,2.7,1.0),.04)
    p.note(room,"通顶高柜",13.25,base+1.35,-6.9)
    b.box(g,"steel",(12.0,base+1.35,-7.1),(1.25,2.65,1.0),.06)
    b.box(g,"blackMetal",(12,base+1.35,-6.57),(.035,2.3,.04),.008)
    p.note(room,"双门冷藏冰箱",12,base+1.35,-7.1)
    b.box(g,"black",(10.7,base+.52,-6.85),(.85,.68,.08),.04)
    b.box(g,"glass",(10.7,base+.52,-6.79),(.68,.45,.02),.015)
    p.note(room,"嵌入式蒸烤箱",10.7,base+.52,-6.85)
    b.sphere(g,"steel",(8.7,base+1.0,-7.15),(.55,.07,.32))
    p.note(room,"不锈钢深水槽",8.7,base+1,-7.15)
    b.rod(g,"bronze",(8.7,base+1.0,-7.48),(8.7,base+1.4,-7.48),.028)
    b.rod(g,"bronze",(8.7,base+1.4,-7.48),(8.7,base+1.4,-7.15),.028)
    p.note(room,"抽拉式厨房龙头",8.7,base+1.2,-7.3)
    b.box(g,"black",(9.8,base+1.02,-7.15),(1.05,.035,.55),.03)
    for x in (9.5,10.1):
        b.torus(g,"steel",(x,base+1.05,-7.15),.17,.018)
    p.note(room,"双眼电磁炉灶",9.8,base+1.02,-7.15)
    b.box(g,"steel",(9.8,base+2.25,-7.25),(1.3,.35,.72),.06)
    p.note(room,"隐藏式排烟机",9.8,base+2.25,-7.25)
    b.box(g,"walnut",(9.4,base+.48,-2.8),(4.4,.92,1.35),.04)
    b.box(g,"marble",(9.4,base+.98,-2.8),(4.65,.12,1.55),.035)
    p.note(room,"四米六中岛操作台",9.4,base+.98,-2.8)
    for i in range(3):
        p.stool(room,g,base,8.1+i*1.3,-1.65,f"中岛吧椅 {i+1}")
    for i in range(3):
        p.pendant(room,g,base,8.1+i*1.3,-2.8,2.65,f"中岛吊灯 {i+1}")
    b.box(g,"paleWood",(8.4,base+1.07,-2.8),(.75,.045,.45),.025)
    p.note(room,"实木砧板",8.4,base+1.07,-2.8)
    b.box(g,"walnut",(9.25,base+1.18,-3.0),(.22,.28,.18),.02)
    p.note(room,"磁吸刀架",9.25,base+1.18,-3)
    for i in range(3):
        b.box(g,"steel",(9.16+i*.09,base+1.43,-3),(.035,.32,.06),.008,rotation=(0,0,(i-1)*.08))
        p.note(room,f"厨刀 {i+1}",9.16+i*.09,base+1.43,-3)
    p.bowl(room,g,base,10.4,base+1.06,-2.75,"陶瓷备餐碗","ceramic",.25)
    p.bowl(room,g,base,11.25,base+1.06,-2.8,"应季水果盘","jade",.3)
    for i in range(3):
        b.sphere(g,"bookRed" if i==0 else "clay",(11.1+i*.14,base+1.25,-2.8),(.1,.1,.1),segments=16,rings=10)
        p.note(room,f"鲜果 {i+1}",11.1+i*.14,base+1.25,-2.8)
    b.box(g,"blackMetal",(7.3,base+1.3,-7.15),(.55,.58,.45),.06)
    b.box(g,"steel",(7.3,base+1.28,-6.9),(.35,.18,.04),.015)
    p.note(room,"意式咖啡机",7.3,base+1.3,-7.15)
    b.cylinder(g,"steel",(7.95,base+1.18,-7.15),.15,.3)
    b.torus(g,"blackMetal",(8.13,base+1.2,-7.15),.12,.025,rotation=(0,math.pi/2,0))
    p.note(room,"电热水壶",7.95,base+1.18,-7.15)
    for i in range(3):
        p.bottle(room,g,base,10.7+i*.25,base+1.03,-7.25,f"调味罐 {i+1}","clay" if i==1 else "jade",.18)


def build_dining(room,g,base,s):
    b.cylinder(g,"walnut",(3,base+.77,-5.15),1.45,.13,segments=48)
    b.cylinder(g,"walnut",(3,base+.39,-5.15),.36,.76,segments=32)
    p.note(room,"十人实木圆餐桌",3,base+.77,-5.15)
    for i in range(8):
        a=i/8*math.tau
        p.chair(room,g,base,3+math.sin(a)*2.05,-5.15+math.cos(a)*2.05,a+math.pi,f"餐椅 {i+1}")
    for i in range(8):
        a=i/8*math.tau
        x,z=3+math.sin(a)*1.08,-5.15+math.cos(a)*1.08
        b.cylinder(g,"fabricDark",(x,base+.85,z),.25,.018,segments=24)
        p.note(room,f"餐垫 {i+1}",x,base+.85,z)
    for i in range(4):
        a=i/4*math.tau
        p.cup(room,g,base,3+math.sin(a)*.82,base+.86,-5.15+math.cos(a)*.82,f"餐杯 {i+1}")
    p.vase(room,g,base,3,base+.86,-5.15,"餐桌中央花器","jade")
    p.branches(room,g,base,3,base+1.25,-5.15,"餐桌季节性插花")
    for x in (2.2,3.8):
        b.cylinder(g,"bronze",(x,base+1.04,-5.15),.045,.36)
        b.cylinder(g,"emissiveWarm",(x,base+1.28,-5.15),.025,.14)
        p.note(room,f"餐桌烛台 {'左' if x<3 else '右'}",x,base+1.1,-5.15)
    p.table(room,g,base,3,-7.5,4.4,.65,.82,"walnut","餐边储物柜")
    p.artwork(room,g,base,1.7,base+1.95,-7.82,1.25,1.05,"餐厅水墨一")
    p.artwork(room,g,base,4.3,base+1.95,-7.82,1.25,1.05,"餐厅水墨二")
    p.pendant(room,g,base,3,-5.15,2.8,"家宴宣纸主吊灯")
    p.bowl(room,g,base,3.9,base+.88,-7.45,"宴客汤盆","ceramic",.28)


def build_bath(room,g,base,s,upper=False):
    x,z=s["cx"],s["cz"]
    p.toilet(room,g,base,x-.65,z-1.25,"智能壁挂马桶")
    # The toilet and vanity helpers already include their seat, basin and faucet.
    # Do not place almost-coincident duplicate fittings over them.
    p.note(room,"缓冲马桶座圈",x-.65,base+.62,z-1.21)
    b.box(g,"steel",(x-.65,base+1.0,z-1.45),(.18,.035,.06),.015)
    p.note(room,"双档冲水按钮",x-.65,base+1,z-1.45)
    # Vanity and mirror are fixed to the rear wall, not freestanding in the camera path.
    vz=z-1.75
    p.vanity(room,g,base,x+.55,vz,1.8 if upper else 1.1,"悬浮木作浴室柜")
    p.note(room,"台上洗手盆",x+.55,base+.89,vz+.02)
    p.note(room,"古铜面盆龙头",x+.55,base+1.1,vz-.2)
    p.mirror(room,g,base,x+.55,base+1.95,vz-.38,1.65 if upper else 1.05,1.0,"带框防雾镜")
    for side in (-1,1):
        xx=x+.55+side*(1.05 if upper else .72)
        b.cylinder(g,"emissiveWarm",(xx,base+1.95,vz-.34),.055,.55)
        p.note(room,f"镜前壁灯 {'左' if side<0 else '右'}",xx,base+1.95,vz-.34)
    p.towel(room,g,base,x+1.1,base+1.15,z-.9,"擦手毛巾")
    b.rod(g,"bronze",(x+.65,base+1.48,z-.9),(x+1.55,base+1.48,z-.9),.022)
    p.note(room,"古铜毛巾杆",x+1.1,base+1.48,z-.9)
    p.bottle(room,g,base,x+.95,base+.91,vz+.05,"洗手液瓶","jade",.2)
    p.cup(room,g,base,x+.15,base+.91,vz+.05,"漱口杯")
    for i in range(2):
        b.rod(g,"paleWood",(x+.1+i*.1,base+1.0,vz+.05),(x+.1+i*.1,base+1.23,vz+.05),.012,8)
        p.note(room,f"牙刷 {i+1}",x+.1+i*.1,base+1.1,vz+.05)
    for i in range(3):
        p.bottle(room,g,base,x-.15+i*.2,base+.92,vz+.12,f"洗漱收纳瓶 {i+1}","clay" if i==1 else "white",.18)
    b.cylinder(g,"steel",(x-1.05,base+.75,z+.1),.09,.035,rotation=(math.pi/2,0,0))
    p.note(room,"厕纸卷",x-1.05,base+.75,z+.1)
    b.rod(g,"bronze",(x-1.18,base+.75,z+.1),(x-.92,base+.75,z+.1),.02)
    p.note(room,"厕纸架",x-1.05,base+.75,z+.1)
    b.cylinder(g,"blackMetal",(x-1.0,base+.22,z+1.1),.16,.42,segments=20)
    p.note(room,"脚踏垃圾桶",x-1,base+.22,z+1.1)
    b.cylinder(g,"steel",(x-.2,base+.012,z-1.7),.12,.018,segments=20)
    p.note(room,"隐形地漏",x-.2,base+.012,z-1.7)
    b.rod(g,"bronze",(x+s["w"]/2-.12,base+1.0,z),(x+s["w"]/2-.12,base+1.45,z),.025)
    p.note(room,"卫生间门拉手",x+s["w"]/2,base+1.2,z)
    p.artwork(room,g,base,x-s["w"]/2+.09,base+1.75,z+.4,.55,.75,"小型植物版画",math.pi/2)
    p.plant(room,g,base,x+s["w"]/2-.5,z+1.8,.65,"耐阴小盆栽")
    p.rug(room,g,base,x+.45,z+1.65,1.0,.65,"fabric","吸水浴室地垫")
    p.pendant(room,g,base,x,z,2.85,"防潮顶灯")
    b.box(g,"bronze",(x,base+.06,z+s["d"]/2-.1),(s["w"]*.75,.08,.06),.015)
    p.note(room,"门槛古铜收边",x,base+.06,z+s["d"]/2)
    b.box(g,"blackMetal",(x-s["w"]/2+.08,base+2.55,z-.5),(.04,.25,.45),.01)
    p.note(room,"静音排风口",x-s["w"]/2,base+2.55,z-.5)


def build_shower(room,g,base,s,upper=False):
    x,z=s["cx"],s["cz"]
    w=min(3.2 if upper else 2.1,s["w"]-.35)
    d=2.8
    b.box(g,"glass",(x-w/2,base+1.25,z),(.035,2.5,d),.005)
    p.note(room,"左侧通透玻璃隔断",x-w/2,base+1.25,z)
    b.box(g,"glass",(x,base+1.25,z+d/2),(w,2.5,.035),.005)
    p.note(room,"玻璃淋浴门",x,base+1.25,z+d/2)
    b.rod(g,"steel",(x+.35,base+1.0,z+d/2+.04),(x+.35,base+1.5,z+d/2+.04),.022)
    p.note(room,"淋浴门竖向拉手",x+.35,base+1.25,z+d/2)
    for yy in (.55,2.0):
        b.box(g,"steel",(x-w/2+.05,base+yy,z+d/2),(.12,.09,.08),.015)
        p.note(room,f"玻璃门铰链 {'下' if yy<1 else '上'}",x-w/2,base+yy,z+d/2)
    b.cylinder(g,"bronze",(x,base+2.25,z-d/2+.25),.28,.055,segments=32)
    p.note(room,"大雨淋顶喷",x,base+2.25,z-d/2+.25)
    b.rod(g,"bronze",(x,base+2.25,z-d/2+.25),(x,base+2.55,z-d/2+.25),.025)
    p.note(room,"顶喷固定臂",x,base+2.4,z-d/2+.25)
    b.box(g,"bronze",(x,base+1.05,z-d/2+.08),(.42,.18,.08),.04)
    p.note(room,"恒温淋浴控制阀",x,base+1.05,z-d/2)
    b.cylinder(g,"bronze",(x+.6,base+1.55,z-d/2+.12),.075,.16,rotation=(math.pi/2,0,0))
    p.note(room,"手持花洒",x+.6,base+1.55,z-d/2+.12)
    b.torus(g,"steel",(x+.35,base+1.25,z-d/2+.1),.35,.015,arc=math.pi*1.45)
    p.note(room,"柔性花洒软管",x+.35,base+1.25,z-d/2)
    b.box(g,"bronze",(x-.55,base+1.25,z-d/2+.12),(.65,.055,.25),.02)
    p.note(room,"置物架",x-.55,base+1.25,z-d/2)
    # Recessed niche: a darker back, stone sill and side returns rather than a solid block.
    b.box(g,"marble",(x,base+1.55,z-d/2+.135),(1.0,.65,.035),.01)
    for side in (-1,1):
        b.box(g,"limestone",(x+side*.51,base+1.55,z-d/2+.2),(.07,.73,.2),.012)
    for yy in (1.2,1.9):
        b.box(g,"limestone",(x,base+yy,z-d/2+.2),(1.08,.07,.2),.012)
    p.note(room,"内嵌壁龛",x,base+1.55,z-d/2)
    for i in range(4):
        p.bottle(room,g,base,x-.45+i*.28,base+1.3,z-d/2+.22,f"洗护瓶 {i+1}","jade" if i%2 else "clay",.2)
    b.box(g,"paleWood",(x+.75,base+.45,z+.35),(.65,.12,.5),.04)
    for sx in (-1,1):
        b.box(g,"paleWood",(x+.75+sx*.23,base+.22,z+.35),(.07,.44,.38),.015)
    p.note(room,"防腐木淋浴凳",x+.75,base+.45,z+.35)
    p.towel(room,g,base,x+.8,base+1.2,z+1.25,"淋浴浴巾")
    b.rod(g,"bronze",(x+.35,base+1.52,z+1.25),(x+1.25,base+1.52,z+1.25),.025)
    p.note(room,"浴巾挂杆",x+.8,base+1.52,z+1.25)
    b.cylinder(g,"steel",(x,base+.012,z),.16,.025,segments=24)
    p.note(room,"线性地漏主体",x,base+.012,z)
    for i in range(6):
        b.box(g,"blackMetal",(x-.11+i*.044,base+.029,z),(.014,.012,.22),.002)
        p.note(room,f"地漏排水槽 {i+1}",x-.11+i*.044,base+.03,z)
    for i in range(2):
        b.torus(g,"bronze",(x+s["w"]/2-.08,base+1.6,z+.3+i*.4),.055,.012,rotation=(0,math.pi/2,0))
        p.note(room,f"衣物挂钩 {i+1}",x+s["w"]/2,base+1.6,z+.3+i*.4)
    for i in range(2):
        b.box(g,"fabricDark",(x-.35+i*.42,base+.06,z+1.9),(.28,.1,.58),.09)
        p.note(room,f"防滑拖鞋 {i+1}",x-.35+i*.42,base+.06,z+1.9)


def build_gaming(room,g,base,s):
    p.table(room,g,base,10,1.2,5.4,1.15,.78,"walnut","五米四双人电竞桌")
    for x in (8.6,11.4):
        p.chair(room,g,base,x,2.45,math.pi,"人体工学电竞椅","fabricDark")
    for x in (8.6,11.4):
        p.monitor(room,g,base,x,base+1.55,1.15,"高刷电竞显示器")
    for x in (8.6,11.4):
        b.box(g,"black",(x,base+.86,1.65),(.52,.035,.18),.015)
        p.note(room,"机械键盘",x,base+.86,1.65)
    for x in (9.15,11.95):
        b.sphere(g,"black",(x,base+.88,1.65),(.07,.035,.11))
        p.note(room,"电竞鼠标",x,base+.88,1.65)
    for x in (8.8,11.6):
        p.rug(room,g,base,x,1.65,1.15,.48,"fabricDark","大尺寸鼠标垫")
    for x in (7.65,12.35):
        b.box(g,"blackMetal",(x,base+.62,1.2),(.45,1.15,.65),.05)
        b.box(g,"emissiveCool",(x,base+.65,1.54),(.25,.65,.025),.01)
        p.note(room,"侧透电竞主机",x,base+.62,1.2)
    for x in (8.0,12.0):
        b.torus(g,"blackMetal",(x,base+1.0,2.0),.18,.035,rotation=(math.pi/2,0,0),arc=math.pi)
        p.note(room,"头戴式耳机",x,base+1,2)
    for x in (8.0,12.0):
        b.cylinder(g,"blackMetal",(x,base+.9,2),.025,.35)
        p.note(room,"耳机展示架",x,base+.9,2)
    for x in (8.6,11.4):
        b.box(g,"emissiveCool",(x,base+1.28,1.0),(1.4,.025,.03),.005)
        p.note(room,"桌面氛围灯带",x,base+1.28,1)
    p.sofa(room,g,base,12.9,5.6,2.2,-math.pi/2,"电竞房休息沙发")
    p.rug(room,g,base,10,4.4,5.4,3.6,"fabricDark","电竞房吸音地毯")
    p.artwork(room,g,base,8.5,base+1.9,.18,1.1,1.45,"科幻主题海报一")
    p.artwork(room,g,base,11.5,base+1.9,.18,1.1,1.45,"科幻主题海报二")
    p.shelf(room,g,base,6.55,4.2,1.0,2.1,3,"游戏收藏展示架一")
    p.shelf(room,g,base,13.45,4.2,1.0,2.1,3,"游戏收藏展示架二")
    for x in (7.9,12.1):
        b.box(g,"black",(x,base+1.05,1.05),(.16,.25,.18),.03)
        p.note(room,"桌面监听音箱",x,base+1.05,1.05)
    b.box(g,"blackMetal",(10,base+.25,5.8),(.55,.18,.42),.04)
    p.note(room,"游戏主机",10,base+.25,5.8)
    for x in (9.65,10.35):
        b.box(g,"black",(x,base+.14,5.2),(.22,.08,.32),.07)
        p.note(room,"无线游戏手柄",x,base+.14,5.2)


def top_up(room,g,base,s):
    """If a translated furnishing list is short, add real ceiling fixtures, never text-only claims."""
    i=0
    while len(p.l.rooms[room]) < 50:
        xx=s["cx"] + ((i%4)-1.5)*min(1.2,s["w"]/5)
        zz=s["cz"] + ((i//4)-.5)*min(1.4,s["d"]/4)
        b.cylinder(g,"blackMetal",(xx,base+3.17,zz),.105,.055,segments=20)
        b.cylinder(g,"emissiveWarm",(xx,base+3.125,zz),.075,.018,segments=20)
        p.note(room,f"防眩氛围筒灯 {i+1}",xx,base+3.15,zz)
        i+=1


def main():
    global b,p
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.collections):
        if data.name != "Collection":
            bpy.data.collections.remove(data)
    materials=create_materials()
    b=Model(materials)
    ledger=Ledger()
    p=Props(b,ledger)
    build_architecture()
    for room in ROOMS:
        rid=room["id"]
        s=SPECS[rid]
        base=F1 if room["floor"]==1 else F2
        g=GROUP[room["floor"]]
        rear_openings = [(-4.5,1.3),(-1.5,1.3),(3,6)] if rid == "living" else ([(-6.75,1.3)] if rid == "study" else None)
        p.room_finish(rid,g,base,s["cx"],s["cz"],s["w"],s["d"],s.get("wet",False),s.get("window","front"),s.get("door",False),rear_openings)
        if rid=="living": build_living(rid,g,base,s)
        elif rid=="study": build_study(rid,g,base,s)
        elif rid in ("guest","master","bedroom2"): build_bedroom(rid,g,base,s,rid=="master")
        elif rid=="gym": build_gym(rid,g,base,s)
        elif rid=="kitchen": build_kitchen(rid,g,base,s)
        elif rid=="dining": build_dining(rid,g,base,s)
        elif rid=="bath1": build_bath(rid,g,base,s,False)
        elif rid=="bath2": build_bath(rid,g,base,s,True)
        elif rid=="shower1": build_shower(rid,g,base,s,False)
        elif rid=="shower2": build_shower(rid,g,base,s,True)
        elif rid=="gaming": build_gaming(rid,g,base,s)
        else: raise RuntimeError(f"Missing room builder: {rid}")
        top_up(rid,g,base,s)
    details=ledger.validate([r["id"] for r in ROOMS])
    objects=b.flush()
    # Source and runtime models are separate, versionable artifacts.
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene.view_settings.exposure=.35
    scene.world.color=(.18,.18,.18)
    scene["project"]="菩园 · Blender Web3D realistic rebuild"
    scene["visible_detail_count"]=650
    scene["living_area_m2"]=126.0
    scene["gym_area_m2"]=42.67
    scene["source_skill"]="czlonkowski/blender-web-3d-skill @ 858762f (MIT)"
    scene["coordinate_contract"]="Modeling helpers Y-up/front +Z; committed Blender Z-up; glTF restores Y-up"
    # Useful source-scene lighting and camera, excluded from GLB.
    sun_data=bpy.data.lights.new("Lookdev Sun","SUN")
    sun_data.energy=2.2
    sun_data.angle=math.radians(12)
    sun=bpy.data.objects.new("Lookdev Sun",sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-35))
    cam_data=bpy.data.cameras.new("Lookdev Camera")
    cam=bpy.data.objects.new("Lookdev Camera",cam_data)
    scene.collection.objects.link(cam)
    cam.location=(34,-42,26)
    target=Vector((0,0,3))
    cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam_data.lens=48
    scene.camera=cam
    out=ROOT/"blender"/"artifacts"
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    for name,(col,empty) in b.collections.items():
        empty.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"chengyuan_blender_source.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(out/"chengyuan_raw.glb"),export_format="GLB",use_selection=True,
        export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
        export_extras=True,export_gpu_instances=False,export_image_format="AUTO",
        export_draco_mesh_compression_enable=False,
    )
    manifest={
        "project":"菩园 · Blender 写实重建版",
        "source":"blender/build_chengyuan.py",
        "skill":{"repository":"czlonkowski/blender-web-3d-skill","commit":"858762f1add7f1d9f5dcb1fb1d0b55f71906bf0d","license":"MIT"},
        "livingArea":126,"gymArea":42.67,"detailCount":650,"generatedParts":b.count,"meshCount":len(objects),
        "groups":list(b.collections),"details":details,
    }
    (ROOT/"public"/"details"/"rooms.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print("CHENGYUAN_BUILD",json.dumps({"parts":b.count,"meshes":len(objects),"rooms":{k:len(v) for k,v in details.items()}},ensure_ascii=False))


if __name__=="__main__":
    main()
