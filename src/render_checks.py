import bpy, math, os
from mathutils import Vector
from PIL import Image, ImageDraw

OUT='/mnt/agents/output/blender_checks'
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath='/mnt/agents/output/app/public/models/chengyuan_villa.blend')
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=8
scene.cycles.use_denoising=True
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.world.color=(.32,.32,.32)
bpy.ops.object.light_add(type='SUN',location=(20,30,25))
sun=bpy.context.object
sun.data.energy=2.2
sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(35))
bpy.ops.object.light_add(type='AREA',location=(-15,-10,24))
area=bpy.context.object
area.data.energy=1800
area.data.shape='DISK'
area.data.size=18
area.rotation_euler=(Vector((0,0,2))-area.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
cam=bpy.context.object
scene.camera=cam
cam.data.type='ORTHO'
cam.data.ortho_scale=48
cam.data.clip_end=500
shots=[]
for i in range(8):
    a=i*math.pi/4
    cam.location=(42*math.cos(a),42*math.sin(a),28)
    cam.rotation_euler=(Vector((0,0,2.4))-cam.location).to_track_quat('-Z','Y').to_euler()
    path=f'{OUT}/orbit_{i+1}.png'
    scene.render.filepath=path
    bpy.ops.render.render(write_still=True)
    shots.append(path)
cam.location=(0,0,60)
cam.rotation_euler=(0,0,0)
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.ortho_scale=44
path=f'{OUT}/top.png'
scene.render.filepath=path
bpy.ops.render.render(write_still=True)
shots.append(path)
contact=Image.new('RGB',(1200,1200),(215,214,207))
for i,path in enumerate(shots):
    im=Image.open(path).convert('RGB').resize((400,400))
    contact.paste(im,((i%3)*400,(i//3)*400))
contact.save(f'{OUT}/contact.jpg',quality=90)
print('MULTIVIEW_OK',len(shots))
