/**
 * LifeOS — meals/demo-data.js
 * Демо-данные для МенюПлана (когда Supabase не настроен).
 * Вставляются в localStorage при старте в DEMO_MODE.
 */
/* global DB */
'use strict';

async function seedDemoData() {
  // Проверяем, есть ли уже данные meal_products
  const existing = await DB.getAll('meal_products').catch(() => []);
  if (existing.length > 0) return; // уже посеяны

  const now = new Date().toISOString();

  // ── Продукты ──
  const products = [
    { name: 'Куриная грудка', emoji: '🍗', category: 'Мясо', unit: 'г', protein: 31, fat: 3.6, carbs: 0, kcal: 165, price: 350, package_size: 500 },
    { name: 'Рис белый', emoji: '🍚', category: 'Крупы', unit: 'г', protein: 6.8, fat: 0.6, carbs: 28, kcal: 130, price: 90, package_size: 800 },
    { name: 'Гречка', emoji: '🌾', category: 'Крупы', unit: 'г', protein: 13.2, fat: 3.4, carbs: 25, kcal: 110, price: 60, package_size: 800 },
    { name: 'Лук репчатый', emoji: '🧅', category: 'Овощи', unit: 'г', protein: 1.4, fat: 0.2, carbs: 9, kcal: 40, price: 30, package_size: 1000 },
    { name: 'Морковь', emoji: '🥕', category: 'Овощи', unit: 'г', protein: 1.2, fat: 0.1, carbs: 10, kcal: 41, price: 25, package_size: 1000 },
    { name: 'Картофель', emoji: '🥔', category: 'Овощи', unit: 'г', protein: 2, fat: 0.1, carbs: 17, kcal: 77, price: 20, package_size: 1000 },
    { name: 'Яйца', emoji: '🥚', category: 'Молочные', unit: 'шт', protein: 12.5, fat: 10.8, carbs: 0.8, kcal: 155, price: 120, package_size: 10 },
    { name: 'Молоко 3.2%', emoji: '🥛', category: 'Молочные', unit: 'мл', protein: 3, fat: 3.2, carbs: 4.8, kcal: 60, price: 75, package_size: 1000 },
    { name: 'Сметана 20%', emoji: '🥄', category: 'Молочные', unit: 'г', protein: 2.8, fat: 20, carbs: 3.2, kcal: 206, price: 85, package_size: 300 },
    { name: 'Лосось', emoji: '🐟', category: 'Рыба', unit: 'г', protein: 22, fat: 12, carbs: 0, kcal: 208, price: 650, package_size: 300 },
    { name: 'Авокадо', emoji: '🥑', category: 'Овощи', unit: 'г', protein: 2, fat: 15, carbs: 9, kcal: 160, price: 120, package_size: 1 },
    { name: 'Помидоры', emoji: '🍅', category: 'Овощи', unit: 'г', protein: 0.9, fat: 0.2, carbs: 3.9, kcal: 18, price: 90, package_size: 500 },
    { name: 'Творог 5%', emoji: '🧀', category: 'Молочные', unit: 'г', protein: 17, fat: 5, carbs: 3, kcal: 120, price: 150, package_size: 400 },
    { name: 'Макароны тв.сорта', emoji: '🍝', category: 'Крупы', unit: 'г', protein: 12, fat: 1.5, carbs: 25, kcal: 160, price: 70, package_size: 400 },
    { name: 'Оливковое масло', emoji: '🫒', category: 'Бакалея', unit: 'мл', protein: 0, fat: 91, carbs: 0, kcal: 820, price: 350, package_size: 250 },
    { name: 'Овсянка', emoji: '🥣', category: 'Крупы', unit: 'г', protein: 13.5, fat: 6.5, carbs: 67, kcal: 370, price: 55, package_size: 500 },
  ];

  const prodIds = {};
  for (const p of products) {
    const rec = await DB.create('meal_products', {
      ...p,
      metadata: { demo: true },
    });
    prodIds[p.name] = rec.id;
  }

  // ── Рецепты ──
  const recipes = [
    {
      name: 'Куриная грудка с рисом',
      emoji: '🍗🍚',
      description: 'Простое и сытное блюдо для обеда',
      tags: ['обед', 'белок'],
      portions: 2,
      cookTimeMin: 30,
      difficulty: 1,
      recommendedMeals: ['Обед'],
      ingredients: [
        { productId: prodIds['Куриная грудка'], name: 'Куриная грудка', qty: 200, unit: 'г' },
        { productId: prodIds['Рис белый'], name: 'Рис', qty: 150, unit: 'г' },
        { productId: prodIds['Лук репчатый'], name: 'Лук', qty: 50, unit: 'г' },
        { productId: prodIds['Морковь'], name: 'Морковь', qty: 50, unit: 'г' },
      ],
      steps: [
        { text: 'Отварить рис до готовности', timerMin: 15 },
        { text: 'Нарезать курицу кубиками и обжарить до золотистой корочки', timerMin: 8 },
        { text: 'Добавить лук и морковь, тушить 5 минут', timerMin: 5 },
        { text: 'Смешать с рисом, подавать горячим' },
      ],
    },
    {
      name: 'Овсяноблин',
      emoji: '🥞',
      description: 'ПП-завтрак за 5 минут',
      tags: ['завтрак', 'пп'],
      portions: 1,
      cookTimeMin: 5,
      difficulty: 1,
      recommendedMeals: ['Завтрак'],
      ingredients: [
        { productId: prodIds['Яйца'], name: 'Яйца', qty: 2, unit: 'шт' },
        { productId: prodIds['Овсянка'], name: 'Овсяные хлопья', qty: 30, unit: 'г' },
        { productId: prodIds['Молоко 3.2%'], name: 'Молоко', qty: 30, unit: 'мл' },
      ],
      steps: [
        { text: 'Смешать яйца, овсянку и молоко вилкой' },
        { text: 'Вылить на разогретую сковороду, жарить 2 мин с каждой стороны', timerMin: 3 },
      ],
    },
    {
      name: 'Салат с лососем и авокадо',
      emoji: '🥗',
      description: 'Лёгкий ужин с полезными жирами',
      tags: ['ужин', 'пп'],
      portions: 2,
      cookTimeMin: 10,
      difficulty: 2,
      recommendedMeals: ['Ужин'],
      ingredients: [
        { productId: prodIds['Лосось'], name: 'Лосось', qty: 150, unit: 'г' },
        { productId: prodIds['Авокадо'], name: 'Авокадо', qty: 1, unit: 'шт' },
        { productId: prodIds['Помидоры'], name: 'Помидоры', qty: 100, unit: 'г' },
        { productId: prodIds['Оливковое масло'], name: 'Оливковое масло', qty: 15, unit: 'мл' },
      ],
      steps: [
        { text: 'Нарезать лосось слайсами' },
        { text: 'Нарезать авокадо и помидоры кубиками' },
        { text: 'Смешать, заправить оливковым маслом, посолить' },
      ],
    },
    {
      name: 'Макароны с курицей',
      emoji: '🍝',
      description: 'Классический ужин для всей семьи',
      tags: ['ужин', 'обед'],
      portions: 3,
      cookTimeMin: 25,
      difficulty: 1,
      recommendedMeals: ['Обед', 'Ужин'],
      ingredients: [
        { productId: prodIds['Макароны тв.сорта'], name: 'Макароны', qty: 200, unit: 'г' },
        { productId: prodIds['Куриная грудка'], name: 'Куриная грудка', qty: 250, unit: 'г' },
        { productId: prodIds['Сметана 20%'], name: 'Сметана', qty: 60, unit: 'г' },
      ],
      steps: [
        { text: 'Отварить макароны', timerMin: 10 },
        { text: 'Обжарить курицу кусочками', timerMin: 8 },
        { text: 'Добавить сметану, протушить 3 минуты', timerMin: 3 },
        { text: 'Смешать с макаронами' },
      ],
    },
  ];

  for (const r of recipes) {
    await DB.create('meal_recipes', {
      ...r,
      metadata: { demo: true },
    });
  }

  console.info('[МенюПлан] Demo data seeded: ' + products.length + ' products, ' + recipes.length + ' recipes');
}