from PIL import Image, ImageDraw

BG = (216, 90, 48, 255)       # coral 400 #D85A30
COLORS = [
    (240, 153, 123, 255),  # low - coral 200
    (250, 238, 218, 255),  # mid - cream
    (192, 221, 151, 255),  # high - green 100
    (151, 196, 89, 255),   # high - green 200
]

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # rounded square background (full bleed, safe for maskable)
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    # 3x3 grid of "contribution graph" squares within safe zone (~60% of icon)
    grid = 3
    safe = size * 0.62
    margin = (size - safe) / 2
    gap = safe * 0.12
    cell = (safe - gap * (grid - 1)) / grid
    cell_radius = int(cell * 0.22)

    pattern = [
        1, 2, 0,
        2, 3, 1,
        0, 1, 3,
    ]

    for row in range(grid):
        for col in range(grid):
            x0 = margin + col * (cell + gap)
            y0 = margin + row * (cell + gap)
            x1 = x0 + cell
            y1 = y0 + cell
            color = COLORS[pattern[row * grid + col]]
            draw.rounded_rectangle([x0, y0, x1, y1], radius=cell_radius, fill=color)

    img.save(path, "PNG")

make_icon(192, "icon-192.png")
make_icon(512, "icon-512.png")
print("done")
