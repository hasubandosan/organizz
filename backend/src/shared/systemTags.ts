/**
 * Системные (встроенные) теги и зоны LifeOS. Одинаковы у всех пользователей, только для чтения.
 * Править этот файл может только владелец проекта/архитектор (через PR).
 *
 * id ВЕЧНЫЕ: записи модулей хранят их в tagIds/zoneIds. Менять можно name/group/scope/sort,
 * но НЕ id. Удалять тег из списка нельзя — только помечать hidden: true (иначе у людей
 * в записях останутся «висячие» ссылки).
 *
 * scope: ['all'] — виден во всех модулях, или список слагов модулей
 *        ('projects' | 'purchases' | 'cosplays' | 'meals' ...).
 * kind: 'tag' — тег, 'zone' — зона (крупная сфера жизни).
 */
export type SystemTag = {
  id: string; name: string; kind: 'tag' | 'zone'; group: string;
  scope: string[]; sort: number; hidden?: boolean;
};

type Row = [id: string, name: string];

function build(kind: 'tag' | 'zone', group: string, scope: string[], rows: Row[]): SystemTag[] {
  return rows.map(([id, name], i) => ({ id: `sys:${id}`, name, kind, group, scope, sort: i }));
}

export const SYSTEM_TAGS: SystemTag[] = [
  // ───────── ЗОНЫ (сферы жизни) ─────────
  ...build('zone', 'Сферы жизни', ['all'], [
    ['z-home', 'Дом и быт'],
    ['z-health', 'Здоровье'],
    ['z-food', 'Питание'],
    ['z-work', 'Работа'],
    ['z-study', 'Учёба и развитие'],
    ['z-finance', 'Финансы'],
    ['z-family', 'Семья и близкие'],
    ['z-hobby', 'Хобби'],
    ['z-cosplay', 'Косплей'],
    ['z-diy', 'DIY и мастерская'],
    ['z-travel', 'Путешествия'],
    ['z-self', 'Уход за собой'],
  ]),

  // ───────── ТЕГИ: общие для всех модулей ─────────
  ...build('tag', 'Срочность', ['all'], [
    ['urgent', 'Срочно'], ['important', 'Важно'], ['wait', 'Ждать'], ['delegate', 'Делегировать'],
    ['someday', 'Когда-нибудь'],
  ]),
  ...build('tag', 'Цвет', ['all'], [
    ['c-black', 'Чёрный'], ['c-white', 'Белый'], ['c-blonde', 'Блонд'], ['c-brown', 'Коричневый'],
    ['c-red', 'Красный'], ['c-pink', 'Розовый'], ['c-blue', 'Синий'], ['c-green', 'Зелёный'],
    ['c-purple', 'Фиолетовый'], ['c-yellow', 'Жёлтый'], ['c-orange', 'Оранжевый'],
    ['c-gold', 'Золотой'], ['c-silver', 'Серебряный'], ['c-gray', 'Серый'],
  ]),
  ...build('tag', 'Материал', ['all'], [
    ['m-fabric', 'Ткань'], ['m-leather', 'Кожа / кожзам'], ['m-plastic', 'Пластик'], ['m-eva', 'EVA-пена'],
    ['m-metal', 'Металл'], ['m-wood', 'Дерево'], ['m-glass', 'Стекло'], ['m-paper', 'Бумага / картон'],
    ['m-3dprint', '3D-печать'],
  ]),

  // ───────── КОСПЛЕЙ (и покупки для косплея) ─────────
  ...build('tag', 'Элемент образа', ['cosplays', 'purchases'], [
    ['cp-wig', 'Прическа / парик'], ['cp-dress', 'Платье / костюм'], ['cp-artifact', 'Артефакт / реквизит'],
    ['cp-makeup', 'Грим / макияж'], ['cp-shoes', 'Обувь'], ['cp-accessory', 'Аксессуар / украшение'],
    ['cp-armor', 'Броня / детали'], ['cp-lenses', 'Линзы'], ['cp-weapon', 'Оружие / бутафория'],
    ['cp-wings', 'Крылья / аппликации'], ['cp-underwear', 'Бельё / база'], ['cp-bag', 'Сумка / пояс'],
  ]),
  ...build('tag', 'Причёска', ['cosplays', 'purchases'], [
    ['hr-bob', 'Каре'], ['hr-long', 'Длинные'], ['hr-short', 'Короткие'], ['hr-ponytail', 'Хвост'],
    ['hr-twintails', 'Два хвоста'], ['hr-braid', 'Коса'], ['hr-curly', 'Кудри'], ['hr-straight', 'Прямые'],
    ['hr-bangs', 'Чёлка'],
  ]),
  ...build('tag', 'Способ получения', ['cosplays', 'purchases'], [
    ['src-buy', 'Купить'], ['src-have', 'Есть в наличии'], ['src-make', 'Сделать самой / DIY'],
    ['src-order', 'Заказать пошив'], ['src-rent', 'Взять напрокат'], ['src-thrift', 'Секонд / б/у'],
  ]),

  // ───────── ПОКУПКИ ─────────
  ...build('tag', 'Тип покупки', ['purchases'], [
    ['pu-clothes', 'Одежда'], ['pu-shoes', 'Обувь'], ['pu-home', 'Для дома'], ['pu-electronics', 'Техника'],
    ['pu-cosmetics', 'Косметика / уход'], ['pu-gift', 'Подарок'], ['pu-books', 'Книги'],
    ['pu-hobby', 'Хобби'], ['pu-tools', 'Инструменты'], ['pu-materials', 'Материалы'],
    ['pu-health', 'Здоровье / аптека'], ['pu-pets', 'Питомцы'], ['pu-groceries', 'Продукты'],
  ]),
  ...build('tag', 'Приоритет покупки', ['purchases'], [
    ['pp-need', 'Нужно'], ['pp-want', 'Хочется'], ['pp-sale', 'Ждать скидку'], ['pp-compare', 'Сравнить варианты'],
  ]),

  // ───────── РЕЦЕПТЫ / ПИТАНИЕ ─────────
  ...build('tag', 'Приём пищи', ['meals'], [
    ['ml-breakfast', 'Завтрак'], ['ml-lunch', 'Обед'], ['ml-dinner', 'Ужин'], ['ml-snack', 'Перекус'],
    ['ml-dessert', 'Десерт'], ['ml-drink', 'Напиток'],
  ]),
  ...build('tag', 'Основа блюда', ['meals'], [
    ['bs-meat', 'Мясо'], ['bs-poultry', 'Птица'], ['bs-fish', 'Рыба и морепродукты'], ['bs-veg', 'Овощи'],
    ['bs-grain', 'Крупы и гарниры'], ['bs-pasta', 'Паста'], ['bs-soup', 'Супы'], ['bs-salad', 'Салаты'],
    ['bs-bake', 'Выпечка'], ['bs-eggs', 'Яйца'], ['bs-dairy', 'Молочное'], ['bs-sauce', 'Соусы и заправки'],
  ]),
  ...build('tag', 'Кухня', ['meals'], [
    ['cu-russian', 'Русская'], ['cu-italian', 'Итальянская'], ['cu-asian', 'Азиатская'], ['cu-japanese', 'Японская'],
    ['cu-georgian', 'Грузинская'], ['cu-mexican', 'Мексиканская'], ['cu-mediterranean', 'Средиземноморская'],
    ['cu-french', 'Французская'],
  ]),
  ...build('tag', 'Диета', ['meals'], [
    ['dt-vegan', 'Веган'], ['dt-vegetarian', 'Вегетарианское'], ['dt-gluten', 'Без глютена'],
    ['dt-lactose', 'Без лактозы'], ['dt-keto', 'Кето'], ['dt-lowcarb', 'Низкоуглеводное'],
    ['dt-highprotein', 'Много белка'], ['dt-light', 'Лёгкое'],
  ]),
  ...build('tag', 'Время и формат', ['meals'], [
    ['tm-quick', 'Быстро (до 30 мин)'], ['tm-long', 'Долго готовится'], ['tm-prep', 'Заготовка / meal prep'],
    ['tm-oven', 'Духовка'], ['tm-pan', 'Сковорода'], ['tm-multicooker', 'Мультиварка'], ['tm-airfryer', 'Аэрогриль'],
    ['tm-nocook', 'Без готовки'],
  ]),

  // ───────── ПРОЕКТЫ ─────────
  ...build('tag', 'Тип задачи', ['projects'], [
    ['pj-repair', 'Ремонт'], ['pj-dev', 'Разработка'], ['pj-cleaning', 'Уборка'], ['pj-paperwork', 'Документы'],
    ['pj-call', 'Позвонить'], ['pj-errand', 'Поручение'], ['pj-learn', 'Учёба'], ['pj-creative', 'Творчество'],
  ]),
];
