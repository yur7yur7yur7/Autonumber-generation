#!/usr/bin/env python3
"""
Генератор манифеста шрифтов fonts/backpanel/manifest.json.

Сканирует папку fonts/backpanel/, для каждого файла-шрифта (.ttf/.otf/.woff/.woff2)
формирует запись с display name, font-family и путём относительно fonts/backpanel/.

Конвенция display name (по убыванию приоритета):
  1. Явный override в KNOWN_OVERRIDES (например, spritegraffiti → "Sprite Graffiti").
  2. Имя родительской подпапки, если файл лежит в <X>/<file> (но НЕ в служебной fonts/).
  3. Первое слово basename + опционально второе (если не «длинный суффикс»).
     CamelCase: NotoSerif → "Noto Serif". Плоское имя с пробелами: "Bad Script".
     Длинные/служебные суффиксы (Regular, Bold, Italic, Light, SC, RG, …) отбрасываются.

Запуск:
    python update-fonts.py

Используется в CI / локально после добавления нового файла шрифта в fonts/backpanel/.
"""

import json
import os
import re
from datetime import datetime

FONTS_DIR = 'fonts/backpanel'
MANIFEST_FILE = os.path.join(FONTS_DIR, 'manifest.json')

VALID_EXTENSIONS = ('.woff2', '.woff', '.ttf', '.otf')

# format() в @font-face для каждого расширения.
FORMAT_BY_EXT = {
    '.woff2': 'woff2',
    '.woff': 'woff',
    '.ttf': 'truetype',
    '.otf': 'opentype',
}

# Служебные суффиксы (variantы), которые НЕ идут в display name вторым словом.
# Bold/Italic/... — реальные варианты, идут в display (см. extract_variant).
# Normal/Version/_NN — мусор из имён файлов, отбрасываем.
DROP_SUFFIXES = {
    'Normal', 'Version', 'normal', 'version',
    '01', '02', '03', '04', '05',
}

# Служебные имена подпапок, которые НЕ считаются «брендом шрифта» (например,
# fonts/ для иконочных шрифтов или iconfonts/).
SERVICE_DIRS = {'fonts', 'iconfonts', 'icons'}

# Явные переопределения display name. Ключ — basename файла без расширения
# (lowercased). Используйте, если автоправило не даёт нужное имя.
KNOWN_OVERRIDES = {
    'spritegraffiti': 'Sprite Graffiti',
}


def split_camel_case(name):
    """
    Разбивает CamelCase / PascalCase / under_score на пробелы:
      NotoSerif → Noto Serif
      PrincetownD → Princetown D
      PTSans → PT Sans
      normal_version_02 → normal version 02
    """
    name = name.replace('_', ' ').replace('-', ' ')
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    # Сокращения из 2+ заглавных перед словом: PTSans, IBMBold, IBMPC → PT Sans, IBM Bold.
    name = re.sub(r'\b([A-Z]{2,})([A-Z][a-z])', r'\1 \2', name)
    return name


def compute_display_name(rel_path, basename_no_ext):
    """
    Возвращает display name для шрифта.
      rel_path         — путь относительно FONTS_DIR (например, "Bravo/BravoRG.otf").
      basename_no_ext  — basename без расширения (например, "BravoRG" или "Bad Script").
    """
    if basename_no_ext.lower() in KNOWN_OVERRIDES:
        return KNOWN_OVERRIDES[basename_no_ext.lower()]

    parts = rel_path.split('/')
    if len(parts) == 2 and parts[0] not in SERVICE_DIRS:
        # Файл в подпапке. База display name — имя подпапки. Если basename
        # содержит вариант (Bold/Italic/Light/SC/...), добавляем его,
        # иначе в панели все Regular/Bold/Italic одного семейства
        # сольются в один пункт.
        folder = parts[0]
        variant = extract_variant(basename_no_ext, folder)
        if variant:
            spaced_tokens = split_camel_case(variant).split()
            kept = [t for t in spaced_tokens if t not in DROP_SUFFIXES]
            if kept:
                return f'{folder} {" ".join(kept)}'
        return folder

    spaced = split_camel_case(basename_no_ext)
    tokens = spaced.split()
    if not tokens:
        return basename_no_ext

    kept = [tokens[0]]
    for t in tokens[1:]:
        if len(t) == 1 or t in DROP_SUFFIXES or len(t) > 7:
            break
        kept.append(t)
        if len(kept) >= 2:
            break
    return ' '.join(kept)


def extract_variant(basename_no_ext, folder):
    """Возвращает суффикс варианта из basename, если basename начинается с folder.

      Marta_Bold + Marta   → "Bold"
      LeoHand-Light + LeoHand → "Light"
      BravoRG + Bravo → "RG"
      LeoHand + LeoHand → ""  (без варианта)
    """
    if not basename_no_ext.startswith(folder):
        return ''
    rest = basename_no_ext[len(folder):]
    # Разделитель: '_', '-' или переход lower→upper (BravoRG → RG).
    if rest and rest[0] in ('_', '-'):
        rest = rest[1:]
    return rest


def make_record(rel_path):
    # Нормализуем разделители: на Windows os.path.relpath вернёт путь
    # с обратными слэшами, а наша логика display name и src поле ожидают '/'.
    rel_path = rel_path.replace('\\', '/')
    basename = os.path.basename(rel_path)
    basename_no_ext, ext = os.path.splitext(basename)
    ext_lower = ext.lower()
    if ext_lower not in FORMAT_BY_EXT:
        return None

    name = compute_display_name(rel_path, basename_no_ext)
    family = f'Panel {name}'

    # src хранится bare-relative к fonts/backpanel/, чтобы конфиги на проде
    # были host-agnostic (как у логотипов). Поле file — basename, для обратной
    # совместимости со старым кодом.
    return {
        'name': name,
        'family': family,
        'format': FORMAT_BY_EXT[ext_lower],
        'file': basename,
        'src': rel_path,
    }


# Приоритет формата: woff2 > woff > ttf > otf. Один шрифт может лежать в
# нескольких форматах (например, spritegraffiti.ttf + .woff2 в одной папке
# или spritegraffiti/fonts/...). Браузеры сейчас лучше всего поддерживают
# woff2, поэтому для UI панели оставляем его, если есть; иначе —
# первый доступный по приоритету.
FORMAT_PRIORITY = {'woff2': 0, 'woff': 1, 'truetype': 2, 'opentype': 3}


def dedupe_by_family(fonts):
    """Схлопывает только дубликаты одного и того же шрифта в разных форматах.

    Дубликатом считаются записи с одинаковыми family И basename без
    расширения (например, spritegraffiti.ttf и spritegraffiti.woff2 —
    это один шрифт в разных форматах; в панели нужен один пункт, а
    @font-face зарегистрирует лучший формат). Разные варианты одного
    семейства (Marta_Regular.otf и Marta_Bold.otf — Regular vs Bold)
    имеют разные basename_no_ext и НЕ схлопываются.
    """
    groups = {}
    for f in fonts:
        basename_no_ext = os.path.splitext(f['file'])[0]
        key = (f['family'], basename_no_ext)
        groups.setdefault(key, []).append(f)
    result = []
    for items in groups.values():
        items.sort(key=lambda r: FORMAT_PRIORITY.get(r['format'], 99))
        result.append(items[0])
    return result


def main():
    if not os.path.isdir(FONTS_DIR):
        print(f'❌ Папка {FONTS_DIR} не найдена!')
        return 1

    fonts = []
    for root, _, files in os.walk(FONTS_DIR):
        for f in files:
            if f.lower() == 'manifest.json':
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext not in VALID_EXTENSIONS:
                continue
            abs_path = os.path.join(root, f)
            rel_path = os.path.relpath(abs_path, FONTS_DIR)
            rec = make_record(rel_path)
            if rec:
                fonts.append(rec)

    fonts = dedupe_by_family(fonts)
    fonts.sort(key=lambda r: (r['name'].lower(), r['src']))

    manifest = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'count': len(fonts),
        'fonts': fonts,
    }

    with open(MANIFEST_FILE, 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
        fp.write('\n')

    print(f'✅ Манифест создан: {MANIFEST_FILE}')
    print(f'📁 Уникальных шрифтов в панели: {len(fonts)}')
    by_format = {}
    for f in fonts:
        by_format[f['format']] = by_format.get(f['format'], 0) + 1
    for fmt, n in sorted(by_format.items()):
        print(f'   - {fmt}: {n}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
