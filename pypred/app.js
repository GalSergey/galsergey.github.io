/**
 * PyPred Evaluator Application
 * Веб-приложение для оценки Python-подобных предикатов
 */

// Конфигурация приложения
const CONFIG = {
    API_BASE_URL: 'https://far.ddns.me:8000',
    MONACO_VERSION: '0.45.0',
    RENDER_DELAY: 1000, // Задержка рендеринга в миллисекундах
    STORAGE_KEYS: {
        PREDICATE: 'pypred_predicate',
        DATA: 'pypred_data',
        SAVED_TEMPLATES: 'pypred_saved_templates'
    }
};

// Примеры данных
const EXAMPLE_DATA = {
    predicate: `x > 5 and y < 30`,
    jsonData: `{
  "x": 10,
  "y": 20
}`
};

// Инициализация Monaco Editor
require.config({ 
    paths: { 
        vs: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${CONFIG.MONACO_VERSION}/min/vs` 
    } 
});

require(['vs/editor/editor.main'], function (monaco) {
    
    // Создание редакторов
    const predicateEditor = monaco.editor.create(document.getElementById('top-left'), {
        value: EXAMPLE_DATA.predicate,
        language: 'text',
        fontSize: 14,
        wordWrap: "on",
        glyphMargin: true,
        minimap: { enabled: false },
        unicodeHighlight: {
            ambiguousCharacters: false,
            invisibleCharacters: false,
            nonBasicASCII: false
        }
    });

    const dataEditor = monaco.editor.create(document.getElementById('bottom-left'), {
        value: EXAMPLE_DATA.jsonData,
        language: 'json',
        fontSize: 14,
        wordWrap: "on",
        minimap: { enabled: false },
        unicodeHighlight: {
            ambiguousCharacters: false,
            invisibleCharacters: false,
            nonBasicASCII: false
        }
    });

    const outputEditor = monaco.editor.create(document.getElementById('right'), {
        value: '',
        language: 'json',
        theme: 'vs-dark',
        fontSize: 14,
        wordWrap: "on",
        minimap: { enabled: false },
        unicodeHighlight: {
            ambiguousCharacters: false,
            invisibleCharacters: false,
            nonBasicASCII: false
        },
        readOnly: true
    });

    // Функция рендеринга предиката
    async function renderPredicate() {
        const condition = predicateEditor.getValue().replaceAll(/\n|\r/g, ' ');
        console.log('Evaluating condition:', condition);
        
        let data = dataEditor.getValue();
        try {
            data = JSON.parse(data);
        } catch (error) {
            outputEditor.setValue("// Ошибка во входных данных:\n" + error.message);
            return;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/predicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ condition, data })
            });
            
            const result = await response.json();

            if (result.ok) {
                outputEditor.setValue(result.result.toString());
            } else {
                outputEditor.setValue("// Ошибка решения\n" + result.errors.map(i => i));
            }
        } catch (error) {
            outputEditor.setValue("// Ошибка сети:\n" + error.message);
        }
    }

    // Функции управления шаблонами
    function loadSavedTemplates() {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SAVED_TEMPLATES);
        return saved ? JSON.parse(saved) : {};
    }

    function saveTemplates(templates) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_TEMPLATES, JSON.stringify(templates));
    }

    function updateTemplateSelect() {
        const templates = loadSavedTemplates();
        const select = document.getElementById('template-select');
        
        // Очищаем опции кроме первой
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Добавляем сохраненные шаблоны
        Object.keys(templates).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    function saveTemplate() {
        const name = document.getElementById('template-name').value.trim();
        if (!name) {
            alert('Введите имя шаблона');
            return;
        }

        const templates = loadSavedTemplates();
        templates[name] = {
            predicate: predicateEditor.getValue(),
            data: dataEditor.getValue(),
            timestamp: new Date().toISOString()
        };
        
        saveTemplates(templates);
        updateTemplateSelect();
        document.getElementById('template-name').value = '';
        alert(`Шаблон "${name}" сохранен`);
    }

    function loadTemplate() {
        const name = document.getElementById('template-select').value;
        if (!name) return;

        const templates = loadSavedTemplates();
        const template = templates[name];
        
        if (template) {
            predicateEditor.setValue(template.predicate);
            dataEditor.setValue(template.data);
            document.getElementById('template-name').value = name;
        }
    }

    function deleteTemplate() {
        const name = document.getElementById('template-select').value;
        if (!name) {
            alert('Выберите шаблон для удаления');
            return;
        }

        if (confirm(`Удалить шаблон "${name}"?`)) {
            const templates = loadSavedTemplates();
            delete templates[name];
            saveTemplates(templates);
            updateTemplateSelect();
            document.getElementById('template-name').value = '';
            alert(`Шаблон "${name}" удален`);
        }
    }

    function resetToExamples() {
        if (confirm('Сбросить к примерам? Все несохраненные изменения будут потеряны.')) {
            predicateEditor.setValue(EXAMPLE_DATA.predicate);
            dataEditor.setValue(EXAMPLE_DATA.jsonData);
            document.getElementById('template-name').value = '';
            document.getElementById('template-select').value = '';
            
            // Очищаем сохраненные данные
            localStorage.removeItem(CONFIG.STORAGE_KEYS.PREDICATE);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.DATA);
        }
    }

    // Функции автосохранения
    function saveToStorage() {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PREDICATE, predicateEditor.getValue());
        localStorage.setItem(CONFIG.STORAGE_KEYS.DATA, dataEditor.getValue());
    }

    function loadFromStorage() {
        const savedPredicate = localStorage.getItem(CONFIG.STORAGE_KEYS.PREDICATE);
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEYS.DATA);
        
        if (savedPredicate) {
            predicateEditor.setValue(savedPredicate);
        }
        if (savedData) {
            dataEditor.setValue(savedData);
        }
    }

    // Обработчики событий для управления шаблонами
    document.getElementById('save-template-btn').addEventListener('click', saveTemplate);
    document.getElementById('load-template-btn').addEventListener('click', loadTemplate);
    document.getElementById('delete-template-btn').addEventListener('click', deleteTemplate);
    document.getElementById('reset-btn').addEventListener('click', resetToExamples);
    
    // Обработчик Enter для быстрого сохранения
    document.getElementById('template-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveTemplate();
        }
    });

    // Обработчики событий для автосохранения
    let saveTimeout;
    predicateEditor.onDidChangeModelContent(() => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToStorage, CONFIG.RENDER_DELAY);
        renderPredicate();
    });
    
    dataEditor.onDidChangeModelContent(() => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToStorage, CONFIG.RENDER_DELAY);
        renderPredicate();
    });
    
    // Инициализация
    updateTemplateSelect();
    loadFromStorage();
    
    // Первоначальный рендеринг
    renderPredicate();

    // Обработка изменения размера окна
    window.addEventListener("resize", () => {
        predicateEditor.layout();
        dataEditor.layout();
        outputEditor.layout();
    });

    // ResizeObserver для автоматического изменения размера редакторов
    const editors = [
        { editor: predicateEditor, container: document.getElementById("top-left") },
        { editor: dataEditor, container: document.getElementById("bottom-left") },
        { editor: outputEditor, container: document.getElementById("right") }
    ];

    const resizeObserver = new ResizeObserver(() => {
        editors.forEach(({ editor }) => editor.layout());
    });

    editors.forEach(({ container }) => resizeObserver.observe(container));
});
