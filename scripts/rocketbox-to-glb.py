# Usage: Blender -b --python scripts/rocketbox-to-glb.py -- <Avatar>_facial.fbx <out>.glb
# (the FBX's Textures/ folder must sit next to it, as in the Rocketbox repo)
# Converts a Microsoft Rocketbox "_facial" FBX into a web-ready GLB for the examiner:
# standard (Mixamo-style) bone names, ARKit + Oculus viseme shape-key names,
# PBR materials (roughness derived from Rocketbox's specular maps), WebP textures.
import bpy, sys, re
import numpy as np

src, dst = sys.argv[-2], sys.argv[-1]
import os
OUT_DIR = os.path.dirname(dst)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

# ---- bones -> Mixamo-style names (what the web code and most tools expect)
FINGERS = {"0": "Thumb", "1": "Index", "2": "Middle", "3": "Ring", "4": "Pinky"}
def bone_name(n):
    m = {"Bip01 Pelvis": "Hips", "Bip01 Spine": "Spine", "Bip01 Spine1": "Spine1", "Bip01 Spine2": "Spine2",
         "Bip01 Neck": "Neck", "Bip01 Head": "Head", "Bip01 LEye": "LeftEye", "Bip01 REye": "RightEye", "Bip01 MJaw": "Jaw"}
    if n in m: return m[n]
    r = re.match(r"Bip01 ([LR]) (.+)", n)
    if not r: return None
    side = "Left" if r.group(1) == "L" else "Right"
    part = r.group(2)
    simple = {"Clavicle": "Shoulder", "UpperArm": "Arm", "Forearm": "ForeArm", "Hand": "Hand",
              "Thigh": "UpLeg", "Calf": "Leg", "Foot": "Foot", "Toe0": "ToeBase"}
    if part in simple: return side + simple[part]
    f = re.match(r"Finger(\d)(\d?)", part)
    if f: return f"{side}Hand{FINGERS[f.group(1)]}{int(f.group(2) or 0) + 1}"
    return None

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
arm.name = "Armature"
for b in arm.data.bones:
    new = bone_name(b.name)
    if new: b.name = new  # vertex groups follow the rename

# ---- shape keys -> ARKit / Oculus viseme names
VIS = ["sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR", "aa", "E", "I", "O", "U"]
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
mesh.name = "Examiner"
renamed = 0
for k in mesh.data.shape_keys.key_blocks:
    v = re.match(r"AA_VI_(\d\d)_", k.name)
    a = re.match(r"AK_\d\d_(\w+)", k.name)
    if v: k.name = "viseme_" + VIS[int(v.group(1))]; renamed += 1
    elif a: k.name = a.group(1)[0].lower() + a.group(1)[1:]; renamed += 1
# Drop the remaining (Rocketbox-specific) keys: they add weight but nothing uses them.
mesh.active_shape_key_index = 0
for k in list(mesh.data.shape_keys.key_blocks)[1:]:
    if not (k.name.startswith("viseme_") or re.match(r"^[a-z][A-Za-z]+$", k.name)):
        mesh.shape_key_remove(k)
print("SHAPEKEYS kept", len(mesh.data.shape_keys.key_blocks) - 1, "renamed", renamed)

# ---- materials
def img(path):
    return bpy.data.images.load(path, check_existing=True)

def roughness_from_specular(spec_img, name, lo, hi):
    # Rocketbox specular maps: bright = shiny. Roughness = inverse, clamped to a plausible range.
    w, h = spec_img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    spec_img.pixels.foreach_get(px)
    s = px.reshape(-1, 4)[:, 0]
    r = np.clip(hi - s * (hi - lo), lo, hi)
    tmp = bpy.data.images.new(name + "_tmp", w, h, alpha=False)
    o = np.ones((w * h, 4), dtype=np.float32)
    o[:, 0] = o[:, 1] = o[:, 2] = r
    tmp.pixels.foreach_set(o.ravel())
    tmp.update()
    # Generated images aren't reliably picked up by the glTF exporter - write a real file.
    path = f"{OUT_DIR}/{name}.png"
    tmp.filepath_raw = path
    tmp.file_format = "PNG"
    tmp.save()
    out = bpy.data.images.load(path)
    out.colorspace_settings.name = "Non-Color"
    print("ROUGHNESS", name, "mean", float(r.mean()))
    return out

for mat in mesh.data.materials:
    texdir = None
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            texdir = bpy.path.abspath(n.image.filepath).rsplit("/", 1)[0]
    stem = mat.name  # e.g. m008_head
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = 0.0
    if stem.endswith("_opacity"):
        # Hair cards + eyelashes: colour with alpha cut-out.
        col = nt.nodes.new("ShaderNodeTexImage"); col.image = img(f"{texdir}/{stem}_color.tga")
        nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(col.outputs["Alpha"], bsdf.inputs["Alpha"])
        bsdf.inputs["Roughness"].default_value = 0.6
        mat.blend_method = "CLIP"
        mat.name = "hair_opacity"
        continue
    col = nt.nodes.new("ShaderNodeTexImage"); col.image = img(f"{texdir}/{stem}_color.tga")
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nrm = nt.nodes.new("ShaderNodeTexImage"); nrm.image = img(f"{texdir}/{stem}_normal.tga")
    nrm.image.colorspace_settings.name = "Non-Color"
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    spec = img(f"{texdir}/{stem}_specular.tga")
    is_head = stem.endswith("_head")
    rough = nt.nodes.new("ShaderNodeTexImage")
    rough.image = roughness_from_specular(spec, stem + "_roughness", 0.42 if is_head else 0.55, 0.78 if is_head else 0.95)
    nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    mat.blend_method = "OPAQUE"
    mat.name = "skin_head" if is_head else "suit_body"

print("MATERIALS", [m.name for m in mesh.data.materials])
print("BONES", [b.name for b in arm.data.bones][:12], "...")

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_image_format="WEBP",
    export_image_quality=88,
    export_morph=True,
    export_morph_normal=False,
    export_skins=True,
    export_animations=False,
    export_yup=True,
)
print("EXPORTED", dst)
