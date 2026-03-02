# AI Safety Connections 🧠🔗�

A Connections-style puzzle game focused on AI Safety concepts. Group related terms while learning about artificial intelligence safety and alignment!

Игра-головоломка в стиле Connections, посвященная концепциям безопасности ИИ. Группируйте связанные термины, изучая безопасность и согласованность искусственного интеллекта!

---

## 🇺🇸 English Version

### 🎮 How to Play

#### Objective
- **Normal mode:** Find **4 groups of 4 concepts** that share a common theme.
- **Advanced mode:** Find **3 groups of 4** (plus 4 decoys). Fewer categories, trickier!

Each group has a different difficulty level:

- 🟡 **Easy** - More obvious connections
- 🔵 **Medium** - Requires some AI safety knowledge  
- 🟣 **Hard** - Subtle philosophical connections
- 🔴 **Harder** - (Normal mode only) Most challenging

#### Gameplay
1. **Select 4 tiles** that you think belong to the same category
2. **Click Submit** to check your grouping
3. **Be careful!** You only have **4 attempts** total
4. **Watch the dog** - it reacts to your progress!

#### Features
- **Normal / Advanced** - Toggle between 4-category and 3-category (with decoys) modes
- **Timer & score** - Each game is timed; score is based on correct groups, mistakes, and speed
- **Leaderboard** - Save your name when you win; best scores stored on your device
- **Hover (or tap on mobile)** over concepts to see definitions when hints are ON
- **Dictionary** with all concept explanations
- **Sound effects** for correct, wrong, win, and lose
- **Interactive dog** that celebrates or worries with you
- **Educational** - learn about AI safety while playing
- **URL options** - Open with `?mode=advanced` or `?mode=normal`; use `?guide=0` to skip the first-time guide

#### The AI Safety Dog 🐕
Your canine companion shows different emotions:
- 😊 **Happy Dog** (`happy_dog.png`) - When you get answers right
- 😟 **Sad Dog** (`sad_dog.png`) - When you make mistakes  
- 🎉 **Celebrating** - When you solve puzzles
- 😴 **Sleeping** - When the game ends

### 🌐 Deploying to GitHub Pages

**Option A – Deploy from a branch (simplest)**  
1. Push this repo to GitHub (include `configs/category-templates.json` so puzzles load correctly).  
2. Open **Settings → Pages**.  
3. Under **Source**, choose **Deploy from a branch**.  
4. Branch: **main** (or **master**), Folder: **/ (root)**.  
5. Save. The site will be at `https://<username>.github.io/<repo-name>/`.

**Option B – Deploy with GitHub Actions**  
1. Push the repo and ensure **Settings → Pages → Source** is set to **GitHub Actions**.  
2. The included workflow (`.github/workflows/pages.yml`) will deploy the root on every push to `main`.

### 🚀 Running the Game Locally

#### Prerequisites
- Python 3.x (usually pre-installed on Mac/Linux)

#### Quick Start
1. **Download or clone** this repository
2. **Open terminal/command prompt** in the project folder
3. **Run the local server**:
   ```bash
   python -m http.server 8000
   ```
4. **Open your browser** to: `http://localhost:8000`

#### Alternative Methods
**With Node.js:**
```bash
npx http-server -p 8000
```

**With PHP:**
```bash
php -S localhost:8000
```

**With VS Code:**
- Install the "Live Server" extension
- Right-click `index.html` and select "Open with Live Server"

### 🗂️ Project Structure
```
ai-safety-connections/
├── index.html          # Main game interface
├── css/
│   ├── style.css       # Game styles and layout
│   └── animations.css  # Dog and effect animations
├── js/
│   ├── game.js         # Main game logic
│   ├── puzzle-generator.js # Puzzle creation
│   ├── tooltip.js      # Concept hover tooltips
│   ├── dog-animations.js   # Dog behavior and animations
│   ├── sounds.js       # Web Audio sound effects
│   └── config.js       # Game configuration and data
├── configs/
│   └── category-templates.json # Category definitions
├── images/
│   ├── favicon.svg     # Site icon
│   ├── happy_dog.png   # Happy dog image
│   └── sad_dog.png     # Sad dog image
└── README.md          # This file
```

### 🎯 Tips for Success
- Look for both **technical and thematic** connections
- Some concepts might fit **multiple plausible groups**
- Use the **Dictionary** for quick reference
- **Think critically** about both meaning and context
- **Hover before selecting** to understand unfamiliar terms

### 🔧 Troubleshooting
- **CORS errors?** You must use a local server, not direct file opening
- **Images not loading?** Check filenames match exactly in `images/` folder
- **JavaScript errors?** Check browser console (F12) for details

### 📚 Learning Resources
The game covers concepts from:
- AI Alignment research
- AI Safety philosophy  
- AI Governance approaches
- Societal impacts of AI

---

## 🇷🇺 Русская Версия

### 🎮 Как играть

#### Цель игры
Найдите **3 группы по 4 концепции**, которые объединены общей темой. Каждая группа имеет свой уровень сложности:

- 🟡 **Легкий** - Более очевидные связи
- 🔵 **Средний** - Требует некоторых знаний о безопасности ИИ  
- 🟣 **Сложный** - Сложные философские связи

#### Игровой процесс
1. **Выберите 4 плитки**, которые, по вашему мнению, относятся к одной категории
2. **Нажмите "Submit"** чтобы проверить свою группу
3. **Будьте осторожны!** У вас всего **4 попытки**
4. **Следите за собакой** - она реагирует на ваш прогресс!

#### Особенности
- **Наведите курсор на концепции** чтобы увидеть определения
- **Словарь** со всеми объяснениями концепций
- **Интерактивная собака**, которая радуется или переживает вместе с вами
- **Образовательная** - изучайте безопасность ИИ во время игры

#### Собака безопасности ИИ 🐕
Ваш собачий компаньон показывает разные эмоции:
- 😊 **Счастливая собака** (`happy_dog.png`) - Когда вы даете правильные ответы
- 😟 **Грустная собака** (`sad_dog.png`) - Когда вы ошибаетесь  
- 🎉 **Празднует** - Когда вы решаете головоломки
- 😴 **Спит** - Когда игра заканчивается

### 🚀 Запуск игры локально

#### Предварительные требования
- Python 3.x (обычно предустановлен на Mac/Linux)

#### Быстрый старт
1. **Скачайте или клонируйте** этот репозиторий
2. **Откройте терминал/командную строку** в папке проекта
3. **Запустите локальный сервер**:
   ```bash
   python -m http.server 8000
   ```
4. **Откройте браузер** по адресу: `http://localhost:8000`

#### Альтернативные методы
**С Node.js:**
```bash
npx http-server -p 8000
```

**С PHP:**
```bash
php -S localhost:8000
```

**С VS Code:**
- Установите расширение "Live Server"
- Нажмите правой кнопкой на `index.html` и выберите "Open with Live Server"

### 🗂️ Структура проекта
```
ai-safety-connections/
├── index.html          # Основной интерфейс игры
├── css/
│   ├── style.css       # Стили и макет игры
│   └── animations.css  # Анимации собаки и эффектов
├── js/
│   ├── game.js         # Основная логика игры
│   ├── puzzle-generator.js # Создание головоломок
│   ├── tooltip.js      # Всплывающие подсказки концепций
│   ├── dog-animations.js   # Поведение и анимации собаки
│   └── config.js       # Конфигурация и данные игры
├── images/
│   ├── happy_dog.png   # Изображение счастливой собаки
│   └── sad_dog.png     # Изображение грустной собаки
└── README.md          # Этот файл
```

### 🎯 Советы для успеха
- Ищите как **технические, так и тематические** связи
- Некоторые концепции могут подходить **к нескольким группам**
- Используйте **Словарь** для быстрой справки
- **Думайте критически** о значении и контексте
- **Наводите курсор перед выбором** чтобы понять незнакомые термины

### 🔧 Решение проблем
- **Ошибки CORS?** Вы должны использовать локальный сервер, а не открывать файл напрямую
- **Изображения не загружаются?** Проверьте, что имена файлов точно совпадают в папке `images/`
- **Ошибки JavaScript?** Проверьте консоль браузера (F12) для деталей

### 📚 Ресурсы для обучения
Игра охватывает концепции из:
- Исследований по согласованию ИИ
- Философии безопасности ИИ  
- Подходов к управлению ИИ
- Социальных последствий ИИ

---

**Play, learn, and help keep the AI Safety Dog happy! 🐕💫**

**Играйте, изучайте и помогайте собаке безопасности ИИ оставаться счастливой! 🐕💫**
