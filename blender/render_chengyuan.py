"""CPU Cycles visual checks for the saved Puyuan source scene."""
from pathlib import Path
import sys
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=Path("/mnt/agents")/"puyuan-qa-blender"
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/"blender"/"artifacts"/"chengyuan_blender_source.blend"))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1100
scene.render.resolution_y=820
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.view_settings.exposure=.45
world=scene.world
world.use_nodes=True
bg=world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value=(.56,.67,.78,1)
bg.inputs["Strength"].default_value=.55
# Neutral studio ground is lookdev-only and never enters the web GLB.
bpy.ops.mesh.primitive_plane_add(size=300,location=(0,0,-.44))
ground=bpy.context.object
ground.name="Lookdev Ground"
mat=bpy.data.materials.new("Lookdev Ground")
mat.diffuse_color=(.20,.24,.20,1)
ground.data.materials.append(mat)
cam=scene.camera
cam.data.clip_end=400

def web(p):
    return Vector((p[0],-p[2],p[1]))

def shot(name,pos,target,visible,lens=45):
    for cname in ("Site","ExteriorShell","FrontDetails","Roof","Floor1","Floor2","Cut1","Cut2"):
        col=bpy.data.collections.get(cname)
        if col:
            for obj in col.objects:
                obj.hide_render=cname not in visible
    ground.hide_render=name!="exterior"
    cam.location=web(pos)
    cam.rotation_euler=(web(target)-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.lens=lens
    scene.render.filepath=str(OUT/f"{name}.png")
    bpy.ops.render.render(write_still=True)

shot("exterior",(39,25,43),(0,3,0),{"Site","ExteriorShell","FrontDetails","Roof","Floor1","Floor2"},48)
shot("rear",(-34,22,-32),(0,4,-4),{"Site","ExteriorShell","FrontDetails","Roof","Floor1","Floor2"},45)
shot("rear-detail",(19,14,-31),(2,5,-12),{"Site","ExteriorShell","FrontDetails","Roof","Floor1","Floor2"},45)
shot("floor1",(23,31,27),(0,.8,0),{"Floor1","Cut1"},48)
shot("living",(5.2,3.95,-.2),(-2,1.7,1),{"Floor1","Cut1"},32)
shot("master",(-6.6,7.55,-6.5),(-10,5.3,2.2),{"Floor2","Cut2"},32)
print("LOOKDEV_RENDERED",OUT)
