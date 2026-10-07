/* Каталог фандомов LifeOS — общий для всех пользователей, только чтение.
   Подключается на страницах как <script src="https://organizz-core.pages.dev/fandoms.js"></script>
   и кладёт список в window.LIFEOS_FANDOMS.

   id — вечные (в записях персонажей хранится 'sys:<id>'): можно менять name/emoji/aliases/group, но НЕ id.
   Свои фандомы пользователь добавляет сам (только название + эмодзи, без картинки).

   ЛОГОТИПЫ: чтобы показать картинку вместо эмодзи, положите файл в frontend/core/fandoms/<id>.png
   (квадрат, ~128×128, PNG с прозрачностью) и добавьте строку в LOGOS ниже, например:
       LOGOS.naruto = 'fandoms/naruto.png';
   Пока логотипа нет — показывается эмодзи. Логотипы — чужие товарные знаки: используйте те,
   на которые у вас есть право, или собственные иллюстрации. */
(function () {
  var G = { A: 'Аниме и манга', G: 'Игры', M: 'Кино и сериалы', C: 'Мультфильмы', B: 'Книги и комиксы', O: 'Другое' };
  var LOGOS = {};
  var rows = [
    // id, название, эмодзи, группа, [другие названия для поиска]
    ['naruto', 'Наруто', '🍥', 'A', ['Naruto']],
    ['onepiece', 'Ван-Пис', '🏴‍☠️', 'A', ['One Piece']],
    ['bleach', 'Блич', '⚔️', 'A', ['Bleach']],
    ['demonslayer', 'Клинок, рассекающий демонов', '🗡️', 'A', ['Demon Slayer', 'Kimetsu no Yaiba']],
    ['aot', 'Атака титанов', '🛡️', 'A', ['Attack on Titan', 'Shingeki no Kyojin']],
    ['jjk', 'Магическая битва', '👁️', 'A', ['Jujutsu Kaisen']],
    ['mha', 'Моя геройская академия', '💥', 'A', ['My Hero Academia', 'Boku no Hero']],
    ['sailormoon', 'Сейлор Мун', '🌙', 'A', ['Sailor Moon']],
    ['dragonball', 'Драконий жемчуг', '🐉', 'A', ['Dragon Ball']],
    ['hxh', 'Охотник × Охотник', '🎣', 'A', ['Hunter x Hunter']],
    ['fma', 'Стальной алхимик', '⚗️', 'A', ['Fullmetal Alchemist']],
    ['deathnote', 'Тетрадь смерти', '📓', 'A', ['Death Note']],
    ['eva', 'Евангелион', '🤖', 'A', ['Evangelion', 'Neon Genesis Evangelion']],
    ['tokyoghoul', 'Токийский гуль', '👹', 'A', ['Tokyo Ghoul']],
    ['chainsawman', 'Человек-бензопила', '🪚', 'A', ['Chainsaw Man']],
    ['spyfamily', 'Семья шпиона', '🕵️', 'A', ['Spy x Family']],
    ['konosuba', 'Коносуба', '💧', 'A', ['KonoSuba']],
    ['rezero', 'Re:Zero', '⏳', 'A', ['Ре:Зеро', 'Re Zero']],
    ['sao', 'Мастера меча онлайн', '⚔️', 'A', ['Sword Art Online', 'SAO']],
    ['haikyuu', 'Волейбол!!', '🏐', 'A', ['Haikyuu']],
    ['blackbutler', 'Тёмный дворецкий', '🎩', 'A', ['Black Butler', 'Kuroshitsuji']],
    ['cardcaptor', 'Сакура — собирательница карт', '🌸', 'A', ['Cardcaptor Sakura']],
    ['madoka', 'Мадока Магика', '✨', 'A', ['Madoka Magica']],
    ['vocaloid', 'Вокалоиды', '🎤', 'A', ['Vocaloid', 'Hatsune Miku', 'Мику']],
    ['touhou', 'Тохо', '🏮', 'A', ['Touhou']],
    ['oshinoko', 'Звёздное дитя', '⭐', 'A', ['Oshi no Ko']],

    ['genshin', 'Геншин Импакт', '🌟', 'G', ['Genshin Impact', 'Genshin']],
    ['hsr', 'Honkai: Star Rail', '🚂', 'G', ['Honkai Star Rail', 'HSR', 'Хонкай']],
    ['witcher', 'Ведьмак', '🐺', 'G', ['The Witcher']],
    ['finalfantasy', 'Final Fantasy', '🔮', 'G', ['Файнл Фэнтези', 'Финал Фэнтези']],
    ['eldenring', 'Elden Ring', '💍', 'G', ['Элден Ринг']],
    ['zelda', 'Зельда', '🗡️', 'G', ['The Legend of Zelda', 'Zelda']],
    ['overwatch', 'Overwatch', '🛡️', 'G', ['Овервотч']],
    ['lol', 'League of Legends', '👑', 'G', ['LoL', 'Лига легенд']],
    ['arcane', 'Arcane', '🔧', 'G', ['Аркейн']],
    ['persona', 'Persona', '🎭', 'G', ['Персона']],
    ['nier', 'NieR', '🌹', 'G', ['Nier Automata', 'Ниер']],
    ['residentevil', 'Resident Evil', '🧟', 'G', ['Обитель зла']],
    ['fallout', 'Fallout', '☢️', 'G', ['Фоллаут']],
    ['skyrim', 'Skyrim', '🐲', 'G', ['The Elder Scrolls', 'Скайрим']],
    ['masseffect', 'Mass Effect', '🚀', 'G', ['Масс Эффект']],
    ['cyberpunk', 'Cyberpunk 2077', '🦾', 'G', ['Киберпанк']],
    ['dragonage', 'Dragon Age', '🐉', 'G', ['Драгон Эйдж']],
    ['undertale', 'Undertale', '❤️', 'G', ['Андертейл']],
    ['hollowknight', 'Hollow Knight', '🪲', 'G', ['Холлоу Найт']],
    ['sonic', 'Соник', '🦔', 'G', ['Sonic']],
    ['pokemon', 'Покемоны', '⚡', 'G', ['Pokémon', 'Pokemon']],
    ['mortalkombat', 'Mortal Kombat', '🥋', 'G', ['Мортал Комбат']],
    ['darksouls', 'Dark Souls', '🔥', 'G', ['Дарк Соулс']],
    ['fate', 'Fate', '⚜️', 'G', ['Fate/Grand Order', 'Fate/stay night', 'FGO']],

    ['harrypotter', 'Гарри Поттер', '⚡', 'M', ['Harry Potter']],
    ['starwars', 'Звёздные войны', '🌌', 'M', ['Star Wars']],
    ['marvel', 'Marvel', '🦸', 'M', ['Марвел']],
    ['dc', 'DC', '🦇', 'M', ['ДиСи', 'Бэтмен']],
    ['lotr', 'Властелин колец', '💍', 'M', ['The Lord of the Rings', 'LOTR', 'Хоббит']],
    ['got', 'Игра престолов', '🐉', 'M', ['Game of Thrones']],
    ['strangerthings', 'Очень странные дела', '🔦', 'M', ['Stranger Things']],
    ['squidgame', 'Игра в кальмара', '🦑', 'M', ['Squid Game']],
    ['wednesday', 'Уэнсдей', '🕷️', 'M', ['Wednesday', 'Addams Family', 'Семейка Аддамс']],
    ['potc', 'Пираты Карибского моря', '🏴‍☠️', 'M', ['Pirates of the Caribbean']],

    ['disney', 'Дисней', '🏰', 'C', ['Disney', 'Принцессы Диснея']],
    ['frozen', 'Холодное сердце', '❄️', 'C', ['Frozen']],
    ['winx', 'Винкс', '🧚', 'C', ['Winx', 'Winx Club', 'Клуб Винкс']],
    ['avatar', 'Аватар: Легенда об Аанге', '🌊', 'C', ['Avatar: The Last Airbender', 'ATLA']],
    ['stevenuniverse', 'Вселенная Стивена', '💎', 'C', ['Steven Universe']],
    ['adventuretime', 'Время приключений', '🗡️', 'C', ['Adventure Time']],
    ['hazbin', 'Отель Хазбин', '😈', 'C', ['Hazbin Hotel']],
    ['helluva', 'Helluva Boss', '🔥', 'C', ['Хеллува Босс']],
    ['mlp', 'Мой маленький пони', '🦄', 'C', ['My Little Pony']],
    ['ladybug', 'Леди Баг и Супер-Кот', '🐞', 'C', ['Miraculous', 'Ladybug']],
    ['shrek', 'Шрек', '🧅', 'C', ['Shrek']],

    ['percyjackson', 'Перси Джексон', '🔱', 'B', ['Percy Jackson']],
    ['narnia', 'Хроники Нарнии', '🦁', 'B', ['Narnia']],
    ['alice', 'Алиса в Стране чудес', '🐇', 'B', ['Alice in Wonderland']],
    ['sherlock', 'Шерлок Холмс', '🔍', 'B', ['Sherlock Holmes']],
    ['dune', 'Дюна', '🏜️', 'B', ['Dune']],
    ['fairytales', 'Сказки и легенды', '📖', 'B', ['Фольклор', 'Мифы']],

    ['original', 'Оригинальный персонаж', '🎨', 'O', ['OC', 'Ориджинал']],
    ['historical', 'Исторический костюм', '🏛️', 'O', ['Историческое']],
    ['steampunk', 'Стимпанк', '⚙️', 'O', ['Steampunk']],
    ['fantasy', 'Фэнтези', '🧙', 'O', ['Fantasy']],
    ['kpop', 'K-pop', '🎵', 'O', ['Кей-поп']],
    ['lolita', 'Лолита (мода)', '🎀', 'O', ['Lolita']]
  ];
  window.LIFEOS_FANDOMS = rows.map(function (r) {
    return { id: r[0], name: r[1], emoji: r[2], group: G[r[3]], aliases: r[4] || [], logo: LOGOS[r[0]] || null };
  });
})();
