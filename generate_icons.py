import zlib, struct, math, os

def make_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw_data.extend([r, g, b, a])
            
    compressed = zlib.compress(raw_data, 9)
    
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0) # 8-bit RGBA
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    return png

def draw_icon(size):
    scale = size / 512.0
    
    bg = (250, 250, 249, 255) # #FAFAF9
    btn_outer = (45, 40, 200, 255) # #2D28C8
    btn_border = (29, 25, 160, 255) # #1D19A0
    btn_inner = (56, 50, 224, 255) # #3832E0
    btn_inner_border = (34, 28, 176, 255) # #221CB0
    hole_color = (255, 255, 255, 255)
    stitch_color = (194, 110, 0, 255) # #C26E00

    def dist_to_segment(px, py, x1, y1, x2, y2):
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0 and dy == 0:
            return math.hypot(px - x1, py - y1)
        t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx*dx + dy*dy)))
        closest_x = x1 + t * dx
        closest_y = y1 + t * dy
        return math.hypot(px - closest_x, py - closest_y)

    def get_pixel(x, y):
        px = (x + 0.5) / scale
        py = (y + 0.5) / scale
        
        dc = math.hypot(px - 256, py - 256)
        r, g, b, a = bg
        
        if dc <= 220:
            if dc >= 210:
                r, g, b, a = btn_border
            else:
                r, g, b, a = btn_outer
                
            if dc <= 165:
                if dc >= 157:
                    r, g, b, a = btn_inner_border
                else:
                    r, g, b, a = btn_inner

            d_stitch1 = dist_to_segment(px, py, 196, 196, 316, 316)
            d_stitch2 = dist_to_segment(px, py, 316, 196, 196, 316)
            
            if min(d_stitch1, d_stitch2) <= 16:
                r, g, b, a = stitch_color

            holes = [(196, 196), (316, 196), (196, 316), (316, 316)]
            for hx, hy in holes:
                dh = math.hypot(px - hx, py - hy)
                if dh <= 24:
                    if dh >= 20:
                        r, g, b, a = (220, 220, 220, 255)
                    else:
                        r, g, b, a = hole_color

        return (r, g, b, a)

    return make_png(size, size, get_pixel)

os.makedirs('public', exist_ok=True)
print("Generating 512x512...")
with open('public/icon-512.png', 'wb') as f:
    f.write(draw_icon(512))

print("Generating 192x192...")
with open('public/icon-192.png', 'wb') as f:
    f.write(draw_icon(192))

print("Generating 180x180 apple-touch-icon...")
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(draw_icon(180))

print("Done!")
