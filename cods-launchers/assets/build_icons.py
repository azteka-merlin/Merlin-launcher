"""Extract MWII's PE icon and draw a temporary MWIII launcher icon.

Reads the game executable as a Windows resource file; it never runs the game.
"""

from __future__ import annotations

import ctypes
import struct
from ctypes import wintypes
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ASSETS = Path(__file__).resolve().parent
MWII_EXE = Path(
    r"D:\SteamLibrary\steamapps\common\Call of Duty Modern Warfare II\cod22-cod.exe"
)


def extract_pe_icon(source: Path, destination: Path) -> None:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
    kernel32.LoadLibraryExW.restype = wintypes.HMODULE
    kernel32.FreeLibrary.argtypes = [wintypes.HMODULE]
    kernel32.FreeLibrary.restype = wintypes.BOOL
    kernel32.EnumResourceNamesW.argtypes = [
        wintypes.HMODULE,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
    ]
    kernel32.EnumResourceNamesW.restype = wintypes.BOOL
    kernel32.FindResourceW.argtypes = [
        wintypes.HMODULE,
        ctypes.c_void_p,
        ctypes.c_void_p,
    ]
    kernel32.FindResourceW.restype = wintypes.HRSRC
    kernel32.SizeofResource.argtypes = [wintypes.HMODULE, wintypes.HRSRC]
    kernel32.SizeofResource.restype = wintypes.DWORD
    kernel32.LoadResource.argtypes = [wintypes.HMODULE, wintypes.HRSRC]
    kernel32.LoadResource.restype = wintypes.HGLOBAL
    kernel32.LockResource.argtypes = [wintypes.HGLOBAL]
    kernel32.LockResource.restype = ctypes.c_void_p

    # Resource only: do not execute or initialize any part of this PE file.
    handle = kernel32.LoadLibraryExW(str(source), None, 0x00000002 | 0x00000020)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())

    try:
        names: list[int] = []
        callback_type = ctypes.WINFUNCTYPE(
            wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p
        )

        def on_name(_module: int, _resource_type: int, name: int, _context: int) -> bool:
            names.append(name)
            return True

        callback = callback_type(on_name)
        if not kernel32.EnumResourceNamesW(handle, ctypes.c_void_p(14), callback, None):
            raise RuntimeError("Executable has no group icon resource")

        def get_resource(name: int, resource_type: int) -> bytes:
            resource = kernel32.FindResourceW(
                handle, ctypes.c_void_p(name), ctypes.c_void_p(resource_type)
            )
            if not resource:
                raise ctypes.WinError(ctypes.get_last_error())
            length = kernel32.SizeofResource(handle, resource)
            loaded = kernel32.LoadResource(handle, resource)
            pointer = kernel32.LockResource(loaded)
            if not pointer:
                raise ctypes.WinError(ctypes.get_last_error())
            return ctypes.string_at(pointer, length)

        groups = []
        for name in names:
            group = get_resource(name, 14)
            if len(group) < 6:
                continue
            reserved, kind, count = struct.unpack_from("<HHH", group)
            if reserved != 0 or kind != 1 or len(group) < 6 + 14 * count:
                continue
            groups.append((count, group))
        if not groups:
            raise RuntimeError("No valid icon group found")

        # The group with the most image sizes preserves Windows' native icon quality.
        _, group = max(groups, key=lambda item: item[0])
        count = struct.unpack_from("<H", group, 4)[0]
        images: list[tuple[tuple[int, int, int, int, int, int], bytes]] = []
        for index in range(count):
            w, h, colors, reserved, planes, bits, _length, resource_id = struct.unpack_from(
                "<BBBBHHIH", group, 6 + index * 14
            )
            raw = get_resource(resource_id, 3)
            images.append(((w, h, colors, reserved, planes, bits), raw))

        output = bytearray(struct.pack("<HHH", 0, 1, len(images)))
        offset = 6 + 16 * len(images)
        for entry, raw in images:
            output += struct.pack("<BBBBHHII", *entry, len(raw), offset)
            offset += len(raw)
        for _, raw in images:
            output += raw
        destination.write_bytes(output)
        print(f"MWII: {len(images)} native sizes, {len(output)} bytes")
    finally:
        kernel32.FreeLibrary(handle)


def draw_mwiii_placeholder(destination: Path) -> None:
    size = 256
    image = Image.new("RGBA", (size, size), (13, 16, 20, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((9, 9, 246, 246), radius=36, outline=(75, 84, 92, 255), width=6)
    draw.rounded_rectangle((19, 19, 236, 236), radius=29, fill=(25, 30, 35, 255))
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 89)
    except OSError:
        font = ImageFont.load_default()
    draw.text((31, 57), "MW", font=font, fill=(236, 239, 242, 255), stroke_width=1)
    for x in (60, 113, 166):
        draw.rounded_rectangle((x, 158, x + 30, 216), radius=5, fill=(212, 51, 54, 255))
    image.save(destination, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"MWIII placeholder: {destination.stat().st_size} bytes")


if __name__ == "__main__":
    extract_pe_icon(MWII_EXE, ASSETS / "mwii.ico")
    draw_mwiii_placeholder(ASSETS / "mwiii-placeholder.ico")
