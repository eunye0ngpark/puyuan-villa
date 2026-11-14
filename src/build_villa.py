import bpy, math, random, os, json
from mathutils import Vector
from math import sin, cos, pi

# 澄园：可交互的新中式别墅。单位为米，Blender Z-up，正立面朝 -Y。
SEED = 1212
rng = random.Random(SEED)
OUT = '/mnt/agents/output/app/public/models'
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):
    bpy.data.materials.remove(datablock)


def rgb(hexstr):
    h = hexstr.lstrip('#')
    vals = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in vals) + (1,)


def mat(name, color, rough=.55, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgb(color)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = rgb(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = rgb(color)
        p.inputs['Emission Strength'].default_value = emission
    return m

M = {
    'stone': mat('暖玉石灰岩', 'D8D1C2', .82),
    'plaster': mat('宣纸白墙', 'E8E2D6', .88),
    'wood': mat('深胡桃木', '352A24', .38),
    'wood2': mat('温润木饰面', '76523A', .5),
    'roof': mat('黛色金属挑檐', '242827', .34, .25),
    'brass': mat('哑光古铜', 'A98855', .3, .72),
    'glass': mat('茶色玻璃', '91A8A6', .13, .12),
    'black': mat('墨黑', '171B1B', .4),
    'linen': mat('亚麻软包', 'C7BBA6', .92),
    'ivory': mat('米白织物', 'E2DCCC', .95),
    'green': mat('苔绿织物', '627064', .9),
    'rug': mat('手工地毯', '9B8B74', 1),
    'floor': mat('烟熏橡木地板', '846D53', .65),
    'tile': mat('云纹石砖', 'BBB8AE', .68),
    'lawn': mat('修剪草坪', '536344', 1),
    'leaf': mat('深绿树冠', '314C36', .95),
    'leaf2': mat('嫩绿树冠', '607449', .95),
    'trunk': mat('树干', '504336', .95),
    'water': mat('静水', '597A78', .15, .25),
    'light': mat('暖光灯带', 'FFD999', .3, 0, 3.5),
    'screen': mat('屏幕微光', '547C81', .28, .1, .8),
    'red': mat('朱砂点缀', '844B3D', .7),
    'car': mat('车漆月白', 'AEB7B6', .24, .55),
}
# 玻璃在 glTF 中以半透明材质输出。
p = M['glass'].node_tree.nodes.get('Principled BSDF')
p.inputs['Alpha'].default_value = .34
M['glass'].surface_render_method = 'DITHERED'

GROUPS = {}
for name in ['Site', 'ExteriorShell', 'FrontDetails', 'Roof', 'Floor1', 'Floor2', 'Cut1', 'Cut2']:
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    GROUPS[name] = obj


def assign(obj, group, material=None):
    obj.parent = GROUPS[group]
    if material:
        obj.data.materials.append(M[material] if isinstance(material, str) else material)
    return obj


def box(name, loc, size, material, group='Floor1', bevel=0, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    o.rotation_euler[2] = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('柔化边角', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = o.modifiers.new('加权法线', 'WEIGHTED_NORMAL')
    return assign(o, group, material)


def cyl(name, loc, radius, depth, material, group='Floor1', vertices=24, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    if rot:
        o.rotation_euler = rot
    return assign(o, group, material)


def sphere(name, loc, scale, material, group='Site', segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return assign(o, group, material)


def rod(name, a, b, radius, material, group='Floor1'):
    a, b = Vector(a), Vector(b)
    o = cyl(name, (a+b)/2, radius, (b-a).length, material, group, 12)
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return o


def torus(name, loc, major, minor, material, group='Floor1', rot=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=8, location=loc)
    o = bpy.context.object
    o.name = name
    if rot:
        o.rotation_euler = rot
    return assign(o, group, material)


def mesh_obj(name, verts, faces, material, group):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    return assign(o, group, material)


def hip_roof(name, x, y, z, w, d, h):
    # 四坡挑檐，顶部短脊与深屋檐形成新中式轮廓。
    ridge = max(.2, w * .24)
    verts = [
        (x-w/2, y-d/2, z), (x+w/2, y-d/2, z),
        (x+w/2, y+d/2, z), (x-w/2, y+d/2, z),
        (x-ridge/2, y, z+h), (x+ridge/2, y, z+h),
    ]
    faces = [(0,1,5,4), (1,2,5), (2,3,4,5), (3,0,4)]
    mesh_obj(name, verts, faces, 'roof', 'Roof')
    box(name+'_檐口', (x,y,z-.10), (w,d,.20), 'roof', 'Roof', .035)
    box(name+'_古铜收边', (x,y-d/2-.015,z-.02), (w,.045,.06), 'brass', 'Roof')


def wall_x(name, x1, x2, y, z0, h, material='plaster', group='Floor1', thick=.16):
    return box(name, ((x1+x2)/2,y,z0+h/2), (x2-x1,thick,h), material, group)


def wall_y(name, x, y1, y2, z0, h, material='plaster', group='Floor1', thick=.16):
    return box(name, (x,(y1+y2)/2,z0+h/2), (thick,y2-y1,h), material, group)


def window_front(name, x, y, z, w, h, group='ExteriorShell'):
    box(name+'_玻璃', (x,y,z), (w,.055,h), 'glass', group)
    for xx in [x-w/2, x+w/2]:
        box(name+'_竖框', (xx,y-.035,z), (.10,.12,h+.16), 'wood', group)
    for zz in [z-h/2,z+h/2]:
        box(name+'_横框', (x,y-.035,zz), (w+.12,.12,.10), 'wood', group)
    box(name+'_中梃', (x,y-.04,z), (.065,.12,h), 'wood', group)
    box(name+'_横梃', (x,y-.04,z+.15), (w,.12,.055), 'wood', group)


def sconce(x, y, z, group='FrontDetails'):
    box('壁灯底座', (x,y,z), (.18,.16,.85), 'brass', group, .03)
    box('壁灯灯光', (x,y-.09,z), (.09,.06,.62), 'light', group, .025)


def plant(x,y,z=0,scale=1,group='Floor1'):
    cyl('花器', (x,y,z+.20*scale), .23*scale, .40*scale, 'stone', group)
    for i in range(7):
        a = i*2*pi/7
        rod('枝叶', (x,y,z+.35*scale), (x+cos(a)*.28*scale,y+sin(a)*.28*scale,z+(1+rng.random()*.3)*scale), .018*scale, 'leaf', group)
        sphere('叶片', (x+cos(a)*.26*scale,y+sin(a)*.26*scale,z+(1+rng.random()*.2)*scale), (.16*scale,.10*scale,.23*scale), 'leaf2', group, 12, 6)


def tree(x,y,s=1):
    cyl('庭院树干', (x,y,1.55*s), .16*s, 3.1*s, 'trunk', 'Site', 12)
    for i in range(8):
        a = i*2.399
        r = (i%3)*.42*s
        sphere('庭院树冠', (x+cos(a)*r,y+sin(a)*r,(3.0+(i%4)*.45)*s), (1.15*s,1.0*s,1.3*s), 'leaf' if i%2 else 'leaf2', 'Site', 12, 8)


def shrub(x,y,s=1):
    for i in range(4):
        sphere('修剪灌木', (x+(i-1.5)*.28*s,y+sin(i)*.15*s,.42*s), (.48*s,.44*s,.48*s), 'leaf' if i%2 else 'leaf2', 'Site', 12, 6)


def rug(x,y,w,d,z,group,material='rug'):
    box('地毯', (x,y,z+.018), (w,d,.035), material, group, .035)
    # 地毯内框
    for yy in [y-d/2+.12,y+d/2-.12]:
        box('地毯织边', (x,yy,z+.04), (w-.18,.025,.012), 'linen', group)


def table(x,y,z,w,d,h,group,material='wood2',round_top=False):
    if round_top:
        cyl('圆桌面', (x,y,z+h), w/2, .10, material, group, 48)
        cyl('桌座', (x,y,z+h/2), .16, h, material, group)
        cyl('桌脚', (x,y,z+.05), w*.28, .10, material, group, 32)
    else:
        box('桌面', (x,y,z+h), (w,d,.12), material, group, .045)
        for dx in [-w*.40,w*.40]:
            for dy in [-d*.36,d*.36]:
                box('桌腿', (x+dx,y+dy,z+h/2), (.10,.10,h), material, group, .018)


def chair(x,y,z,angle=0,group='Floor1',accent='linen'):
    # 圈椅以座面、弯背、扶手和四腿组成。
    box('圈椅座面', (x,y,z+.47), (.56,.54,.12), accent, group, .07, angle)
    for dx in [-.22,.22]:
        for dy in [-.20,.20]:
            px = x + dx*cos(angle)-dy*sin(angle)
            py = y + dx*sin(angle)+dy*cos(angle)
            box('圈椅腿', (px,py,z+.24), (.055,.055,.48), 'wood', group, .015, angle)
    # 靠背位于局部 +Y。
    bx = x-.26*sin(angle); by = y+.26*cos(angle)
    box('圈椅靠背', (bx,by,z+.83), (.56,.08,.58), 'wood', group, .06, angle)
    box('圈椅靠垫', (bx-.045*sin(angle),by-.045*cos(angle),z+.83), (.43,.07,.36), accent, group, .06, angle)


def sofa(x,y,z,w=2.5,angle=0,group='Floor1',material='linen'):
    box('沙发底座', (x,y,z+.28), (w,.90,.30), 'wood', group, .08, angle)
    box('沙发坐垫', (x,y-.03,z+.51), (w-.24,.77,.25), material, group, .10, angle)
    by = y+.38*cos(angle); bx = x+.38*sin(angle)
    box('沙发靠背', (bx,by,z+.88), (w,.18,.82), 'wood', group, .07, angle)
    for dx in [-w*.32,0,w*.32]:
        px=x+dx*cos(angle); py=y+dx*sin(angle)
        box('沙发靠垫', (px,py-.10,z+.89), (w*.29,.22,.58), material, group, .11, angle)
    for dx in [-w/2+.07,w/2-.07]:
        px=x+dx*cos(angle); py=y+dx*sin(angle)
        box('沙发扶手', (px,py,z+.68), (.14,.88,.50), 'wood', group, .055, angle)


def bed(x,y,z,w=2.0,d=2.25,group='Floor2'):
    box('床架', (x,y,z+.26), (w,d,.42), 'wood2', group, .10)
    box('床垫', (x,y-.05,z+.52), (w-.12,d-.12,.30), 'ivory', group, .13)
    box('床头板', (x,y+d/2-.03,z+1.02), (w+.18,.16,1.40), 'wood', group, .10)
    box('床尾毯', (x,y-d*.29,z+.71), (w-.10,d*.27,.07), 'green', group, .04)
    for dx in [-w*.25,w*.25]:
        box('枕头', (x+dx,y+d*.26,z+.78), (w*.40,.54,.18), 'linen', group, .10)
    for dx in [-w/2-.38,w/2+.38]:
        box('床头柜', (x+dx,y+d*.28,z+.32), (.52,.48,.62), 'wood2', group, .045)
        cyl('床头灯座', (x+dx,y+d*.28,z+.70), .10,.16,'brass',group)
        cyl('床头灯罩', (x+dx,y+d*.28,z+.96), .19,.35,'ivory',group)


def bookshelf(x,y,z,w=3,h=2.5,group='Floor1',angle=0):
    box('书墙背板',(x,y,z+h/2),(w,.16,h),'wood',group,.02,angle)
    for zz in [.12,.65,1.18,1.71,2.24]:
        if zz>h: continue
        box('书架层板',(x,y-.22,z+zz),(w,.48,.07),'wood2',group,.015,angle)
        for i in range(int(w*7)):
            bx=x-w/2+.15+i*.13
            bh=rng.uniform(.22,.43)
            box('书籍',(bx,y-.25,z+zz+.04+bh/2),(.075,.28,bh),rng.choice(['linen','green','red','ivory','wood2']),group,0,angle)


def toilet(x,y,z,group):
    box('马桶水箱',(x,y+.20,z+.63),(.48,.24,.72),'ivory',group,.09)
    sphere('马桶座',(x,y-.10,z+.40),(.31,.42,.22),'ivory',group)
    box('马桶底座',(x,y,z+.19),(.32,.42,.38),'ivory',group,.09)
    torus('马桶圈',(x,y-.12,z+.55),.24,.035,'ivory',group)


def vanity(x,y,z,group,w=1.1):
    box('洗手台柜',(x,y,z+.42),(w,.52,.80),'wood2',group,.06)
    box('洗手台面',(x,y,z+.85),(w+.08,.60,.10),'stone',group,.035)
    sphere('台上盆',(x,y-.03,z+.93),(.30,.22,.09),'ivory',group)
    rod('龙头',(x,y+.14,z+.90),(x,y+.14,z+1.17),.025,'brass',group)
    box('浴室镜',(x,y+.28,z+1.65),(w*.82,.04,.95),'glass',group,.05)


def shower(x,y,z,group,w=1.65,d=1.65):
    box('淋浴底盘',(x,y,z+.06),(w,d,.12),'tile',group,.03)
    for xx in [x-w/2,x+w/2]:
        box('淋浴玻璃',(xx,y,z+1.15),(.035,d,2.15),'glass',group)
    box('淋浴玻璃门',(x,y-d/2,z+1.15),(w,.035,2.15),'glass',group)
    rod('淋浴立管',(x,y+d*.35,z+.7),(x,y+d*.35,z+2.15),.025,'brass',group)
    cyl('顶喷',(x,y+d*.27,z+2.12),.19,.035,'brass',group)
    box('淋浴壁龛',(x,y+d/2-.04,z+1.25),(.65,.08,.36),'wood',group,.02)


# ───────────────────────── 场地与庭院 ─────────────────────────
box('场地基座',(0,0,-.34),(38,32,.65),'stone','Site',.25)
box('草坪',(0,0,.005),(37.5,31.5,.08),'lawn','Site',.18)
box('主入口石径',(0,-10,.09),(3.0,10,.14),'tile','Site',.04)
box('车库车道',(12,-8,.08),(5.2,16,.13),'tile','Site',.04)
# 石板分缝
for yy in range(-14,-4):
    box('石径分缝',(0,yy,.17),(2.9,.025,.012),'stone','Site')
for xx in [-16,16]:
    wall_y('庭院侧墙',xx,-14,12,0,1.0,'stone','Site',.25)
wall_x('庭院后墙',-16,16,12,0,1.15,'stone','Site',.25)
for x in [-15,-11,-7,7,11,15]:
    shrub(x,-12.7,1.25)
for x,y,s in [(-14,-8,1.25),(-14,7,1.4),(14,9,1.2),(-11,11,1.0),(11,11,1.0),(-16,-15,1.35),(17,-13,1.3)]:
    tree(x,y,s)
# 前庭水景与石狮抽象雕塑
box('静水池',(-7.5,-9,.12),(4.2,2.0,.20),'stone','Site',.10)
box('静水面',(-7.5,-9,.235),(3.85,1.65,.035),'water','Site',.06)
for x in [-2.0,2.0]:
    box('入口门墩',(x,-6.2,.50),(.68,.68,1.0),'stone','Site',.08)
    sphere('门墩雕塑',(x,-6.2,1.17),(.27,.27,.36),'brass','Site')
for x in [-9,-5,5,9]:
    box('草坪灯',(x,-6.3,.28),(.12,.12,.55),'wood','Site',.02)
    box('草坪灯光',(x,-6.3,.57),(.18,.18,.08),'light','Site',.02)

# ───────────────────────── 建筑外立面 ─────────────────────────
# 主体基座与两层楼板
box('建筑台基',(0,0,.20),(20.6,10.6,.40),'stone','ExteriorShell',.08)
box('一层楼板',(0,0,.42),(20,10,.18),'floor','Floor1')
box('二层楼板',(0,0,3.75),(20,10,.20),'floor','Floor2')
F1=.50; F2=3.85; H=3.25
# 外墙：前墙分为可隐藏部分，后墙与侧墙为壳体。
wall_x('后立面',-10,10,5,F1,6.55,'stone','ExteriorShell',.28)
for x in [-10,10]:
    wall_y('侧立面',x,-5,5,F1,6.55,'stone','ExteriorShell',.28)
# 前墙用窗间墙段，保留真实大窗。
for z0,h in [(F1,H),(F2,H)]:
    for x1,x2 in [(-10,-8.8),(-6.2,-4.0),(-2.0,2.0),(4.0,6.2),(8.8,10)]:
        wall_x('前立面石墙',x1,x2,-5,z0,h,'stone','FrontDetails',.28)
    for x,w in [(-7.5,2.6),(-3,2.0),(3,2.0),(7.5,2.6)]:
        box('窗下墙',(x,-5,z0+.42),(w,.28,.84),'stone','FrontDetails')
        box('窗上墙',(x,-5,z0+3.02),(w,.28,.46),'stone','FrontDetails')
        window_front('落地木窗',x,-5.16,z0+1.77,w,2.10,'FrontDetails')
# 中央入口通高门厅与门框
box('入口通高背景',(0,-5.06,3.75),(3.6,.38,6.50),'wood','FrontDetails',.05)
box('入口大门',(0,-5.31,1.75),(1.75,.16,2.55),'wood2','FrontDetails',.04)
for x in [-.48,.48]:
    box('大门玻璃',(x,-5.41,1.86),(.64,.045,1.75),'glass','FrontDetails')
    rod('大门拉手',(x*.25,-5.49,1.25),(x*.25,-5.49,1.95),.025,'brass','FrontDetails')
box('入口二层窗',(0,-5.31,5.12),(2.15,.08,2.10),'glass','FrontDetails')
for x in [-1.18,1.18]:
    box('入口竖向线条',(x,-5.42,3.75),(.16,.16,6.4),'brass','FrontDetails',.02)
for x in [-2.0,2.0]:
    box('门厅石柱',(x,-5.34,3.60),(.38,.50,6.25),'stone','FrontDetails',.04)
    sconce(x,-5.65,2.1)
# 外立面木格栅
for side in [-1,1]:
    for i in range(7):
        box('立面木格栅',(side*(4.25+i*.18),-5.28,5.52),(.065,.16,2.15),'wood','FrontDetails',.012)
# 屋顶：两侧较低挑檐与中央更高门厅，三组体量清晰交接。
hip_roof('西侧屋顶',-6.85,0,7.18,8.35,11.8,1.18)
hip_roof('东侧屋顶',6.85,0,7.18,8.35,11.8,1.18)
hip_roof('中央门厅屋顶',0,-.12,7.68,6.25,11.5,1.35)
# 屋檐灯带
box('中央檐下灯带',(0,-5.89,7.40),(5.7,.055,.055),'light','Roof')
for x in [-6.8,6.8]:
    box('侧翼檐下灯带',(x,-5.89,7.03),(5.4,.055,.045),'light','Roof')
# 入口台阶
for i in range(3):
    box('入口台阶',(0,-5.65-i*.36,.12+i*.10),(4.3-i*.28,.75,.20+i*.20),'stone','FrontDetails',.035)
# 二层小阳台
box('二层阳台',(0,-5.75,3.86),(3.9,1.55,.18),'stone','FrontDetails',.04)
for x in [-1.75,1.75]:
    rod('阳台扶手',(x,-6.42,4.0),(x,-6.42,4.85),.035,'brass','FrontDetails')
for i in range(13):
    x=-1.75+i*3.5/12
    rod('阳台栏杆',(x,-6.42,4.05),(x,-6.42,4.82),.018,'wood','FrontDetails')
rod('阳台横杆',(-1.75,-6.42,4.85),(1.75,-6.42,4.85),.04,'brass','FrontDetails')

# ───────────────────────── 车库与车辆 ─────────────────────────
box('车库地坪',(12.7,1.0,.22),(5.4,7.4,.35),'tile','Site',.06)
for x in [10.0,15.4]:
    wall_y('车库侧墙',x,-2.7,4.7,.35,3.0,'stone','Site',.24)
wall_x('车库后墙',10,15.4,4.7,.35,3.0,'stone','Site',.24)
box('车库平屋顶',(12.7,1,3.48),(6.1,8.1,.28),'roof','Site',.05)
box('车库门楣',(12.7,-2.75,3.02),(5.4,.30,.58),'wood','Site')
# 车辆
box('汽车车身',(12.7,.0,.82),(2.05,4.35,.65),'car','Site',.25)
box('汽车座舱',(12.7,.30,1.30),(1.70,2.15,.66),'glass','Site',.28)
for x in [11.72,13.68]:
    for y in [-1.35,1.38]:
        cyl('车轮',(x,y,.58),.38,.20,'black','Site',24,(0,pi/2,0))
for x in [12.15,13.25]:
    box('汽车前灯',(x,-2.18,.91),(.42,.045,.16),'light','Site',.04)

# ───────────────────────── 室内隔墙与剖切矮墙 ─────────────────────────
# 一层：左书房/客房，右健身/厨房，中客厅/餐厅，后左卫浴。
for x in [-4,4]:
    wall_y('一层翼间隔墙',x,-5,5,F1,H,'plaster','Floor1')
for x1,x2 in [(-10,-4),(4,10)]:
    wall_x('一层前后隔墙',x1,x2,0,F1,H,'plaster','Floor1')
wall_x('客厅后隔墙左段',-4,-1.55,.6,F1,H,'plaster','Floor1')
wall_x('客厅后隔墙右段',1.55,4,.6,F1,H,'plaster','Floor1')
wall_y('卫浴与楼梯隔墙',-1.6,.6,5,F1,H,'plaster','Floor1')
wall_y('餐厅与楼梯隔墙',1.0,.6,5,F1,H,'plaster','Floor1')
wall_x('一层卫浴分隔',-4,-1.6,2.8,F1,H,'plaster','Floor1')
# 门洞用深色门框提示，墙体采用剖切查看保证可读性。
for x,y in [(-4,-2),(-4,2.5),(4,-2),(4,2.5),(-1.6,1.5),(1,1.5)]:
    box('室内木门框',(x,y,F1+1.12),(.20,1.25,2.24),'wood','Floor1',.02)
# 二层：左主卧，右前电竞/右后次卧，中卫浴与楼梯厅。
wall_y('二层主卧隔墙',-2,-5,5,F2,H,'plaster','Floor2')
wall_y('二层右翼隔墙',2,-5,5,F2,H,'plaster','Floor2')
wall_x('二层前后隔墙',2,10,0,F2,H,'plaster','Floor2')
wall_x('二层卫浴前墙',-2,2,.8,F2,H,'plaster','Floor2')
wall_y('二层卫浴分隔',0,.8,5,F2,H,'plaster','Floor2')
wall_x('二层卫浴后分隔',-2,2,3.1,F2,H,'plaster','Floor2')
# 剖切模式的低外墙，避免遮挡平面。
for floor,group in [(F1,'Cut1'),(F2,'Cut2')]:
    wall_x('剖切后矮墙',-10,10,5,floor,.65,'stone',group,.20)
    wall_x('剖切前矮墙',-10,10,-5,floor,.35,'stone',group,.20)
    for x in [-10,10]:
        wall_y('剖切侧矮墙',x,-5,5,floor,.65,'stone',group,.20)

# 楼梯：一层通往二层的真实踏步和扶手。
steps=16
for i in range(steps):
    y=.95+i*.24
    z=F1+(i+1)*(F2-F1)/steps
    box('木楼梯踏步',(-.30,y,z-.07),(1.85,.29,.14),'wood2','Floor1',.025)
for x in [-1.20,.60]:
    rod('楼梯扶手',(x,.85,F1+.85),(x,4.72,F2+.85),.035,'brass','Floor1')
    for i in range(0,steps,2):
        y=.95+i*.24; z=F1+(i+1)*(F2-F1)/steps
        rod('楼梯栏杆',(x,y,z),(x,y,z+.85),.018,'wood','Floor1')

# ───────────────────────── 一层家具：客厅 ─────────────────────────
rug(0,-2.05,F1,5.6,3.5,'Floor1')
sofa(0,-.55,F1,3.15,0,'Floor1','linen')
sofa(-2.75,-2.25,F1,1.75,pi/2,'Floor1','green')
chair(2.45,-2.20,F1,-pi/2,'Floor1')
table(0,-2.15,F1,1.75,.85,.43,'Floor1','wood2')
# 茶几器物
cyl('茶盘',(0,-2.15,F1+.51),.28,.035,'brass','Floor1')
for x in [-.12,.12]:
    cyl('茶杯',(x,-2.15,F1+.58),.045,.09,'ivory','Floor1',16)
box('电视背景墙',(0,.43,F1+1.45),(3.7,.18,2.55),'wood2','Floor1',.04)
box('电视',(0,.30,F1+1.65),(2.0,.07,1.14),'black','Floor1',.035)
box('电视地柜',(0,-.02,F1+.28),(3.4,.48,.44),'wood','Floor1',.045)
plant(-3.25,-4.15,F1,.85)
plant(3.25,-.95,F1,.75)
# 客厅主灯
for x in [-1.3,0,1.3]:
    rod('客厅吊灯线',(x,-2.1,F1+2.55),(x,-2.1,F1+3.12),.012,'brass','Floor1')
    torus('客厅吊灯环',(x,-2.1,F1+2.52),.38,.025,'brass','Floor1')
    sphere('客厅吊灯',(x,-2.1,F1+2.52),(.20,.20,.20),'light','Floor1')

# 书房 / 会客室
rug(-7,-2.5,F1,4.6,3.4,'Floor1','green')
table(-7,-2.0,F1,2.1,.90,.76,'Floor1','wood2')
chair(-7,-1.25,F1,pi,'Floor1','green')
box('书房电脑',(-7,-2.05,F1+1.12),(.78,.07,.49),'black','Floor1',.025)
box('书房屏幕',(-7,-2.10,F1+1.12),(.70,.02,.41),'screen','Floor1')
bookshelf(-7,.0-.18,F1,4.5,2.65,'Floor1')
# 会客小茶桌与双椅
chair(-8.55,-4.05,F1,0,'Floor1')
chair(-5.55,-4.05,F1,0,'Floor1')
table(-7.05,-3.85,F1,.70,.70,.50,'Floor1','wood',True)
# 墙上水墨画
box('水墨画框',(-9.84,-2.4,F1+1.62),(.06,1.65,1.05),'wood','Floor1')
box('水墨画纸',(-9.80,-2.4,F1+1.62),(.025,1.48,.88),'ivory','Floor1')
for i in range(5):
    rod('画中竹枝',(-9.77,-2.9+i*.22,F1+1.30),(-9.77,-2.75+i*.22,F1+1.90),.012,'green','Floor1')

# 客房
bed(-7.05,2.55,F1,2.0,2.25,'Floor1')
box('客房衣柜',(-9.48,2.65,F1+1.20),(.70,3.25,2.40),'wood2','Floor1',.05)
for y in [1.6,2.65,3.7]:
    box('衣柜门缝',(-9.10,y,F1+1.2),(.018,.025,2.2),'brass','Floor1')
chair(-5.0,4.15,F1,-pi/2,'Floor1')
plant(-5.0,.65,F1,.65)
rug(-7.05,1.85,F1,3.5,2.2,'Floor1')

# 健身房
box('健身镜墙',(9.82,-2.45,F1+1.45),(.05,3.7,2.35),'glass','Floor1')
# 跑步机
box('跑步机底座',(6.0,-3.25,F1+.20),(1.0,2.05,.30),'black','Floor1',.12)
box('跑步机跑带',(6.0,-3.32,F1+.38),(.76,1.65,.06),'wood','Floor1',.05)
for x in [5.57,6.43]:
    rod('跑步机支架',(x,-2.55,F1+.32),(x,-2.25,F1+1.20),.035,'brass','Floor1')
box('跑步机屏幕',(6,-2.20,F1+1.28),(.62,.20,.35),'screen','Floor1',.05)
# 划船机
box('划船机滑轨',(7.85,-2.85,F1+.24),(.34,2.30,.14),'wood2','Floor1',.035)
box('划船机座',(7.85,-2.65,F1+.43),(.48,.42,.16),'black','Floor1',.05)
rod('划船机拉杆',(7.35,-3.80,F1+.85),(8.35,-3.80,F1+.85),.025,'brass','Floor1')
# 哑铃架与瑜伽垫
box('哑铃架',(9.15,-.95,F1+.55),(1.20,.48,1.0),'wood','Floor1',.04)
for z in [.45,.80]:
    for x in [8.75,9.15,9.55]:
        rod('哑铃',(x-.13,-1.22,F1+z),(x+.13,-1.22,F1+z),.035,'black','Floor1')
for x in [5.2,6.6]:
    box('瑜伽垫',(x,-.90,F1+.035),(.80,1.65,.055),'green','Floor1',.08)

# 厨房：后墙橱柜、冰箱与中岛
box('厨房橱柜',(7.15,4.53,F1+.46),(5.1,.82,.92),'wood2','Floor1',.04)
box('厨房台面',(7.15,4.48,F1+.96),(5.2,.90,.10),'stone','Floor1',.03)
for x in [5.0,5.85,6.7,7.55,8.4]:
    box('厨房吊柜',(x,4.66,F1+2.12),(.78,.40,.88),'wood','Floor1',.03)
box('双门冰箱',(9.25,3.92,F1+1.25),(1.12,1.0,2.48),'black','Floor1',.07)
for x in [9.0,9.5]:
    rod('冰箱拉手',(x,3.38,F1+1.05),(x,3.38,F1+1.75),.025,'brass','Floor1')
box('厨房中岛',(7.0,1.95,F1+.52),(3.2,1.15,1.02),'wood','Floor1',.055)
box('中岛石材台面',(7.0,1.95,F1+1.06),(3.38,1.30,.10),'stone','Floor1',.035)
for x in [6.0,7.0,8.0]:
    cyl('吧椅座',(x,.95,F1+.72),.25,.12,'linen','Floor1')
    cyl('吧椅脚',(x,.95,F1+.36),.055,.70,'brass','Floor1')
    rod('厨房吊灯线',(x,1.95,F1+2.35),(x,1.95,F1+3.1),.012,'brass','Floor1')
    cyl('厨房吊灯',(x,1.95,F1+2.30),.23,.20,'light','Floor1')
# 灶台与水槽
box('灶台',(6.1,4.0,F1+1.025),(1.0,.52,.025),'black','Floor1')
for x in [5.8,6.35]:
    for y in [3.86,4.15]:
        cyl('灶眼',(x,y,F1+1.05),.12,.02,'brass','Floor1')
box('水槽',(8.05,4.0,F1+1.03),(.75,.42,.035),'black','Floor1',.05)

# 餐厅
rug(2.55,2.90,F1,2.55,3.25,'Floor1')
table(2.55,2.85,F1,1.85,1.85,.77,'Floor1','wood',True)
for i in range(6):
    a=i*2*pi/6
    chair(2.55+1.45*cos(a),2.85+1.45*sin(a),F1,a-pi/2,'Floor1')
cyl('餐厅吊灯',(2.55,2.85,F1+2.50),.67,.30,'ivory','Floor1',48)
cyl('餐厅吊灯内光',(2.55,2.85,F1+2.34),.52,.045,'light','Floor1',48)
rod('餐厅灯线',(2.55,2.85,F1+2.65),(2.55,2.85,F1+3.15),.016,'brass','Floor1')
cyl('餐桌花艺',(2.55,2.85,F1+.96),.17,.35,'wood2','Floor1')
for i in range(5):
    a=i*2*pi/5
    rod('餐桌花枝',(2.55,2.85,F1+1.08),(2.55+.25*cos(a),2.85+.25*sin(a),F1+1.52),.012,'leaf','Floor1')

# 一层厕所与淋浴间
toilet(-3.15,4.25,F1,'Floor1')
vanity(-2.25,3.45,F1,'Floor1',.85)
shower(-2.80,1.60,F1,'Floor1',1.75,1.65)

# ───────────────────────── 二层家具 ─────────────────────────
# 主卧
rug(-6,-1.75,F2,5.4,4.3,'Floor2')
bed(-6,-1.55,F2,2.45,2.45,'Floor2')
box('主卧背景木饰面',(-6,.76,F2+1.55),(6.8,.18,2.85),'wood2','Floor2',.035)
for x in [-9.0,-3.0]:
    box('主卧背景竖线',(x,.64,F2+1.55),(.06,.06,2.65),'brass','Floor2')
box('主卧衣柜',(-9.45,-2.0,F2+1.30),(.72,4.6,2.60),'wood','Floor2',.04)
sofa(-3.0,-4.10,F2,1.45,0,'Floor2','green')
plant(-2.65,.10,F2,.75,'Floor2')
# 床尾凳
box('床尾凳',(-6,-3.32,F2+.44),(2.0,.55,.52),'linen','Floor2',.10)
# 主卧吊灯
for x in [-7.1,-4.9]:
    rod('主卧吊灯线',(x,-1.5,F2+2.3),(x,-1.5,F2+3.1),.012,'brass','Floor2')
    sphere('主卧吊灯',(x,-1.5,F2+2.2),(.25,.25,.32),'light','Floor2')

# 次卧
bed(6.1,2.65,F2,1.85,2.20,'Floor2')
rug(6.1,2.1,F2,3.6,3.0,'Floor2')
box('次卧衣柜',(9.45,2.5,F2+1.25),(.72,3.7,2.50),'wood2','Floor2',.05)
table(3.25,3.9,F2,1.55,.68,.75,'Floor2','wood2')
chair(3.25,3.15,F2,pi,'Floor2')
box('次卧台灯',(3.0,3.9,F2+.93),(.22,.22,.32),'light','Floor2',.04)
bookshelf(3.0,4.82,F2,1.55,2.35,'Floor2')

# 电竞房：双工位、屏幕与氛围灯
for x in [4.0,7.1]:
    table(x,-3.9,F2,2.45,.85,.76,'Floor2','black')
    chair(x,-2.95,F2,pi,'Floor2','black')
    box('电竞显示器',(x,-3.92,F2+1.30),(1.22,.08,.72),'black','Floor2',.05)
    box('电竞屏幕',(x,-3.97,F2+1.30),(1.12,.025,.61),'screen','Floor2')
    box('电竞主机',(x+.90,-3.75,F2+.52),(.38,.65,.88),'black','Floor2',.04)
    box('主机灯带',(x+.90,-4.09,F2+.52),(.24,.025,.68),'light','Floor2')
    box('键盘',(x,-3.55,F2+.85),(.72,.24,.035),'wood2','Floor2',.02)
# 氛围灯与海报
box('电竞氛围灯',(6,-4.84,F2+2.55),(6.7,.05,.055),'light','Floor2')
for x in [3.3,6.0,8.7]:
    box('电竞海报框',(x,-4.86,F2+1.65),(1.15,.06,1.45),'wood','Floor2',.04)
    box('电竞海报',(x,-4.91,F2+1.65),(.98,.025,1.28),'green' if x==6 else 'red','Floor2')
sofa(8.95,-.90,F2,1.55,pi/2,'Floor2','green')

# 二层厕所与淋浴间
toilet(-1.05,4.35,F2,'Floor2')
vanity(-1.05,3.55,F2,'Floor2',.90)
shower(1.0,1.85,F2,'Floor2',1.55,1.60)
vanity(1.0,4.45,F2,'Floor2',1.0)
# 楼梯厅休憩区与栏杆
chair(.95,-.15,F2,pi,'Floor2','green')
for x in [-1.65,1.65]:
    rod('二层楼梯厅扶手',(x,.85,F2+.88),(x,4.75,F2+.88),.035,'brass','Floor2')
    for i in range(13):
        y=.85+i*3.9/12
        rod('二层楼梯厅栏杆',(x,y,F2),(x,y,F2+.88),.018,'wood','Floor2')

# 全屋踢脚线与少量暖色顶灯，增强近看完成度。
for floor,group in [(F1,'Floor1'),(F2,'Floor2')]:
    for x in [-9.85,9.85]:
        box('侧墙踢脚线',(x,0,floor+.10),(.05,9.8,.20),'wood2',group)
    box('后墙踢脚线',(0,4.85,floor+.10),(19.7,.05,.20),'wood2',group)
    for x,y in [(-7,-2.5),(-7,2.5),(7,-2.5),(7,2.5),(0,-2.2),(2.6,2.8),(-6,-1.5),(6,2.5),(6,-2.5)]:
        cyl('嵌入式顶灯',(x,y,floor+3.20),.10,.035,'light',group,16)

# 保存源模型并导出 glTF；只输出几何和材质，网页端另配灯光。
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'chengyuan_villa.blend'))
# 网页导出时按“楼层组 + 材质”合批，保留可切换父组并显著降低 draw calls。
for obj in list(bpy.data.objects):
    if obj.type == 'MESH' and obj.modifiers:
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
for group_name, group_obj in GROUPS.items():
    buckets = {}
    for obj in list(group_obj.children):
        if obj.type != 'MESH' or not obj.data.materials:
            continue
        key = obj.data.materials[0].name
        buckets.setdefault(key, []).append(obj)
    for material_name, objects in buckets.items():
        if len(objects) < 2:
            objects[0].name = group_name + '__' + material_name
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = group_name + '__' + material_name
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT,'chengyuan_villa.glb'),
    export_format='GLB', export_apply=True, export_cameras=False,
    export_lights=False, export_yup=True, export_materials='EXPORT'
)
# 房间数据供网页端使用，坐标仍按 Blender 记录。
rooms = [
  {'id':'living','name':'大客厅','floor':1,'center':[0,-2.2],'area':'42 m²','mood':'围合会客 · 木作与亚麻'},
  {'id':'study','name':'书房 · 会客','floor':1,'center':[-7,-2.4],'area':'30 m²','mood':'整墙藏书 · 茶叙与阅读'},
  {'id':'guest','name':'客房','floor':1,'center':[-7,2.6],'area':'30 m²','mood':'庭院景观 · 安静留宿'},
  {'id':'gym','name':'健身房','floor':1,'center':[7,-2.5],'area':'30 m²','mood':'有氧训练 · 镜墙与瑜伽'},
  {'id':'kitchen','name':'厨房','floor':1,'center':[7,2.5],'area':'30 m²','mood':'中岛烹饪 · 双门冷藏'},
  {'id':'dining','name':'餐厅','floor':1,'center':[2.6,2.9],'area':'20 m²','mood':'圆桌家宴 · 暖光吊灯'},
  {'id':'bath1','name':'一层厕所','floor':1,'center':[-2.8,4.0],'area':'8 m²','mood':'干湿分区 · 石材与古铜'},
  {'id':'shower1','name':'一层淋浴间','floor':1,'center':[-2.8,1.5],'area':'6 m²','mood':'玻璃隔断 · 壁龛收纳'},
  {'id':'master','name':'主卧套房','floor':2,'center':[-6,-1.8],'area':'58 m²','mood':'木饰面背景 · 独立衣帽区'},
  {'id':'bedroom2','name':'次卧','floor':2,'center':[6,2.5],'area':'30 m²','mood':'阅读角 · 庭院朝向'},
  {'id':'gaming','name':'电竞房','floor':2,'center':[6,-2.5],'area':'30 m²','mood':'双人工位 · 氛围灯带'},
  {'id':'bath2','name':'二层厕所','floor':2,'center':[-1,4.0],'area':'7 m²','mood':'套房配套 · 古铜五金'},
  {'id':'shower2','name':'二层淋浴间','floor':2,'center':[1,1.8],'area':'7 m²','mood':'通透玻璃 · 独立淋浴'}
]
with open('/mnt/agents/output/app/src/rooms.json','w',encoding='utf-8') as f:
    json.dump(rooms,f,ensure_ascii=False,indent=2)
print('VILLA_BUILD_OK', len(bpy.data.objects), 'objects')
