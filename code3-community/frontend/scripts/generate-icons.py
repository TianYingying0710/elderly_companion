"""零依赖生成 tabBar 与信息行小图标（纯标准库：zlib + struct + math）。

用法：
    python scripts/generate-icons.py

为什么不用 Pillow：本项目环境禁止安装第三方包，所有图标用 4x 超采样 + 有符号距离场
画出来再降采样，输出 32 位带透明通道 PNG，足够 81x81 的 tabBar 尺寸使用。
"""

import math
import os
import struct
import zlib

SS = 4  # 超采样倍率
UNIT = 24.0  # 设计栅格：24 x 24

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "src")
TABBAR_DIR = os.path.join(SRC, "static", "tabbar")
ICON_DIR = os.path.join(SRC, "static", "icons")


def sd_round_rect(px, py, cx, cy, hw, hh, r):
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    ox = max(dx, 0.0)
    oy = max(dy, 0.0)
    return math.hypot(ox, oy) + min(max(dx, dy), 0.0) - r


def sd_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    length2 = vx * vx + vy * vy
    t = 0.0 if length2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / length2))
    return math.hypot(wx - vx * t, wy - vy * t)


class Canvas:
    """在 size x size 的像素画布上按 24 单位栅格作图。"""

    def __init__(self, size):
        self.size = size
        self.n = size * SS
        self.scale = self.n / UNIT
        self.alpha = bytearray(self.n * self.n)

    def _paint(self, field, half_stroke):
        n = self.n
        for y in range(n):
            row = y * n
            py = (y + 0.5) / self.scale
            for x in range(n):
                if field((x + 0.5) / self.scale, py) <= half_stroke:
                    self.alpha[row + x] = 255

    def line(self, ax, ay, bx, by, width=2.0):
        half = width / 2.0
        self._paint(lambda p, q: sd_segment(p, q, ax, ay, bx, by), half)

    def rect(self, cx, cy, hw, hh, width=2.0, radius=0.0):
        half = width / 2.0
        self._paint(lambda p, q: abs(sd_round_rect(p, q, cx, cy, hw, hh, radius)), half)

    def circle(self, cx, cy, r, width=2.0):
        half = width / 2.0
        self._paint(lambda p, q: abs(math.hypot(p - cx, q - cy) - r), half)

    def downsample(self):
        size = self.size
        out = bytearray(size * size)
        n = self.n
        area = SS * SS
        for y in range(size):
            for x in range(size):
                total = 0
                base_y = y * SS
                base_x = x * SS
                for sy in range(SS):
                    row = (base_y + sy) * n + base_x
                    for sx in range(SS):
                        total += self.alpha[row + sx]
                out[y * size + x] = total // area
        return out


def write_png(path, size, alpha, color):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            a = alpha[y * size + x]
            if a == 0:
                raw.extend((0, 0, 0, 0))
            else:
                raw.extend((color[0], color[1], color[2], a))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)


def icon_rescue(c):
    """救援处置：生命之星（竖线 + 两条斜线 + 上下横杠）。"""
    c.line(12, 3, 12, 21)
    c.line(4.2, 7.5, 19.8, 16.5)
    c.line(19.8, 7.5, 4.2, 16.5)
    c.line(8, 3, 16, 3)
    c.line(8, 21, 16, 21)


def icon_service(c):
    """社区服务：夹板 + 三条内容线。"""
    c.rect(12, 13, 7, 8, radius=2)
    c.line(9, 5, 9, 3)
    c.line(9, 3, 15, 3)
    c.line(15, 3, 15, 5)
    c.line(9, 10, 15, 10)
    c.line(9, 14, 15, 14)
    c.line(9, 18, 13, 18)


def icon_content(c):
    """内容发布：两张叠放的文档 + 内容线。"""
    c.rect(13, 11.5, 6, 7.5, radius=0.6)
    c.line(4, 7, 4, 21)
    c.line(4, 21, 16, 21)
    c.line(10, 8, 16, 8)
    c.line(10, 12, 16, 12)
    c.line(10, 16, 14, 16)


def icon_location(c):
    """地址：十字准星。"""
    c.circle(12, 12, 7.2)
    c.line(12, 2.4, 12, 5.4)
    c.line(12, 18.6, 12, 21.6)
    c.line(2.4, 12, 5.4, 12)
    c.line(18.6, 12, 21.6, 12)


def icon_clock(c):
    """时间：表盘 + 指针。"""
    c.circle(12, 12, 7.6)
    c.line(12, 12, 12, 7.2)
    c.line(12, 12, 15.4, 13.8)


TAB_ICONS = [
    ("rescue", icon_rescue),
    ("service", icon_service),
    ("content", icon_content),
]

INFO_ICONS = [
    ("location", icon_location),
    ("clock", icon_clock),
]

TAB_NORMAL = (0x74, 0x80, 0x97)
TAB_ACTIVE = (0x2E, 0x63, 0xC3)
INFO_COLOR = (0x8A, 0x94, 0xA5)


def main():
    os.makedirs(TABBAR_DIR, exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)

    written = []
    for name, painter in TAB_ICONS:
        for suffix, color in (("", TAB_NORMAL), ("-active", TAB_ACTIVE)):
            canvas = Canvas(81)
            painter(canvas)
            path = os.path.join(TABBAR_DIR, f"{name}{suffix}.png")
            write_png(path, 81, canvas.downsample(), color)
            written.append(path)

    for name, painter in INFO_ICONS:
        canvas = Canvas(48)
        painter(canvas)
        path = os.path.join(ICON_DIR, f"{name}.png")
        write_png(path, 48, canvas.downsample(), INFO_COLOR)
        written.append(path)

    for path in written:
        print(f"{os.path.relpath(path, SRC)}  {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
