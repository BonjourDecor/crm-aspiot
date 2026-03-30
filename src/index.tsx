import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShtroCRM - CRM и Учёт для салонов штор</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: {
            brand: {
              50: '#f0f5ff',
              100: '#e0eaff',
              200: '#c2d5ff',
              300: '#93b4ff',
              400: '#6090ff',
              500: '#3b6cf7',
              600: '#2550db',
              700: '#1e3fb2',
              800: '#1e3691',
              900: '#1e3177',
            },
            accent: {
              50: '#fdf4f0',
              100: '#fce8dd',
              200: '#f9ccbb',
              300: '#f4a88e',
              400: '#ee7e5a',
              500: '#e85d35',
              600: '#da4522',
              700: '#b5351b',
              800: '#902d1c',
              900: '#75291c',
            }
          }
        }
      }
    }
  </script>
  <style>
    * { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; }
    
    .gradient-hero {
      background: linear-gradient(135deg, #1e3fb2 0%, #3b6cf7 50%, #6090ff 100%);
    }
    
    .gradient-accent {
      background: linear-gradient(135deg, #e85d35 0%, #f4a88e 100%);
    }
    
    .glass-card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    
    .feature-card {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .feature-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 25px 60px -12px rgba(59, 108, 247, 0.25);
    }
    
    .pricing-card {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pricing-card:hover {
      transform: translateY(-4px);
    }
    .pricing-card.popular {
      border: 2px solid #3b6cf7;
      box-shadow: 0 20px 60px -12px rgba(59, 108, 247, 0.3);
    }
    
    .blob-1 {
      position: absolute;
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(232,93,53,0.15) 0%, transparent 70%);
      border-radius: 50%;
      filter: blur(60px);
      animation: float 8s ease-in-out infinite;
    }
    .blob-2 {
      position: absolute;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(59,108,247,0.12) 0%, transparent 70%);
      border-radius: 50%;
      filter: blur(50px);
      animation: float 10s ease-in-out infinite reverse;
    }
    
    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -30px) scale(1.05); }
      66% { transform: translate(-20px, 20px) scale(0.95); }
    }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeInUp 0.6s ease-out forwards; }
    .animate-delay-100 { animation-delay: 0.1s; opacity: 0; }
    .animate-delay-200 { animation-delay: 0.2s; opacity: 0; }
    .animate-delay-300 { animation-delay: 0.3s; opacity: 0; }
    .animate-delay-400 { animation-delay: 0.4s; opacity: 0; }
    
    .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease, padding 0.4s ease; }
    .faq-answer.open { max-height: 500px; }
    
    .toggle-bg { transition: background-color 0.3s ease; }
    .toggle-dot { transition: transform 0.3s ease; }
    
    .nav-link { position: relative; }
    .nav-link::after {
      content: '';
      position: absolute;
      bottom: -2px; left: 0;
      width: 0; height: 2px;
      background: #e85d35;
      transition: width 0.3s ease;
    }
    .nav-link:hover::after { width: 100%; }
    
    .stat-number {
      background: linear-gradient(135deg, #3b6cf7, #e85d35);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .mobile-menu {
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }
    .mobile-menu.open {
      transform: translateX(0);
    }
  </style>
</head>
<body class="bg-white text-gray-800 antialiased">

  <!-- ========== HEADER ========== -->
  <header id="header" class="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 lg:h-20">
        <!-- Logo -->
        <a href="#" class="flex items-center gap-2 group">
          <div class="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center">
            <i class="fas fa-scissors text-white text-sm"></i>
          </div>
          <span class="text-xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
            Shtro<span class="text-accent-500">CRM</span>
          </span>
        </a>

        <!-- Desktop Nav -->
        <nav class="hidden lg:flex items-center gap-8">
          <a href="#features" class="nav-link text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Возможности</a>
          <a href="#how-it-works" class="nav-link text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Как это работает</a>
          <a href="#pricing" class="nav-link text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Тарифы</a>
          <a href="#reviews" class="nav-link text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Отзывы</a>
          <a href="#faq" class="nav-link text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
        </nav>

        <!-- CTA Buttons -->
        <div class="hidden lg:flex items-center gap-3">
          <button class="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 transition-colors">Войти</button>
          <button class="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-600/25">
            Попробовать бесплатно
          </button>
        </div>

        <!-- Mobile Burger -->
        <button id="burger-btn" class="lg:hidden p-2 text-gray-600 hover:text-gray-900">
          <i class="fas fa-bars text-xl"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Menu -->
  <div id="mobile-menu" class="mobile-menu fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[60] p-6">
    <div class="flex justify-end mb-8">
      <button id="close-menu-btn" class="p-2 text-gray-400 hover:text-gray-900">
        <i class="fas fa-xmark text-2xl"></i>
      </button>
    </div>
    <nav class="flex flex-col gap-4">
      <a href="#features" class="mobile-link text-lg font-medium text-gray-700 hover:text-brand-600 py-2 border-b border-gray-100">Возможности</a>
      <a href="#how-it-works" class="mobile-link text-lg font-medium text-gray-700 hover:text-brand-600 py-2 border-b border-gray-100">Как это работает</a>
      <a href="#pricing" class="mobile-link text-lg font-medium text-gray-700 hover:text-brand-600 py-2 border-b border-gray-100">Тарифы</a>
      <a href="#reviews" class="mobile-link text-lg font-medium text-gray-700 hover:text-brand-600 py-2 border-b border-gray-100">Отзывы</a>
      <a href="#faq" class="mobile-link text-lg font-medium text-gray-700 hover:text-brand-600 py-2 border-b border-gray-100">FAQ</a>
      <button class="mt-6 w-full text-center font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-3 rounded-xl transition-all">
        Попробовать бесплатно
      </button>
    </nav>
  </div>
  <div id="menu-overlay" class="fixed inset-0 bg-black/30 z-[55] hidden"></div>


  <!-- ========== HERO ========== -->
  <section class="gradient-hero relative overflow-hidden pt-28 pb-20 lg:pt-40 lg:pb-32">
    <div class="blob-1" style="top: -100px; right: -200px;"></div>
    <div class="blob-2" style="bottom: -150px; left: -100px;"></div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="max-w-3xl mx-auto text-center">
        <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 animate-fade-in">
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          <span class="text-white/90 text-sm font-medium">Уже готов к работе</span>
        </div>
        
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 animate-fade-in animate-delay-100">
          CRM и Учёт<br>
          <span class="text-accent-300">для салонов штор</span>
        </h1>
        
        <p class="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 animate-fade-in animate-delay-200">
          Сервис для ведения проектов и управленческого учёта. 
          Когда ваше текстильное хобби превращается в бизнес.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in animate-delay-300">
          <button class="inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-bold px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl text-lg">
            <i class="fas fa-rocket"></i>
            Зарегистрироваться
          </button>
          <button class="inline-flex items-center justify-center gap-2 glass-card text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/15 transition-all text-lg">
            <i class="fas fa-play-circle"></i>
            Смотреть демо
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto animate-fade-in animate-delay-400">
        <div class="glass-card rounded-2xl p-5 text-center">
          <div class="text-3xl font-extrabold text-white mb-1">500+</div>
          <div class="text-sm text-white/70">Салонов штор</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center">
          <div class="text-3xl font-extrabold text-white mb-1">4</div>
          <div class="text-sm text-white/70">Страны</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center">
          <div class="text-3xl font-extrabold text-white mb-1">50+</div>
          <div class="text-sm text-white/70">Поставщиков</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center">
          <div class="text-3xl font-extrabold text-white mb-1">14</div>
          <div class="text-sm text-white/70">Дней бесплатно</div>
        </div>
      </div>
    </div>
  </section>


  <!-- ========== QUICK FEATURES (4 cards) ========== -->
  <section class="py-16 lg:py-24 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div class="feature-card bg-white rounded-2xl p-6 shadow-sm">
          <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
            <i class="fab fa-telegram text-blue-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Мессенджеры</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Пишите клиенту в Telegram, WhatsApp и Instagram прямо из CRM</p>
        </div>

        <div class="feature-card bg-white rounded-2xl p-6 shadow-sm">
          <div class="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
            <i class="fas fa-file-import text-green-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Заявки с сайта</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Подключите форму к сайту — заявки сразу прилетят в систему</p>
        </div>

        <div class="feature-card bg-white rounded-2xl p-6 shadow-sm">
          <div class="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
            <i class="fas fa-file-invoice text-purple-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Выгрузка в 1С</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Выгружайте документы в 1С или предоставьте доступ бухгалтеру</p>
        </div>

        <div class="feature-card bg-white rounded-2xl p-6 shadow-sm">
          <div class="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
            <i class="fas fa-cash-register text-orange-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Кассовые чеки</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Свяжите свою кассу и печатайте чеки прямо из сервиса</p>
        </div>

      </div>
    </div>
  </section>


  <!-- ========== FEATURES DETAILED ========== -->
  <section id="features" class="py-16 lg:py-28 relative overflow-hidden">
    <div class="blob-2" style="top: 100px; right: -250px; opacity: 0.5;"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-brand-50 rounded-full px-4 py-1.5 mb-4">
          <i class="fas fa-sparkles text-brand-600 text-xs"></i>
          <span class="text-brand-600 text-sm font-semibold">Возможности сервиса</span>
        </div>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          Всё, что нужно вашему бизнесу
        </h2>
        <p class="text-lg text-gray-500 max-w-2xl mx-auto">
          От управления клиентами до финансового учёта — всё в одном месте
        </p>
      </div>

      <!-- Feature Block 1 -->
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-20 lg:mb-32">
        <div>
          <div class="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
            <i class="fas fa-users text-brand-600 text-2xl"></i>
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Лучше продавать и обслуживать клиентов</h3>
          <p class="text-gray-500 mb-6 leading-relaxed">Ведите клиента от первого контакта до завершения проекта. Воронка продаж, календарь задач и контроль статуса заказов.</p>
          <ul class="space-y-3">
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Готовая воронка продаж</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Задачи и календарь с уведомлениями</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Контроль статуса заказов в швейном цехе</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Онлайн-портфолио завершённых проектов</span></li>
          </ul>
        </div>
        <div class="bg-gradient-to-br from-brand-50 to-blue-50 rounded-3xl p-8 lg:p-12 flex items-center justify-center min-h-[300px]">
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-600 mb-4 shadow-lg shadow-brand-600/30">
              <i class="fas fa-chart-line text-white text-3xl"></i>
            </div>
            <p class="font-semibold text-brand-700 text-lg">Воронка продаж</p>
            <p class="text-brand-500 text-sm mt-1">Ведём клиента до продажи</p>
          </div>
        </div>
      </div>

      <!-- Feature Block 2 -->
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-20 lg:mb-32">
        <div class="order-2 lg:order-1 bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl p-8 lg:p-12 flex items-center justify-center min-h-[300px]">
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent-500 mb-4 shadow-lg shadow-accent-500/30">
              <i class="fas fa-truck text-white text-3xl"></i>
            </div>
            <p class="font-semibold text-accent-700 text-lg">Работа с поставщиками</p>
            <p class="text-accent-500 text-sm mt-1">Заказ в пару кликов</p>
          </div>
        </div>
        <div class="order-1 lg:order-2">
          <div class="w-14 h-14 rounded-2xl bg-accent-100 flex items-center justify-center mb-6">
            <i class="fas fa-boxes-stacked text-accent-600 text-2xl"></i>
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Быстро работать с поставщиками</h3>
          <p class="text-gray-500 mb-6 leading-relaxed">Прайс-листы уже загружены. Делайте заказ онлайн, проверяйте наличие ткани и общайтесь с поставщиками в чате.</p>
          <ul class="space-y-3">
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Прайс-листы поставщиков уже загружены</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Онлайн-заказ и получение счёта на оплату</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Проверка наличия ткани онлайн</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Чат с поставщиками по заказу</span></li>
          </ul>
        </div>
      </div>

      <!-- Feature Block 3 -->
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-20 lg:mb-32">
        <div>
          <div class="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
            <i class="fas fa-chart-pie text-emerald-600 text-2xl"></i>
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Видеть как идут дела</h3>
          <p class="text-gray-500 mb-6 leading-relaxed">Дашборд с полной картиной: прогресс проектов, доходы, лучшие услуги и эффективные дизайнеры.</p>
          <ul class="space-y-3">
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Дашборд по всем проектам</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Аналитика по доходам</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Рейтинг услуг по прибыльности</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Эффективность дизайнеров</span></li>
          </ul>
        </div>
        <div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 lg:p-12 flex items-center justify-center min-h-[300px]">
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-600 mb-4 shadow-lg shadow-emerald-600/30">
              <i class="fas fa-gauge-high text-white text-3xl"></i>
            </div>
            <p class="font-semibold text-emerald-700 text-lg">Дашборд</p>
            <p class="text-emerald-500 text-sm mt-1">Полная картина бизнеса</p>
          </div>
        </div>
      </div>

      <!-- Feature Block 4 -->
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div class="order-2 lg:order-1 bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-8 lg:p-12 flex items-center justify-center min-h-[300px]">
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-violet-600 mb-4 shadow-lg shadow-violet-600/30">
              <i class="fas fa-wallet text-white text-3xl"></i>
            </div>
            <p class="font-semibold text-violet-700 text-lg">Финансы</p>
            <p class="text-violet-500 text-sm mt-1">Считаем каждый рубль</p>
          </div>
        </div>
        <div class="order-1 lg:order-2">
          <div class="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-6">
            <i class="fas fa-ruble-sign text-violet-600 text-2xl"></i>
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Считать деньги и планировать расходы</h3>
          <p class="text-gray-500 mb-6 leading-relaxed">Контролируйте все кассы, платежи, взаиморасчёты с поставщиками и зарплаты сотрудников.</p>
          <ul class="space-y-3">
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Баланс по всем кассам</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">График платежей и поступлений</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Взаиморасчёты с поставщиками</span></li>
            <li class="flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-check text-green-600 text-xs"></i></span><span class="text-gray-700">Расчёт зарплат сотрудникам</span></li>
          </ul>
        </div>
      </div>

    </div>
  </section>


  <!-- ========== HOW IT WORKS ========== -->
  <section id="how-it-works" class="py-16 lg:py-28 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-accent-50 rounded-full px-4 py-1.5 mb-4">
          <i class="fas fa-route text-accent-600 text-xs"></i>
          <span class="text-accent-600 text-sm font-semibold">Начать легко</span>
        </div>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          Что будет после регистрации
        </h2>
        <p class="text-lg text-gray-500 max-w-2xl mx-auto">4 простых шага — и вы уже работаете</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        <div class="relative bg-white rounded-2xl p-6 shadow-sm">
          <div class="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm shadow-lg">1</div>
          <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4 mt-2">
            <i class="fas fa-building text-brand-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Заполнение реквизитов</h3>
          <p class="text-sm text-gray-500">Чтобы мы поняли ваш статус и помогли настроить сервис</p>
        </div>

        <div class="relative bg-white rounded-2xl p-6 shadow-sm">
          <div class="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm shadow-lg">2</div>
          <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4 mt-2">
            <i class="fas fa-headset text-brand-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Созвон с куратором</h3>
          <p class="text-sm text-gray-500">Запускаем систему и отвечаем на все вопросы</p>
        </div>

        <div class="relative bg-white rounded-2xl p-6 shadow-sm">
          <div class="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm shadow-lg">3</div>
          <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4 mt-2">
            <i class="fas fa-flask text-brand-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Тестовый период</h3>
          <p class="text-sm text-gray-500">14 дней — попробуйте без спешки и решите, подходит ли сервис</p>
        </div>

        <div class="relative bg-white rounded-2xl p-6 shadow-sm">
          <div class="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm shadow-lg">4</div>
          <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4 mt-2">
            <i class="fas fa-graduation-cap text-brand-600 text-xl"></i>
          </div>
          <h3 class="font-bold text-gray-900 mb-2">Поддержка куратора</h3>
          <p class="text-sm text-gray-500">Обучение, ответы на вопросы и настройка под ваши нужды</p>
        </div>
      </div>
    </div>
  </section>


  <!-- ========== PRICING ========== -->
  <section id="pricing" class="py-16 lg:py-28">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <div class="inline-flex items-center gap-2 bg-emerald-50 rounded-full px-4 py-1.5 mb-4">
          <i class="fas fa-tag text-emerald-600 text-xs"></i>
          <span class="text-emerald-600 text-sm font-semibold">Тарифы</span>
        </div>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          Выберите свой тариф
        </h2>
        <p class="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          На всех тарифах действует пробный период 14 дней
        </p>

        <!-- Toggle -->
        <div class="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1.5">
          <button id="btn-12m" class="pricing-toggle-btn px-5 py-2 rounded-full text-sm font-semibold transition-all bg-brand-600 text-white shadow-md" data-period="12">
            12 месяцев <span class="text-xs ml-1 opacity-80">-25%</span>
          </button>
          <button id="btn-6m" class="pricing-toggle-btn px-5 py-2 rounded-full text-sm font-semibold transition-all text-gray-600 hover:text-gray-900" data-period="6">
            6 месяцев
          </button>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8" id="pricing-grid">
        
        <!-- Дизайнер -->
        <div class="pricing-card bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div class="mb-6">
            <h3 class="text-lg font-bold text-gray-900">Дизайнер</h3>
            <p class="text-sm text-gray-500 mt-1">Для одного дизайнера</p>
          </div>
          <div class="mb-6">
            <span class="price-value text-4xl font-extrabold text-gray-900" data-price-12="1 650" data-price-6="1 650">1 650</span>
            <span class="text-gray-500 text-sm"> руб/мес</span>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Полный функционал</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Онлайн поддержка</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Видеоуроки</li>
            <li class="flex items-center gap-2 text-sm text-gray-400"><i class="fas fa-xmark"></i>Сотрудники</li>
          </ul>
          <button class="w-full py-3 rounded-xl border-2 border-brand-600 text-brand-600 font-semibold hover:bg-brand-600 hover:text-white transition-all">
            Выбрать
          </button>
        </div>

        <!-- Базовый -->
        <div class="pricing-card bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div class="mb-6">
            <h3 class="text-lg font-bold text-gray-900">Базовый</h3>
            <p class="text-sm text-gray-500 mt-1">1 салон, 2 сотрудника</p>
          </div>
          <div class="mb-6">
            <span class="price-value text-4xl font-extrabold text-gray-900" data-price-12="2 200" data-price-6="2 750">2 200</span>
            <span class="text-gray-500 text-sm"> руб/мес</span>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>1 владелец + 1 салон</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>2 сотрудника</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Онлайн поддержка</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Видеоуроки</li>
          </ul>
          <button class="w-full py-3 rounded-xl border-2 border-brand-600 text-brand-600 font-semibold hover:bg-brand-600 hover:text-white transition-all">
            Выбрать
          </button>
        </div>

        <!-- Продвинутый (Popular) -->
        <div class="pricing-card popular bg-white rounded-2xl p-6 relative">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
            Популярный
          </div>
          <div class="mb-6 mt-2">
            <h3 class="text-lg font-bold text-gray-900">Продвинутый</h3>
            <p class="text-sm text-gray-500 mt-1">1 салон, 4 сотрудника</p>
          </div>
          <div class="mb-6">
            <span class="price-value text-4xl font-extrabold text-brand-600" data-price-12="2 695" data-price-6="3 850">2 695</span>
            <span class="text-gray-500 text-sm"> руб/мес</span>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>1 владелец + 1 салон</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>4 сотрудника</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Онлайн поддержка</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Видеоуроки</li>
          </ul>
          <button class="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/25">
            Выбрать
          </button>
        </div>

        <!-- Корпоративный -->
        <div class="pricing-card bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div class="mb-6">
            <h3 class="text-lg font-bold text-gray-900">Корпоративный</h3>
            <p class="text-sm text-gray-500 mt-1">2 салона, 10 сотрудников</p>
          </div>
          <div class="mb-6">
            <span class="price-value text-4xl font-extrabold text-gray-900" data-price-12="4 950" data-price-6="8 250">4 950</span>
            <span class="text-gray-500 text-sm"> руб/мес</span>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>1 владелец + 2 салона</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>10 сотрудников</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Поддержка по телефону</li>
            <li class="flex items-center gap-2 text-sm text-gray-600"><i class="fas fa-check text-green-500"></i>Видеоуроки</li>
          </ul>
          <button class="w-full py-3 rounded-xl border-2 border-brand-600 text-brand-600 font-semibold hover:bg-brand-600 hover:text-white transition-all">
            Выбрать
          </button>
        </div>

      </div>
    </div>
  </section>


  <!-- ========== REVIEWS ========== -->
  <section id="reviews" class="py-16 lg:py-28 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-yellow-50 rounded-full px-4 py-1.5 mb-4">
          <i class="fas fa-star text-yellow-500 text-xs"></i>
          <span class="text-yellow-700 text-sm font-semibold">Отзывы</span>
        </div>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          Что говорят клиенты
        </h2>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex gap-1 mb-4">
            <i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i>
          </div>
          <p class="text-gray-600 mb-6 leading-relaxed">"Наконец-то CRM, которая понимает нашу специфику! Все процессы — от замера до монтажа — учтены. Раньше вели всё в Excel, теперь экономим 2 часа каждый день."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">ЛК</div>
            <div>
              <div class="font-semibold text-gray-900 text-sm">Лариса Козлова</div>
              <div class="text-xs text-gray-500">Студия ДЕКОРА, г. Ижевск</div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex gap-1 mb-4">
            <i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i>
          </div>
          <p class="text-gray-600 mb-6 leading-relaxed">"Особенно нравится интеграция с поставщиками — проверяю наличие ткани и оформляю заказ прямо из системы. Бухгалтер тоже счастлив — всё выгружается в 1С."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center font-bold text-accent-600">НК</div>
            <div>
              <div class="font-semibold text-gray-900 text-sm">Наталья Куляхтина</div>
              <div class="text-xs text-gray-500">Салон штор «Антураж», г. Орск</div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div class="flex gap-1 mb-4">
            <i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i><i class="fas fa-star text-yellow-400"></i>
          </div>
          <p class="text-gray-600 mb-6 leading-relaxed">"Мы работаем удалённо — дизайнеры в разных городах. Благодаря ShtroCRM вижу статус каждого проекта, загрузку сотрудников и финансы в реальном времени."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600">ЛБ</div>
            <div>
              <div class="font-semibold text-gray-900 text-sm">Лилия Кузнецова</div>
              <div class="text-xs text-gray-500">«Лучшее бюро текстиля», г. Саратов</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>


  <!-- ========== MOBILE APP ========== -->
  <section class="py-16 lg:py-28 relative overflow-hidden">
    <div class="blob-1" style="bottom: -200px; left: -100px; opacity: 0.4;"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="gradient-hero rounded-3xl p-8 sm:p-12 lg:p-16 text-center">
        <div class="max-w-2xl mx-auto">
          <div class="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
            <i class="fas fa-mobile-screen-button text-white text-3xl"></i>
          </div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Мобильное приложение
          </h2>
          <p class="text-lg text-white/80 mb-8">
            Весь бизнес в кармане. Ничего не теряется. Работайте с проектами, ведите замеры на выезде и контролируйте бизнес — всё со смартфона.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button class="inline-flex items-center justify-center gap-3 bg-black text-white px-6 py-3.5 rounded-xl hover:bg-gray-900 transition-all">
              <i class="fab fa-apple text-2xl"></i>
              <div class="text-left">
                <div class="text-[10px] uppercase tracking-wide opacity-80">Загрузите в</div>
                <div class="font-semibold text-sm -mt-0.5">App Store</div>
              </div>
            </button>
            <button class="inline-flex items-center justify-center gap-3 bg-black text-white px-6 py-3.5 rounded-xl hover:bg-gray-900 transition-all">
              <i class="fab fa-google-play text-xl"></i>
              <div class="text-left">
                <div class="text-[10px] uppercase tracking-wide opacity-80">Доступно в</div>
                <div class="font-semibold text-sm -mt-0.5">Google Play</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ========== FAQ ========== -->
  <section id="faq" class="py-16 lg:py-28 bg-gray-50">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <div class="inline-flex items-center gap-2 bg-violet-50 rounded-full px-4 py-1.5 mb-4">
          <i class="fas fa-circle-question text-violet-600 text-xs"></i>
          <span class="text-violet-600 text-sm font-semibold">FAQ</span>
        </div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          Популярные вопросы
        </h2>
      </div>

      <div class="space-y-3" id="faq-list">
        
        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Чем сервис отличается от обычных CRM?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Наш сервис узкоспециализированный — полностью заточен под текстильный бизнес. Формируется автоматическая калькуляция сметы, спецификации заказа, договоров. Можно отправить заказ поставщику на его бланке, прикрепить фотографии до и после монтажа, разбить заказ по комнатам. Имеется чат между дизайнерами и швеями.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Сколько стоит сервис?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Стоимость зависит от количества сотрудников. Наиболее популярный тариф «Продвинутый» — 1 салон, владелец и 4 дизайнера: от 2 695 руб/мес при оплате за 12 месяцев. Каждый тариф можно адаптировать с помощью калькулятора в Личном кабинете. Пробный период 14 дней — бесплатно.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Могу ли я вносить данные с выезда на замер?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Конечно! Мобильное приложение ShtroCRM позволяет вносить замеры, фотографии и комментарии прямо на объекте. Данные синхронизируются мгновенно.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Есть ли складской учёт?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Да! Вы сможете вести учёт остатков онлайн, видеть списания по заказам, выявлять востребованные ткани, учитывать себестоимость при расчёте зарплат и автоматизировать взаиморасчёты с поставщиками.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Поддерживается ли работа с несколькими валютами?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Да! Выберите основную валюту и добавьте второстепенные. Курс подгружается автоматически (или можно задать вручную). Товары при продаже автоматически конвертируются в основную валюту по курсу на нужный день.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Как рассчитывается зарплата сотрудникам?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Поддерживаются разные формы: оклад, простой и сложный процент, автоматический расчёт услуг швеи, процент с продаж акционного товара или услуги. Всё считается автоматически.</p>
          </div>
        </div>

        <div class="faq-item bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-toggle w-full flex items-center justify-between p-5 text-left">
            <span class="font-semibold text-gray-900 pr-4">Безопасны ли мои данные?</span>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 flex-shrink-0"></i>
          </button>
          <div class="faq-answer px-5">
            <p class="text-gray-600 pb-5 leading-relaxed">Данные хранятся в защищённом дата-центре. Для передачи информации используется протокол HTTPS с надёжным шифрованием. Мы также поддерживаем ограничение доступов для сотрудников.</p>
          </div>
        </div>

      </div>
    </div>
  </section>


  <!-- ========== CTA ========== -->
  <section class="py-16 lg:py-28">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-8 sm:p-12 lg:p-16 text-center relative overflow-hidden">
        <div class="blob-1" style="top: -100px; right: -150px; opacity: 0.3;"></div>
        <div class="relative z-10 max-w-2xl mx-auto">
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            Готовы начать?
          </h2>
          <p class="text-lg text-white/80 mb-8">
            14 дней бесплатно. Никаких обязательств. Попробуйте все возможности сервиса прямо сейчас.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button class="inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-bold px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-lg text-lg">
              <i class="fas fa-rocket"></i>
              Начать бесплатно
            </button>
            <button class="inline-flex items-center justify-center gap-2 glass-card text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/15 transition-all text-lg">
              <i class="fas fa-phone"></i>
              Связаться с нами
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ========== FOOTER ========== -->
  <footer class="bg-gray-900 text-gray-400 pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        
        <!-- Brand -->
        <div>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center">
              <i class="fas fa-scissors text-white text-sm"></i>
            </div>
            <span class="text-xl font-bold text-white">Shtro<span class="text-accent-400">CRM</span></span>
          </div>
          <p class="text-sm leading-relaxed mb-4">CRM и управленческий учёт для дизайнеров по текстилю и салонов штор</p>
          <div class="flex gap-3">
            <a href="#" class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-600 flex items-center justify-center transition-colors"><i class="fab fa-telegram text-sm"></i></a>
            <a href="#" class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-600 flex items-center justify-center transition-colors"><i class="fab fa-vk text-sm"></i></a>
            <a href="#" class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-600 flex items-center justify-center transition-colors"><i class="fab fa-youtube text-sm"></i></a>
            <a href="#" class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-600 flex items-center justify-center transition-colors"><i class="fab fa-instagram text-sm"></i></a>
          </div>
        </div>

        <!-- Возможности -->
        <div>
          <h4 class="text-white font-semibold mb-4">Возможности</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white transition-colors">Воронка продаж</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Работа с поставщиками</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Дашборд и аналитика</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Финансовый учёт</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Складской учёт</a></li>
          </ul>
        </div>

        <!-- Компания -->
        <div>
          <h4 class="text-white font-semibold mb-4">Компания</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white transition-colors">О нас</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Блог</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Партнёры</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Видеоуроки</a></li>
          </ul>
        </div>

        <!-- Контакты -->
        <div>
          <h4 class="text-white font-semibold mb-4">Контакты</h4>
          <ul class="space-y-3 text-sm">
            <li class="flex items-center gap-2"><i class="fas fa-envelope text-brand-400"></i><a href="mailto:info@shtrocrm.ru" class="hover:text-white transition-colors">info@shtrocrm.ru</a></li>
            <li class="flex items-center gap-2"><i class="fas fa-phone text-brand-400"></i><a href="tel:+78001234567" class="hover:text-white transition-colors">8 (800) 123-45-67</a></li>
          </ul>
        </div>
      </div>

      <div class="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-sm">&copy; 2014&ndash;2026 ShtroCRM. Все права защищены.</div>
        <div class="flex gap-4 text-sm">
          <a href="#" class="hover:text-white transition-colors">Политика конфиденциальности</a>
          <a href="#" class="hover:text-white transition-colors">Пользовательское соглашение</a>
        </div>
      </div>
    </div>
  </footer>


  <!-- ========== SCRIPTS ========== -->
  <script>
  (function() {
    // === Sticky header ===
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 60) {
        header.classList.add('bg-white/95', 'backdrop-blur-md', 'shadow-sm');
      } else {
        header.classList.remove('bg-white/95', 'backdrop-blur-md', 'shadow-sm');
      }
    });

    // === Mobile menu ===
    const burgerBtn = document.getElementById('burger-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    function openMenu() {
      mobileMenu.classList.add('open');
      menuOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      mobileMenu.classList.remove('open');
      menuOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    }

    burgerBtn.addEventListener('click', openMenu);
    closeMenuBtn.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);

    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // === Pricing toggle ===
    const btn12 = document.getElementById('btn-12m');
    const btn6 = document.getElementById('btn-6m');
    const priceValues = document.querySelectorAll('.price-value');
    let currentPeriod = 12;

    function setPeriod(period) {
      currentPeriod = period;
      priceValues.forEach(el => {
        el.textContent = el.dataset['price' + period];
      });
      if (period === 12) {
        btn12.classList.add('bg-brand-600', 'text-white', 'shadow-md');
        btn12.classList.remove('text-gray-600');
        btn6.classList.remove('bg-brand-600', 'text-white', 'shadow-md');
        btn6.classList.add('text-gray-600');
      } else {
        btn6.classList.add('bg-brand-600', 'text-white', 'shadow-md');
        btn6.classList.remove('text-gray-600');
        btn12.classList.remove('bg-brand-600', 'text-white', 'shadow-md');
        btn12.classList.add('text-gray-600');
      }
    }

    btn12.addEventListener('click', () => setPeriod(12));
    btn6.addEventListener('click', () => setPeriod(6));

    // === FAQ Accordion ===
    document.querySelectorAll('.faq-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const answer = btn.nextElementSibling;
        const icon = btn.querySelector('i');
        const isOpen = answer.classList.contains('open');

        // Close all
        document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
        document.querySelectorAll('.faq-toggle i').forEach(i => i.classList.remove('rotate-180'));

        if (!isOpen) {
          answer.classList.add('open');
          icon.classList.add('rotate-180');
        }
      });
    });

    // === Scroll animations ===
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.feature-card, .faq-item, .pricing-card').forEach(el => {
      el.style.opacity = '0';
      observer.observe(el);
    });
  })();
  </script>

</body>
</html>`)
})

// API routes
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
