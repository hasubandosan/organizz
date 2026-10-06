/**
 * Системные (встроенные) категории и теги LifeOS. Одинаковы у всех пользователей, только для чтения.
 * Править этот файл может только владелец проекта/архитектор (через PR).
 *
 * id ВЕЧНЫЕ: записи модулей хранят их в tagIds. Менять можно name/group/scope/sort,
 * но НЕ id. Удалять тег из списка нельзя — только помечать hidden: true (иначе у людей
 * в записях останутся «висячие» ссылки).
 *
 * scope: ['all'] — виден во всех модулях, или список слагов модулей
 *        ('projects' | 'purchases' | 'cosplays' | 'meals' ...).
 * kind: 'category' — категория (ЧТО это: тип покупки, элемент образа, приём пищи...),
 *       'tag' — обычный тег (признак: цвет, материал, срочность...).
 * Зон в каталоге нет: зоны каждый пользователь делает под себя, внутри модуля.
 * Физически и то и другое — теги (хранятся в tagIds), различие только в kind.
 */
export type SystemTag = {
  id: string; name: string; kind: 'tag' | 'category'; group: string;
  scope: string[]; sort: number; hidden?: boolean;
  icon?: string;   // эмодзи-иконка (сейчас у фандомов)
};

type Row = [id: string, name: string];

function build(kind: 'tag' | 'category', group: string, scope: string[], rows: Row[]): SystemTag[] {
  return rows.map(([id, name], i) => ({ id: `sys:${id}`, name, kind, group, scope, sort: i }));
}

// Фандомы косплея: scope ['fandoms'] — виден только в выборе фандома (в обычные выпадашки тегов не попадает).
// id вечные (`sys:fd-...`); новые фандомы добавлять в конец, существующие не удалять — только hidden.
type FRow = [id: string, name: string, icon: string];
function buildFandoms(rows: FRow[]): SystemTag[] {
  return rows.map(([id, name, icon], i) => ({ id: `sys:fd-${id}`, name, kind: 'category' as const, group: 'Фандомы', scope: ['fandoms'], sort: i, icon }));
}

export const SYSTEM_TAGS: SystemTag[] = [
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
  ...build('category', 'Элемент образа', ['cosplays', 'purchases'], [
    ['cp-wig', 'Прическа / парик'], ['cp-dress', 'Платье / костюм'], ['cp-artifact', 'Артефакт / реквизит'],
    ['cp-makeup', 'Грим / макияж'], ['cp-shoes', 'Обувь'], ['cp-accessory', 'Аксессуар / украшение'],
    ['cp-armor', 'Броня / детали'], ['cp-lenses', 'Линзы'], ['cp-weapon', 'Оружие / бутафория'],
    ['cp-wings', 'Крылья / аппликации'], ['cp-underwear', 'Бельё / база'], ['cp-bag', 'Сумка / пояс'],
  ]),
  ...build('category', 'Причёска', ['cosplays', 'purchases'], [
    ['hr-bob', 'Каре'], ['hr-long', 'Длинные'], ['hr-short', 'Короткие'], ['hr-ponytail', 'Хвост'],
    ['hr-twintails', 'Два хвоста'], ['hr-braid', 'Коса'], ['hr-curly', 'Кудри'], ['hr-straight', 'Прямые'],
    ['hr-bangs', 'Чёлка'],
  ]),
  ...build('tag', 'Способ получения', ['cosplays', 'purchases'], [
    ['src-buy', 'Купить'], ['src-have', 'Есть в наличии'], ['src-make', 'Сделать самой / DIY'],
    ['src-order', 'Заказать пошив'], ['src-rent', 'Взять напрокат'], ['src-thrift', 'Секонд / б/у'],
  ]),

  // ───────── ПОКУПКИ ─────────
  ...build('category', 'Тип покупки', ['purchases'], [
    ['pu-clothes', 'Одежда'], ['pu-shoes', 'Обувь'], ['pu-home', 'Для дома'], ['pu-electronics', 'Техника'],
    ['pu-cosmetics', 'Косметика / уход'], ['pu-gift', 'Подарок'], ['pu-books', 'Книги'],
    ['pu-hobby', 'Хобби'], ['pu-tools', 'Инструменты'], ['pu-materials', 'Материалы'],
    ['pu-health', 'Здоровье / аптека'], ['pu-pets', 'Питомцы'], ['pu-groceries', 'Продукты'],
  ]),
  ...build('tag', 'Приоритет покупки', ['purchases'], [
    ['pp-need', 'Нужно'], ['pp-want', 'Хочется'], ['pp-sale', 'Ждать скидку'], ['pp-compare', 'Сравнить варианты'],
  ]),

  // ───────── РЕЦЕПТЫ / ПИТАНИЕ ─────────
  ...build('category', 'Приём пищи', ['meals'], [
    ['ml-breakfast', 'Завтрак'], ['ml-lunch', 'Обед'], ['ml-dinner', 'Ужин'], ['ml-snack', 'Перекус'],
    ['ml-dessert', 'Десерт'], ['ml-drink', 'Напиток'],
  ]),
  ...build('category', 'Основа блюда', ['meals'], [
    ['bs-meat', 'Мясо'], ['bs-poultry', 'Птица'], ['bs-fish', 'Рыба и морепродукты'], ['bs-veg', 'Овощи'],
    ['bs-grain', 'Крупы и гарниры'], ['bs-pasta', 'Паста'], ['bs-soup', 'Супы'], ['bs-salad', 'Салаты'],
    ['bs-bake', 'Выпечка'], ['bs-eggs', 'Яйца'], ['bs-dairy', 'Молочное'], ['bs-sauce', 'Соусы и заправки'],
  ]),
  ...build('category', 'Кухня', ['meals'], [
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
  ...build('category', 'Тип задачи', ['projects'], [
    ['pj-repair', 'Ремонт'], ['pj-dev', 'Разработка'], ['pj-cleaning', 'Уборка'], ['pj-paperwork', 'Документы'],
    ['pj-call', 'Позвонить'], ['pj-errand', 'Поручение'], ['pj-learn', 'Учёба'], ['pj-creative', 'Творчество'],
  ]),

  // ───────── ФАНДОМЫ (косплей) ─────────
  ...buildFandoms([
    ['naruto', 'Naruto', '🍥'], ['brawl-stars', 'Brawl Stars', '💥'], ['dota', 'Dota', '🛡️'],
    ['genshin', 'Genshin Impact', '✨'], ['hsr', 'Honkai: Star Rail', '🚂'], ['zzz', 'Zenless Zone Zero', '📺'],
    ['lol', 'League of Legends', '🏆'], ['arcane', 'Arcane', '🔧'], ['valorant', 'Valorant', '🔫'], ['overwatch', 'Overwatch', '🎯'],
    ['minecraft', 'Minecraft', '⛏️'], ['undertale', 'Undertale', '❤️'], ['pokemon', 'Pokémon', '⚡'], ['zelda', 'The Legend of Zelda', '🗡️'],
    ['witcher', 'The Witcher', '🐺'], ['ff', 'Final Fantasy', '🔮'], ['persona', 'Persona', '🃏'], ['fate', 'Fate', '⚜️'],
    ['re', 'Resident Evil', '🧟'], ['cyberpunk', 'Cyberpunk', '🌃'],
    ['bleach', 'Bleach', '⚔️'], ['onepiece', 'One Piece', '🏴‍☠️'], ['dragonball', 'Dragon Ball', '🐉'], ['aot', 'Атака титанов', '🛡'],
    ['kimetsu', 'Клинок, рассекающий демонов', '🔥'], ['jjk', 'Магическая битва', '👁️'], ['mha', 'Моя геройская академия', '🦸'],
    ['fma', 'Стальной алхимик', '⚗️'], ['deathnote', 'Тетрадь смерти', '📓'], ['sailormoon', 'Сейлор Мун', '🌙'],
    ['winx', 'Клуб Винкс', '🧚'], ['csm', 'Человек-бензопила', '🪚'], ['spyfamily', 'Семья шпиона', '🕵️'],
    ['hxh', 'Hunter x Hunter', '🎣'], ['eva', 'Евангелион', '🤖'], ['vocaloid', 'Vocaloid', '🎤'],
    ['marvel', 'Marvel', '🦸‍♂️'], ['dc', 'DC', '🦇'], ['starwars', 'Звёздные войны', '🌌'], ['hp', 'Гарри Поттер', '🪄'],
    ['lotr', 'Властелин колец', '💍'], ['got', 'Игра престолов', '🐲'], ['disney', 'Disney', '🏰'], ['hazbin', 'Hazbin Hotel', '😈'],
    ['other', 'Другое', '🎭'],
  ]),
];
