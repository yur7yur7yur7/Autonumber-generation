import os
import json
from datetime import datetime

# Пути
logos_dir = 'images/logos'
manifest_file = 'images/logos/manifest.json'

# Поддерживаемые форматы
valid_extensions = ('.svg', '.png', '.webp', '.jpg', '.jpeg')

# ============================================================
# ФУНКЦИИ ПАРСИНГА ИМЕНИ ФАЙЛА
# ============================================================

def parse_filename(filename):
    """
    Разбирает имя файла вида brand[_variant]_type[_color].ext
    Возвращает словарь с brand, type, category, label
    """
    # Убираем расширение
    name, ext = os.path.splitext(filename)

    # Ищем _badge или _text в имени (не обязательно в конце!)
    if '_badge' in name:
        logo_type = 'badge'
        category = 'badge'
        # Всё до _badge — это brand_variant, всё после — цвет/доп.вариант
        parts = name.split('_badge')
        brand_variant = parts[0]  # например "lada" или "dongfeng"
        suffix = parts[1] if len(parts) > 1 else ''  # например "_red", "_black", "_2"
    elif '_text' in name:
        logo_type = 'text'
        category = 'text'
        parts = name.split('_text')
        brand_variant = parts[0]
        suffix = parts[1] if len(parts) > 1 else ''
    else:
        logo_type = 'unknown'
        category = 'unknown'
        brand_variant = name
        suffix = ''

    # Убираем ведущее подчёркивание у suffix
    suffix = suffix.lstrip('_')

    # Определяем бренд
    parts = brand_variant.split('_')

    # Составные бренды
    if len(parts) >= 2:
        if parts[0] == 'rolls' and parts[1] == 'royce':
            brand = 'rolls_royce'
            variant_parts = parts[2:]
        elif parts[0] == 'land' and parts[1] == 'rover':
            brand = 'land_rover'
            variant_parts = parts[2:]
        elif parts[0] == 'great' and parts[1] == 'wall':
            brand = 'great_wall'
            variant_parts = parts[2:]
        elif parts[0] == 'volkswagen' and len(parts) > 1 and parts[1] == 'polo':
            brand = 'volkswagen'
            variant_parts = parts[1:]  # polo
        elif parts[0] == 'chevrolet' and len(parts) > 1 and parts[1] == 'niva':
            brand = 'chevrolet'
            variant_parts = parts[1:]  # niva
        elif parts[0] == 'lada' and len(parts) > 1 and parts[1] in ('granta', 'priora', 'vesta', 'kalina'):
            brand = 'lada'
            variant_parts = parts[1:]  # granta, priora и т.д.
        else:
            brand = parts[0]
            variant_parts = parts[1:]
    else:
        brand = parts[0]
        variant_parts = []

    # Добавляем suffix как дополнительный вариант
    if suffix:
        variant_parts.append(suffix)

    # Человекочитаемый label
    brand_display = brand.upper() if brand.upper() in (
        'BMW', 'GMC', 'BYD', 'GAC', 'FAW', 'JAC', 'UAZ', 'GAZ', 'VAZ', 'MG'
    ) else brand.capitalize().replace('_', ' ')

    variant_desc = ' '.join(variant_parts).replace('_', ' ')

    if logo_type == 'badge':
        label = f"{brand_display} (значок)"
        if variant_desc:
            label = f"{brand_display} ({variant_desc})"
    elif logo_type == 'text':
        label = f"{brand_display} (значок + надпись)"
        if variant_desc:
            label = f"{brand_display} {variant_desc}"
    else:
        label = name.replace('_', ' ')

    return {
        'brand': brand,
        'type': logo_type,
        'category': category,
        'file': filename,
        'label': label
    }
    """
    Разбирает имя файла вида brand[_variant]_type.ext
    Возвращает словарь с brand, type, category, label
    """
    # Убираем расширение
    name, ext = os.path.splitext(filename)

    # Определяем тип по суффиксу
    if name.endswith('_badge'):
        logo_type = 'badge'
        category = 'badge'
        name_without_type = name[:-6]  # убираем '_badge'
    elif name.endswith('_text'):
        logo_type = 'text'
        category = 'text'
        name_without_type = name[:-5]  # убираем '_text'
    else:
        # Неизвестный формат — оставляем как есть
        logo_type = 'unknown'
        category = 'unknown'
        name_without_type = name

    # Определяем бренд и вариант
    parts = name_without_type.split('_')

    brand_map = {
        'rolls': 'rolls_royce',  # rolls_royce
        'land': 'land_rover',    # land_rover
        'great': 'great_wall',   # great_wall
        'volkswagen': 'volkswagen',
        'chevrolet': 'chevrolet',
        'lamborghini': 'lamborghini',
        'mitsubishi': 'mitsubishi',
    }

    # Если имя начинается с известного составного бренда
    if parts[0] in brand_map and len(parts) > 1 and parts[1] in ('rover', 'royce', 'wall'):
        brand = f"{parts[0]}_{parts[1]}"
        variant_parts = parts[2:]
    elif parts[0] in ('gazel',):
        brand = 'gazel'
        variant_parts = parts[1:]
    elif parts[0] in ('lada', 'gaz', 'uaz', 'moskvich', 'vaz'):
        brand = parts[0]
        variant_parts = parts[1:]
    else:
        brand = parts[0]
        variant_parts = parts[1:]

    # Человекочитаемый label
    brand_display = brand.upper() if brand.upper() in ('BMW', 'GMC', 'BYD', 'GAC', 'FAW', 'JAC', 'UAZ', 'GAZ', 'VAZ') else brand.capitalize()

    if logo_type == 'badge':
        if variant_parts:
            variant_desc = ' '.join(variant_parts).replace('_', ' ')
            label = f"{brand_display} ({variant_desc})"
        else:
            label = f"{brand_display} (значок)"
    elif logo_type == 'text':
        if variant_parts:
            variant_desc = ' '.join(variant_parts).replace('_', ' ')
            label = f"{brand_display} {variant_desc} (значок + надпись)"
        else:
            label = f"{brand_display} (значок + надпись)"
    else:
        label = name.replace('_', ' ')

    return {
        'brand': brand,
        'type': logo_type,
        'category': category,
        'file': filename,
        'label': label
    }


# ============================================================
# ОСНОВНОЙ КОД
# ============================================================

print('🔍 Сканирую папку с логотипами...')

try:
    # Получаем список файлов
    files = os.listdir(logos_dir)

    # Фильтруем только картинки (исключаем сам manifest.json)
    logos = []
    for f in files:
        if f.lower().endswith(valid_extensions) and f != 'manifest.json':
            logos.append(f)

    # Сортируем
    logos.sort()

    # Парсим каждый файл
    parsed_logos = [parse_filename(f) for f in logos]

    # Создаем манифест
    manifest = {
        'generated': datetime.now().isoformat(),
        'count': len(parsed_logos),
        'logos': parsed_logos
    }

    # Сохраняем
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'✅ Манифест создан!')
    print(f'📁 Найдено логотипов: {len(parsed_logos)}')

    # Статистика по типам
    badges = [l for l in parsed_logos if l['type'] == 'badge']
    texts = [l for l in parsed_logos if l['type'] == 'text']
    unknowns = [l for l in parsed_logos if l['type'] == 'unknown']

    print(f'   - Значков (badge):  {len(badges)}')
    print(f'   - С надписью (text): {len(texts)}')
    if unknowns:
        print(f'   - Неизвестных:       {len(unknowns)}')

    # Статистика по брендам
    brands = {}
    for logo in parsed_logos:
        brand = logo['brand']
        brands[brand] = brands.get(brand, 0) + 1
    print(f'   - Уникальных брендов: {len(brands)}')

    if unknown_logos := unknowns:
        print('\n⚠️  Файлы с неизвестным форматом:')
        for logo in unknown_logos:
            print(f'   - {logo["file"]}')

except FileNotFoundError:
    print(f'❌ Папка {logos_dir} не найдена!')
except Exception as e:
    print(f'❌ Ошибка: {e}')