"""菩园 Blender/Web3D shared modeling library.
All public modeling coordinates use the web convention: X right, Y up, Z front.
Meshes are converted to Blender Z-up only when committed to the scene.
"""
from __future__ import annotations
import bpy
import bmesh
import math
import random
import json
from pathlib import Path
from collections import defaultdict
from mathutils import Vector, Euler
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "public" / "textures"
GENERATED = ROOT / "blender" / "textures"
GENERATED.mkdir(parents=True, exist_ok=True)
F1, F2, WALL_H = 0.55, 4.15, 3.45
RNG = random.Random(20261112)


def linear_hex(value):
    value = value.lstrip("#")
    rgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)


def image(path):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.pack()
    return img


def prepare_images():
    """Create export-friendly, color-graded texture variants and real screen artwork."""
    source = Image.open(TEXTURES / "wood_floor_diff_1k.jpg").convert("RGB")
    for name, brightness, color in [
        ("oak", .92, 1.00), ("walnut", .54, .88), ("paleWood", 1.08, 1.02),
    ]:
        out = ImageEnhance.Brightness(source).enhance(brightness)
        out = ImageEnhance.Color(out).enhance(color)
        out = ImageEnhance.Contrast(out).enhance(.88)
        out.save(GENERATED / f"{name}_diff.jpg", quality=92)
    w, h = 1024, 640
    screen = Image.new("RGB", (w, h))
    px = screen.load()
    for y in range(h):
        t = y / h
        for x in range(w):
            vignette = max(0, ((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
            px[x, y] = (int(183 - 74 * t - 18 * vignette), int(202 - 68 * t - 15 * vignette), int(204 - 62 * t - 12 * vignette))
    draw = ImageDraw.Draw(screen, "RGBA")
    for layer in range(6):
        base = 260 + layer * 58
        pts = [(0, h)]
        for x in range(0, w + 32, 32):
            y = base + math.sin(x * .009 + layer * 1.7) * (35 + layer * 7) + math.sin(x * .025 + layer) * 13
            pts.append((x, y))
        pts += [(w, h)]
        shade = 104 - layer * 9
        draw.polygon(pts, fill=(shade - 10, shade + 7, shade + 3, 115 + layer * 18))
    draw.ellipse((750, 84, 812, 146), fill=(236, 226, 193, 190))
    screen = screen.filter(ImageFilter.GaussianBlur(.45))
    screen.save(GENERATED / "screen_landscape.jpg", quality=94)
    gaming = Image.new("RGB", (768, 480), (11, 21, 29))
    gd = ImageDraw.Draw(gaming)
    for i in range(12):
        gd.arc((50 + i * 12, 30 + i * 8, 710 - i * 8, 440 - i * 5), 195, 345, fill=(42 + i * 5, 98 + i * 5, 125 + i * 7), width=3)
    gd.line((80, 390, 690, 90), fill=(179, 111, 66), width=3)
    gaming.save(GENERATED / "screen_gaming.jpg", quality=92)
    # Fine, maintained lawn rather than a rocky yellow meadow texture.
    lawn_rng = random.Random(650)
    for variant in ("lawn", "lawn_alt"):
        lawn = Image.new("RGB", (512, 512))
        lp = lawn.load()
        for y in range(512):
            stripe = 5 if (y // 64) % 2 else -3
            for x in range(512):
                noise = lawn_rng.randint(-9, 9)
                bias = 4 if variant == "lawn_alt" else 0
                lp[x, y] = (78 + noise + stripe + bias, 99 + noise + stripe + bias, 57 + noise // 2)
        ld = ImageDraw.Draw(lawn)
        for _ in range(11500):
            x, y = lawn_rng.randrange(512), lawn_rng.randrange(512)
            tone = lawn_rng.choice([(105, 124, 75), (61, 82, 45), (88, 111, 62)])
            ld.line((x, y, x + lawn_rng.choice((-1, 0, 1)), y - lawn_rng.randint(1, 3)), fill=tone, width=1)
        lawn.save(GENERATED / f"{variant}_diff.jpg", quality=93)


def material(name, color, rough=.5, metal=0, texture=None, normal=None, rough_map=None,
             transmission=0, alpha=1, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = linear_hex(color)
    mat.use_backface_culling = False
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = linear_hex(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if texture:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image(texture)
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if emission:
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emission
    elif emission:
        bsdf.inputs["Emission Color"].default_value = linear_hex(color)
        bsdf.inputs["Emission Strength"].default_value = emission
    if normal:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image(normal)
        tex.image.colorspace_settings.name = "Non-Color"
        n = nodes.new("ShaderNodeNormalMap")
        n.inputs["Strength"].default_value = .42
        links.new(tex.outputs["Color"], n.inputs["Color"])
        links.new(n.outputs["Normal"], bsdf.inputs["Normal"])
    if rough_map:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image(rough_map)
        tex.image.colorspace_settings.name = "Non-Color"
        links.new(tex.outputs["Color"], bsdf.inputs["Roughness"])
    if alpha < 1:
        mat.surface_render_method = "DITHERED"
    return mat


def create_materials():
    prepare_images()
    m = {}
    def simple(key, color, rough=.5, metal=0, **kw):
        m[key] = material(key, color, rough, metal, **kw)
    simple("plaster", "d8d1c4", .82, texture=TEXTURES / "plastered_wall_04_diff_1k.jpg",
           normal=TEXTURES / "plastered_wall_04_nor_gl_1k.jpg", rough_map=TEXTURES / "plastered_wall_04_rough_1k.jpg")
    simple("limestone", "c9c1b1", .73, texture=TEXTURES / "concrete_floor_02_diff_1k.jpg",
           normal=TEXTURES / "concrete_floor_02_nor_gl_1k.jpg", rough_map=TEXTURES / "concrete_floor_02_rough_1k.jpg")
    simple("marble", "d2d0c9", .32, texture=TEXTURES / "marble_01_diff_1k.jpg",
           normal=TEXTURES / "marble_01_nor_gl_1k.jpg", rough_map=TEXTURES / "marble_01_rough_1k.jpg")
    for key in ("oak", "walnut", "paleWood"):
        simple(key, "b7a58e", .43, texture=GENERATED / f"{key}_diff.jpg",
               normal=TEXTURES / "wood_floor_nor_gl_1k.jpg", rough_map=TEXTURES / "wood_floor_rough_1k.jpg")
    for key, color in [("fabric", "b7b0a4"), ("fabricDark", "505b56"), ("fabricRust", "815e4c")]:
        simple(key, color, .88, normal=TEXTURES / "fabric_pattern_07_nor_gl_1k.jpg", rough_map=TEXTURES / "fabric_pattern_07_rough_1k.jpg")
    simple("grass", "647155", .96, texture=GENERATED / "lawn_diff.jpg")
    simple("grassAlt", "5d6b50", .97, texture=GENERATED / "lawn_alt_diff.jpg")
    simple("blackMetal", "242a29", .31, .72)
    simple("bronze", "8d704b", .28, .78)
    simple("steel", "a8afb0", .24, .86)
    simple("black", "171c1c", .48)
    simple("rubber", "202321", .92)
    simple("white", "e5e2db", .52)
    simple("ceramic", "dedbd2", .22)
    simple("jade", "678276", .25)
    simple("clay", "9b7963", .86)
    simple("paper", "ddd4bf", .92)
    simple("soil", "30291f", 1)
    simple("leaf", "36523c", .78)
    simple("leafLight", "5b704a", .75)
    simple("bookRed", "765146", .78)
    simple("bookGreen", "485b50", .78)
    simple("bookBlue", "4a5e68", .78)
    simple("glass", "c7d7d5", .08, .05, transmission=.72, alpha=.24)
    simple("frosted", "c8d0ca", .38, transmission=.25, alpha=.5)
    simple("water", "718f8c", .12, .25, transmission=.32, alpha=.72)
    simple("mirror", "c6cfcd", .08, .94)
    simple("emissiveWarm", "ffe0ac", .35, emission=2.8)
    simple("emissiveCool", "79b9c9", .3, emission=2.2)
    simple("screen", "ffffff", .3, texture=GENERATED / "screen_gaming.jpg", emission=.75)
    simple("display", "ffffff", .28, texture=GENERATED / "screen_landscape.jpg", emission=.6)
    simple("art", "ffffff", .88, texture=GENERATED / "screen_landscape.jpg")
    return m


class Bucket:
    def __init__(self):
        self.vertices, self.faces, self.smooth, self.face_uv = [], [], [], []

    def add(self, vertices, faces, position=(0, 0, 0), rotation=(0, 0, 0), uv_scale=.6, smooth=False, uv=None):
        matrix = Euler(rotation, "XYZ").to_matrix() if any(rotation) else None
        offset = len(self.vertices)
        for v in vertices:
            p = Vector(v)
            if matrix is not None:
                p = matrix @ p
            self.vertices.append((p.x + position[0], p.y + position[1], p.z + position[2]))
        for fi, face in enumerate(faces):
            self.faces.append(tuple(offset + i for i in face))
            self.smooth.append(smooth)
            self.face_uv.append(uv[fi] if uv else None)

    def commit(self, name, mat, collection):
        if not self.faces:
            return None
        # Web Y-up -> Blender Z-up. This is a proper rotation, winding is preserved.
        verts = [(x, -z, y) for x, y, z in self.vertices]
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], self.faces)
        mesh.materials.append(mat)
        mesh.update()
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for poly, smooth, custom_uv in zip(mesh.polygons, self.smooth, self.face_uv):
            poly.use_smooth = smooth
            n = poly.normal
            # Convert normal back to web coordinates for stable world-scale box mapping.
            nx, ny, nz = n.x, n.z, -n.y
            axis = max(range(3), key=lambda i: abs((nx, ny, nz)[i]))
            for li, loop_index in enumerate(poly.loop_indices):
                co = self.vertices[mesh.loops[loop_index].vertex_index]
                if custom_uv:
                    uv = custom_uv[li]
                elif axis == 1:
                    uv = (co[0] * .55, co[2] * .55)
                elif axis == 0:
                    uv = (co[2] * .55, co[1] * .55)
                else:
                    uv = (co[0] * .55, co[1] * .55)
                uv_layer.data[loop_index].uv = uv
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj["pipeline"] = "Blender source / material batched / web coordinate contract"
        return obj


_BOX_CACHE = {}
def box_geometry(dims, bevel):
    key = tuple(round(v, 4) for v in dims) + (round(bevel, 4),)
    if key in _BOX_CACHE:
        return _BOX_CACHE[key]
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co.x *= dims[0]
        v.co.y *= dims[1]
        v.co.z *= dims[2]
    if bevel > .0001:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(dims) * .42), segments=3, affect="EDGES")
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    verts = [tuple(v.co) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    _BOX_CACHE[key] = (verts, faces)
    return verts, faces


class Model:
    def __init__(self, materials):
        self.materials = materials
        self.buckets = defaultdict(Bucket)
        self.collections = {}
        self.count = 0
        self.signatures = set()
        for name in ("Site", "ExteriorShell", "FrontDetails", "Roof", "Floor1", "Floor2", "Cut1", "Cut2"):
            col = bpy.data.collections.new(name)
            bpy.context.scene.collection.children.link(col)
            empty = bpy.data.objects.new(name, None)
            col.objects.link(empty)
            empty["visibility_contract"] = name
            self.collections[name] = (col, empty)

    def bucket(self, group, mat):
        return self.buckets[(group, mat)]

    def box(self, group, mat, p, dims, bevel=.025, rotation=(0, 0, 0), ry=None, uv_scale=.6):
        if ry is not None:
            rotation = (rotation[0], ry, rotation[2]) if isinstance(rotation, tuple) else (0, ry, 0)
        # Shared cutaway boundaries are requested once per adjacent room. Submitting
        # both copies creates exactly coincident triangles and visible z-fighting.
        signature = (group, mat,
                     tuple(round(float(v), 6) for v in (*p, *dims)),
                     tuple(round(float(v), 6) for v in rotation))
        if signature in self.signatures:
            return
        self.signatures.add(signature)
        verts, faces = box_geometry(dims, bevel)
        self.bucket(group, mat).add(verts, faces, p, rotation, uv_scale)
        self.count += 1

    def cylinder(self, group, mat, p, radius, depth, radius_top=None, segments=24, rotation=(0, 0, 0), ry=None, open_ended=False):
        rt = radius if radius_top is None else radius_top
        if ry is not None:
            rotation = (0, ry, 0)
        verts = []
        for y, r in ((-depth / 2, radius), (depth / 2, rt)):
            for i in range(segments):
                a = i / segments * math.tau
                verts.append((math.cos(a) * r, y, math.sin(a) * r))
        faces = []
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((i, j, segments + j, segments + i))
        if not open_ended:
            faces += [tuple(reversed(range(segments))), tuple(range(segments, segments * 2))]
        bucket = self.bucket(group, mat)
        offset = len(bucket.vertices)
        bucket.add(verts, faces, p, rotation)
        # Smooth only side polygons; caps stay planar.
        start = len(bucket.smooth) - len(faces)
        for i in range(segments):
            bucket.smooth[start + i] = True
        self.count += 1

    def sphere(self, group, mat, p, scale, segments=20, rings=12, rotation=(0, 0, 0)):
        # Single pole vertices avoid the zero-area triangles produced by a full
        # ring of coincident vertices at each pole.
        verts = [(0, scale[1], 0)]
        for j in range(1, rings):
            phi = j / rings * math.pi
            for i in range(segments):
                a = i / segments * math.tau
                verts.append((math.sin(phi) * math.cos(a) * scale[0], math.cos(phi) * scale[1], math.sin(phi) * math.sin(a) * scale[2]))
        bottom = len(verts)
        verts.append((0, -scale[1], 0))
        faces = []
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((0, 1 + ni, 1 + i))
        for j in range(rings - 2):
            start = 1 + j * segments
            next_start = start + segments
            for i in range(segments):
                ni = (i + 1) % segments
                faces.append((start + i, start + ni, next_start + ni, next_start + i))
        last = 1 + (rings - 2) * segments
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((last + i, last + ni, bottom))
        self.bucket(group, mat).add(verts, faces, p, rotation, smooth=True)
        self.count += 1

    def rod(self, group, mat, p1, p2, radius, segments=12):
        a, b = Vector(p1), Vector(p2)
        direction = b - a
        length = direction.length
        if length < .0001:
            return
        q = Vector((0, 1, 0)).rotation_difference(direction.normalized())
        verts = []
        for y in (-length / 2, length / 2):
            for i in range(segments):
                ang = i / segments * math.tau
                v = q @ Vector((math.cos(ang) * radius, y, math.sin(ang) * radius))
                verts.append(tuple(v))
        faces = [(i, (i + 1) % segments, (i + 1) % segments + segments, i + segments) for i in range(segments)]
        faces += [tuple(reversed(range(segments))), tuple(range(segments, segments * 2))]
        bucket = self.bucket(group, mat)
        bucket.add(verts, faces, (a + b) / 2)
        start = len(bucket.smooth) - len(faces)
        for i in range(segments):
            bucket.smooth[start + i] = True
        self.count += 1

    def torus(self, group, mat, p, major, minor, rotation=(0, 0, 0), arc=math.tau, seg=32, sides=8):
        closed = abs(arc - math.tau) < .001
        count = seg if closed else seg + 1
        verts = []
        for i in range(count):
            a = i / seg * arc
            for j in range(sides):
                b = j / sides * math.tau
                r = major + minor * math.cos(b)
                verts.append((r * math.cos(a), minor * math.sin(b), r * math.sin(a)))
        faces = []
        for i in range(seg):
            ni = (i + 1) % count
            for j in range(sides):
                nj = (j + 1) % sides
                faces.append((i * sides + j, ni * sides + j, ni * sides + nj, i * sides + nj))
        self.bucket(group, mat).add(verts, faces, p, rotation, smooth=True)
        self.count += 1

    def quad(self, group, mat, vertices, uv=None):
        self.bucket(group, mat).add(vertices, [(0, 1, 2, 3)], uv=[uv or [(0, 0), (1, 0), (1, 1), (0, 1)]])
        self.count += 1

    def mesh(self, group, mat, vertices, faces, smooth=False):
        self.bucket(group, mat).add(vertices, faces, smooth=smooth)
        self.count += 1

    def flush(self):
        objects = []
        for (group, mat), bucket in sorted(self.buckets.items()):
            col, parent = self.collections[group]
            obj = bucket.commit(f"{group}__{mat}", self.materials[mat], col)
            if obj:
                obj.parent = parent
                objects.append(obj)
        return objects


class Ledger:
    def __init__(self):
        self.rooms = defaultdict(list)

    def add(self, room, label, p):
        items = self.rooms[room]
        # The manifest catalogs 50 primary, inspectable details per room. Supplemental
        # geometry (fixtures, seams, foliage) remains visible without inflating the list.
        if len(items) >= 50:
            return
        items.append({"index": len(items) + 1, "label": label, "position": list(p)})

    def validate(self, ids):
        bad = {room: len(self.rooms[room]) for room in ids if len(self.rooms[room]) != 50}
        if bad:
            raise RuntimeError(f"Visible detail validation failed: {bad}")
        return self.rooms


def rotate_point(x, z, dx, dz, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return x + dx * c + dz * s, z - dx * s + dz * c


class Props:
    def __init__(self, model, ledger):
        self.b, self.l = model, ledger

    def note(self, room, label, x, y, z):
        self.l.add(room, label, (x, y, z))

    def room_finish(self, room, g, base, cx, cz, w, d, wet=False, window="front", door=False, rear_openings=None):
        b = self.b
        floor = "marble" if wet else "oak"
        b.box(g, floor, (cx, base - .055, cz), (w, .11, d), .015)
        self.note(room, "防滑石材地面" if wet else "通铺真实木地板", cx, base, cz)
        for i in range(8):
            x = cx - w * .42 + i * w * .12
            b.box(g, "limestone" if wet else "walnut", (x, base + .003, cz), (.011 if wet else .006, .006, d * .94), .001)
            self.note(room, f"地面石砖拼缝 {i+1}" if wet else f"木地板分缝 {i+1}", x, base, cz)
        strips = [(cx, base + .07, cz - d / 2 + .055, w, .14, .07),
                  (cx - w / 2 + .055, base + .07, cz, .07, .14, d),
                  (cx + w / 2 - .055, base + .07, cz, .07, .14, d)]
        for i, s in enumerate(strips):
            b.box(g, "limestone" if wet else "walnut", s[:3], s[3:], .008)
            self.note(room, f"踢脚线收边 {i+1}", *s[:3])
        # Three panels close the rear wall unless a real circulation doorway is
        # requested. The gaming/bedroom connection uses the latter.
        if door:
            rear = cz - d / 2 + .07
            opening = 1.3
            side_width = (w - opening) / 2
            for side in (-1, 1):
                xx = cx + side * (opening / 2 + side_width / 2)
                b.box(g, "plaster", (xx, base + 1.55, rear), (side_width - .012, 2.75, .12), .015)
                b.box(g, "walnut", (cx + side * (opening / 2 + .035), base + 1.14, rear + .015), (.07, 2.28, .19), .012)
                self.note(room, f"门洞侧墙 {'左' if side < 0 else '右'}", xx, base + 1.5, rear)
            b.box(g, "plaster", (cx, base + 2.52, rear), (opening, .46, .12), .015)
            b.box(g, "walnut", (cx, base + 2.28, rear + .015), (opening + .14, .07, .19), .012)
        else:
            rear = cz - d / 2 + .07
            wall_height = 3.0 if wet else 2.75
            wall_center = base + (1.5 if wet else 1.55)
            if rear_openings:
                # Actual circulation openings through the living-room rear wall.
                # They align with the dining room and both wet-room doorways behind it.
                cursor = cx - w / 2
                for door_x, door_w in sorted(rear_openings):
                    left, right = door_x - door_w / 2, door_x + door_w / 2
                    if left > cursor:
                        b.box(g, "plaster", ((cursor + left) / 2, wall_center, rear),
                              (left - cursor - .006, wall_height, .12), .015)
                    b.box(g, "plaster", (door_x, base + 2.53, rear),
                          (door_w, .44, .12), .015)
                    for side in (-1, 1):
                        b.box(g, "walnut", (door_x + side * (door_w / 2 + .035), base + 1.14, rear + .015),
                              (.07, 2.28, .19), .012)
                    b.box(g, "walnut", (door_x, base + 2.28, rear + .015),
                          (door_w + .14, .07, .19), .012)
                    cursor = right
                if cursor < cx + w / 2:
                    b.box(g, "plaster", ((cursor + cx + w / 2) / 2, wall_center, rear),
                          (cx + w / 2 - cursor - .006, wall_height, .12), .015)
                self.note(room, "后区卫浴门洞与六米餐厨开放口", cx, base + 1.5, rear)
            else:
                for i in range(3):
                    x = cx + (i - 1) * w / 3
                    b.box(g, "marble" if wet else "plaster", (x, wall_center, rear), (w / 3 - .018, wall_height, .12), .015)
                    self.note(room, f"石材墙面分块 {i+1}" if wet else f"灰泥背景墙分块 {i+1}", x, base + 1.5, cz - d / 2)
        if wet:
            front = cz + d / 2 - .07
            opening = min(1.15, w * .42)
            side_width = (w - opening) / 2
            for side in (-1, 1):
                xx = cx + side * (opening / 2 + side_width / 2)
                b.box(g, "plaster", (xx, base + 1.5, front), (side_width, 3.0, .14), .015)
                b.box(g, "marble", (xx, base + .62, front - .085), (side_width - .025, 1.1, .035), .01)
            b.box(g, "plaster", (cx, base + 2.64, front), (opening, .72, .14), .015)
            for side in (-1, 1):
                b.box(g, "walnut", (cx + side * (opening / 2 + .035), base + 1.14, front + .015), (.07, 2.28, .19), .012)
            b.box(g, "walnut", (cx, base + 2.28, front + .015), (opening + .14, .07, .19), .012)
        wz = cz - d / 2 + .14 if window == "back" else cz + d / 2 - .14
        b.box(g, "limestone", (cx, base + .76, wz), (w * .55, .1, .32), .025)
        self.note(room, "整石窗台", cx, base + .76, wz)
        for side in (-1, 1):
            x = cx + side * w * .29
            if wet:
                b.box(g, "frosted", (x, base + 1.9, wz), (w * .12, 2.3, .035), .006)
            else:
                # Pleated curtains are geometry, not flat colored rectangles.
                for j in range(7):
                    b.cylinder(g, "fabric", (x + (j - 3) * w * .017, base + 1.9, wz), w * .011, 2.3, segments=10)
            self.note(room, f"磨砂玻璃窗 {'左' if side < 0 else '右'}" if wet else f"亚麻落地帘 {'左' if side < 0 else '右'}", x, base + 1.9, wz)
        b.rod(g, "bronze", (cx - w * .36, base + 3.08, wz), (cx + w * .36, base + 3.08, wz), .025)
        self.note(room, "古铜窗框上轨" if wet else "古铜窗帘轨", cx, base + 3.08, wz)
        b.box(g, "white", (cx - w / 2 + .11, base + 1.25, cz + d * .2), (.055, .13, .1), .012)
        self.note(room, "墙面开关面板", cx - w / 2, base + 1.25, cz + d * .2)
        b.box(g, "white", (cx + w / 2 - .11, base + .36, cz - d * .15), (.055, .11, .15), .01)
        self.note(room, "低位电源插座", cx + w / 2, base + .36, cz - d * .15)

    def rug(self, room, g, base, x, z, w, d, mat="fabric", label="手工织毯"):
        self.b.box(g, mat, (x, base + .018, z), (w, .035, d), .035)
        # Bound edges and subtle fringe catch close-up light.
        for side in (-1, 1):
            self.b.box(g, "fabricDark", (x + side * (w / 2 - .035), base + .039, z), (.025, .008, d - .06), .003)
        self.note(room, label, x, base, z)

    def table(self, room, g, base, x, z, w, d, h=.74, mat="walnut", label="实木桌"):
        self.b.box(g, mat, (x, base + h, z), (w, .1, d), .035)
        for sx in (-1, 1):
            for sz in (-1, 1):
                self.b.box(g, mat, (x + sx * (w / 2 - .14), base + h / 2, z + sz * (d / 2 - .14)), (.1, h, .1), .018)
        self.note(room, label, x, base + h, z)

    def chair(self, room, g, base, x, z, yaw=0, label="实木软包椅", mat="fabric"):
        b = self.b
        def part(dx, y, dz, dims, material, bevel=.025):
            px, pz = rotate_point(x, z, dx, dz, yaw)
            b.box(g, material, (px, base + y, pz), dims, bevel, ry=yaw)
        part(0, .47, 0, (.58, .15, .58), mat, .07)
        part(0, .88, -.25, (.6, .72, .09), "walnut", .04)
        for sx in (-1, 1):
            for sz in (-1, 1):
                part(sx * .23, .23, sz * .22, (.065, .46, .065), "walnut", .015)
        for sx in (-1, 1):
            part(sx * .34, .67, 0, (.07, .09, .54), "walnut", .025)
        self.note(room, label, x, base + .5, z)

    def sofa(self, room, g, base, x, z, w=2.5, yaw=0, label="亚麻三人沙发", mat="fabric"):
        b = self.b
        def part(dx, y, dz, dims, material, bevel=.06):
            px, pz = rotate_point(x, z, dx, dz, yaw)
            b.box(g, material, (px, base + y, pz), dims, bevel, ry=yaw)
        part(0, .28, 0, (w, .22, .94), "walnut", .04)
        part(0, .49, .04, (w - .22, .28, .78), mat, .11)
        part(0, .91, -.38, (w - .12, .72, .2), mat, .1)
        for side in (-1, 1):
            part(side * (w / 2 - .08), .63, 0, (.16, .58, .94), mat, .07)
            part(side * w * .32, .11, 0, (.11, .22, .64), "walnut", .02)
        cushions = max(2, round(w / .8))
        for i in range(cushions):
            dx = (i - (cushions - 1) / 2) * (w - .35) / cushions
            part(dx, .65, .08, ((w - .32) / cushions - .025, .13, .65), mat, .055)
        self.note(room, label, x, base + .5, z)

    def cushion(self, room, g, base, x, y, z, mat="fabricRust", label="软包靠垫"):
        self.b.box(g, mat, (x, y, z), (.5, .48, .17), .12, rotation=(.08, 0, .06))
        self.note(room, label, x, y, z)

    def shelf(self, room, g, base, x, z, w, h, rows=4, label="开放木作书柜", cabinet=False):
        b = self.b
        b.box(g, "walnut", (x, base + h / 2, z - .15), (w, h, .06), .015)
        for i in range(rows + 1):
            b.box(g, "walnut", (x, base + .1 + i * (h - .2) / rows, z + .03), (w, .065, .43), .014)
        for side in (-1, 1):
            b.box(g, "walnut", (x + side * (w / 2 - .04), base + h / 2, z + .03), (.08, h, .43), .015)
        if cabinet:
            for i in range(max(2, round(w / .6))):
                n = max(2, round(w / .6))
                xx = x - w / 2 + (i + .5) * w / n
                b.box(g, "oak", (xx, base + h / 2, z + .27), (w / n - .025, h - .08, .045), .015)
                b.rod(g, "bronze", (xx + w / n * .25, base + h * .43, z + .31), (xx + w / n * .25, base + h * .57, z + .31), .012)
        else:
            for row in range(rows):
                for j in range(max(3, int(w / .22))):
                    n = max(3, int(w / .22))
                    xx = x - w / 2 + .14 + j * (w - .28) / n
                    ht = .22 + (j % 4) * .025
                    b.box(g, ("bookRed", "bookGreen", "bookBlue", "paper")[(j + row) % 4],
                          (xx, base + .16 + row * (h - .2) / rows + ht / 2, z + .12), (.08, ht, .22), .006)
        self.note(room, label, x, base + h / 2, z)

    def book(self, room, g, base, x, y, z, index=1, upright=False):
        mat = ("bookRed", "bookGreen", "bookBlue", "paper")[index % 4]
        self.b.box(g, mat, (x, y, z), (.07, .32, .22) if upright else (.34, .055, .24), .008, ry=(index % 3 - 1) * .05)
        self.note(room, f"书册 {index}", x, y, z)

    def lamp(self, room, g, base, x, z, h=1.55, label="暖光落地灯"):
        b = self.b
        b.cylinder(g, "bronze", (x, base + .035, z), .24, .07)
        b.cylinder(g, "bronze", (x, base + h / 2, z), .023, h)
        b.cylinder(g, "paper", (x, base + h, z), .3, .4, .2, segments=32)
        b.cylinder(g, "emissiveWarm", (x, base + h - .08, z), .065, .13)
        self.note(room, label, x, base + h, z)

    def pendant(self, room, g, base, x, z, h=2.8, label="宣纸吊灯"):
        b = self.b
        b.cylinder(g, "blackMetal", (x, base + h + .25, z), .012, .5)
        b.sphere(g, "paper", (x, base + h, z), (.38, .28, .38), segments=24, rings=16)
        b.sphere(g, "emissiveWarm", (x, base + h - .08, z), (.09, .09, .09))
        self.note(room, label, x, base + h, z)

    def vase(self, room, g, base, x, y, z, label="手作陶瓷花器", mat="ceramic"):
        self.b.cylinder(g, mat, (x, y + .16, z), .13, .3, .075, segments=24)
        self.b.cylinder(g, mat, (x, y + .34, z), .075, .09, segments=24)
        self.note(room, label, x, y, z)

    def branches(self, room, g, base, x, y, z, label="插枝花枝"):
        for i in range(5):
            dx = (i - 2) * .08
            end = (x + dx, y + .65 + (i % 2) * .12, z + (i % 3 - 1) * .09)
            self.b.rod(g, "walnut", (x, y, z), end, .012, 8)
            self.b.sphere(g, "leafLight", end, (.1, .035, .055), segments=12, rings=8)
        self.note(room, label, x, y, z)

    def plant(self, room, g, base, x, z, scale=1, label="盆栽绿植"):
        b = self.b
        b.cylinder(g, "clay", (x, base + .22 * scale, z), .25 * scale, .44 * scale, .31 * scale, segments=24)
        b.cylinder(g, "soil", (x, base + .45 * scale, z), .27 * scale, .035 * scale)
        for i in range(14):
            a = i / 14 * math.tau
            r = .32 * scale
            end = (x + math.cos(a) * r, base + (.78 + (i % 3) * .14) * scale, z + math.sin(a) * r)
            b.rod(g, "leaf", (x, base + .44 * scale, z), end, .009 * scale, 7)
            # Lanceolate leaf with a central fold.
            ux, uz = math.cos(a), math.sin(a)
            vx, vz = -uz, ux
            y = end[1]
            verts = [(end[0] - ux * .16 * scale, y - .12 * scale, end[2] - uz * .16 * scale),
                     (end[0] + vx * .11 * scale, y, end[2] + vz * .11 * scale),
                     (end[0] + ux * .3 * scale, y + .13 * scale, end[2] + uz * .3 * scale),
                     (end[0] - vx * .11 * scale, y, end[2] - vz * .11 * scale)]
            b.quad(g, "leaf" if i % 2 else "leafLight", verts)
        self.note(room, label, x, base + .5 * scale, z)

    def cup(self, room, g, base, x, y, z, label="茶杯", mat="ceramic"):
        self.b.cylinder(g, mat, (x, y + .055, z), .055, .11, open_ended=True, segments=20)
        self.b.torus(g, mat, (x + .065, y + .06, z), .035, .009, rotation=(0, math.pi / 2, 0))
        self.note(room, label, x, y, z)

    def bottle(self, room, g, base, x, y, z, label="洗护瓶", mat="jade", h=.22):
        self.b.cylinder(g, mat, (x, y + h / 2, z), .055, h, segments=16)
        self.b.cylinder(g, "blackMetal", (x, y + h + .025, z), .026, .05, segments=12)
        self.note(room, label, x, y, z)

    def artwork(self, room, g, base, x, y, z, w=1.2, h=.85, label="水墨装饰画", yaw=0):
        self.b.box(g, "walnut", (x, y, z), (w + .09, h + .09, .055), .015, ry=yaw)
        # Panel lies in local XY and faces +Z.
        verts = [(-w/2, -h/2, .034), (w/2, -h/2, .034), (w/2, h/2, .034), (-w/2, h/2, .034)]
        rot = Euler((0, yaw, 0)).to_matrix()
        world = [tuple(rot @ Vector(v) + Vector((x, y, z))) for v in verts]
        self.b.quad(g, "art", world)
        self.note(room, label, x, y, z)

    def bowl(self, room, g, base, x, y, z, label="陶瓷碗", mat="ceramic", radius=.16):
        self.b.cylinder(g, mat, (x, y + .055, z), radius * .62, .11, radius, segments=24, open_ended=True)
        self.note(room, label, x, y, z)

    def television(self, room, g, base, x, y, z, w=2.2, label="超窄边电视", yaw=0):
        self.b.box(g, "blackMetal", (x, y, z), (w, w * .56, .075), .025, ry=yaw)
        h = w * .52
        local = [(-w*.48,-h/2,.041),(w*.48,-h/2,.041),(w*.48,h/2,.041),(-w*.48,h/2,.041)]
        rot = Euler((0,yaw,0)).to_matrix()
        vertices = [tuple(rot @ Vector(v) + Vector((x,y,z))) for v in local]
        self.b.quad(g, "display", vertices)
        self.note(room, label, x, y, z)

    def monitor(self, room, g, base, x, y, z, label="电竞显示器"):
        self.b.box(g, "blackMetal", (x, y, z), (.74, .46, .055), .025)
        self.b.quad(g, "screen", [(x-.345,y-.2,z+.031),(x+.345,y-.2,z+.031),(x+.345,y+.2,z+.031),(x-.345,y+.2,z+.031)])
        self.b.box(g, "blackMetal", (x, y - .33, z), (.05, .22, .05), .01)
        self.b.box(g, "blackMetal", (x, y - .44, z), (.32, .035, .2), .015)
        self.note(room, label, x, y, z)

    def toilet(self, room, g, base, x, z, label="壁挂智能马桶"):
        self.b.sphere(g, "ceramic", (x, base + .43, z), (.34, .28, .48), segments=24, rings=16)
        self.b.box(g, "ceramic", (x, base + .78, z - .32), (.62, .72, .25), .1)
        self.b.torus(g, "white", (x, base + .62, z + .04), .27, .035, rotation=(math.pi / 2, 0, 0))
        self.note(room, label, x, base + .5, z)

    def vanity(self, room, g, base, x, z, w=1.25, label="悬浮石材洗手台"):
        self.b.box(g, "walnut", (x, base + .48, z), (w, .62, .55), .045)
        self.b.box(g, "marble", (x, base + .83, z), (w + .08, .1, .62), .025)
        self.b.sphere(g, "ceramic", (x, base + .89, z + .02), (.32, .09, .23), segments=24, rings=12)
        self.b.rod(g, "bronze", (x, base + .89, z - .2), (x, base + 1.17, z - .2), .025)
        self.b.rod(g, "bronze", (x, base + 1.17, z - .2), (x, base + 1.17, z + .03), .025)
        self.note(room, label, x, base + .8, z)

    def mirror(self, room, g, base, x, y, z, w=1.1, h=1.0, label="防雾浴室镜", yaw=0):
        self.b.box(g, "bronze", (x, y, z), (w + .06, h + .06, .045), .035, ry=yaw)
        dx, dz = rotate_point(0, 0, 0, .028, yaw)
        self.b.box(g, "mirror", (x + dx, y, z + dz), (w, h, .018), .03, ry=yaw)
        self.note(room, label, x, y, z)

    def towel(self, room, g, base, x, y, z, label="棉麻毛巾", mat="fabric"):
        self.b.box(g, mat, (x, y, z), (.42, .58, .045), .035)
        self.note(room, label, x, y, z)

    def stool(self, room, g, base, x, z, label="吧台高脚凳"):
        b = self.b
        b.cylinder(g, "walnut", (x, base + .72, z), .28, .12, segments=28)
        b.cylinder(g, "blackMetal", (x, base + .36, z), .045, .7)
        b.cylinder(g, "blackMetal", (x, base + .03, z), .25, .06)
        b.torus(g, "bronze", (x, base + .25, z), .2, .018, rotation=(math.pi / 2, 0, 0))
        self.note(room, label, x, base + .72, z)

    def bed(self, room, g, base, x, z, width=2.0, label="完整软包双人床"):
        b = self.b
        length = 2.25
        b.box(g, "walnut", (x, base + .24, z), (width + .12, .38, length), .07)
        b.box(g, "fabricDark", (x, base + 1.05, z - length / 2 + .04), (width + .22, 1.55, .16), .08)
        b.box(g, "white", (x, base + .53, z + .03), (width, .3, length - .12), .13)
        b.box(g, "fabric", (x, base + .72, z + .27), (width - .06, .16, length * .64), .08)
        # Realistic separate pillows, duvet fold, timber feet and upholstered seams.
        for side in (-1, 1):
            b.box(g, "white", (x + side * width * .245, base + .79, z - .65), (width * .43, .18, .48), .09, rotation=(.06, 0, side * .03))
            b.box(g, "walnut", (x + side * width * .38, base + .08, z + .8), (.12, .16, .12), .02)
        b.box(g, "fabricDark", (x, base + .82, z + .72), (width - .1, .055, .46), .025)
        self.note(room, label, x, base + .65, z)
