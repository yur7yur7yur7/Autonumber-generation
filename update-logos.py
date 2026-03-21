import os
import json
from datetime import datetime

# Пути
logos_dir = 'images/logos'
manifest_file = 'images/logos/manifest.json'

# Поддерживаемые форматы
valid_extensions = ('.svg', '.png', '.webp', '.jpg', '.jpeg', '.eps')

print('🔍 Сканирую папку с логотипами...')

try:
    # Получаем список файлов
    files = os.listdir(logos_dir)

    # Фильтруем только картинки
    logos = [f for f in files if f.lower().endswith(valid_extensions)]

    # Сортируем
    logos.sort()

    # Создаем манифест
    manifest = {
        'generated': datetime.now().isoformat(),
        'count': len(logos),
        'logos': logos
    }

    # Сохраняем
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'✅ Манифест создан!')
    print(f'📁 Найдено логотипов: {len(logos)}')

    if logos:
        print('\n📋 Список:')
        for logo in logos:
            print(f'   - {logo}')

except FileNotFoundError:
    print(f'❌ Папка {logos_dir} не найдена!')
except Exception as e:
    print(f'❌ Ошибка: {e}')