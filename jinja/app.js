/**
 * Jinja2 Renderer Application
 * Веб-приложение для рендеринга Jinja2 шаблонов
 */

// Конфигурация приложения
const CONFIG = {
    API_BASE_URL: 'https://far.ddns.me:8000',
    MONACO_VERSION: '0.45.0',
    JS_YAML_VERSION: '4.1.0',
    RENDER_DELAY: 1000, // Задержка рендеринга в миллисекундах
    STORAGE_KEYS: {
        TEMPLATE: 'jinja2_template',
        DATA: 'jinja2_data',
        JSONPATH: 'jinja2_jsonpath',
        OUTPUT_FORMAT: 'jinja2_output_format',
        SAVED_TEMPLATES: 'jinja2_saved_templates'
    }
};

// Примеры данных
const EXAMPLE_DATA = {
    template: `{%- set dialog = [] -%}
{%- for message in messages -%}
  {%- set dialog = dialog.append(authors[loop.index0]|replace('user','#### client\\n')|replace('support','#### support\\n') + message + '\\n') -%}
{%- endfor -%}
{%- set content = [
  "<DIALOG>\\n# Диалог между клиентом и саппортом:",
  dialog|join('\\n'), 
  "</DIALOG>\\n\\n<META>\\n# Мета-информация:",
  full_meta|join(), 
  "</META>\\n\\n\\nНАПИШИ ТОЛЬКО ОТВЕТ ПОЛЬЗОВАТЕЛЮ, НЕ НАДО РАЗМЫШЛЯТЬ!!! НЕ ДУБЛИРУЙ ДИАЛОГ В СВОЙ ОТВЕТ!!!"
] -%}

{
  "model": "anthropic/claude-sonnet-4",
  "system": [
        {
            "type": "text",
            "text": {{static_part_of_prompt|tojson}},
            "cache_control": {"type": "ephemeral", "ttl": "1h"}
        }
    ],
  "messages": [
    {
      "role": "user",
      "content": {{content|join('\\n')|tojson}}
    }
  ]
}`,
    json: `{
    "static_part_of_prompt": "Ты хороший GPT который хорошо делает свою работу.",
    "messages": ["Где заказы?","Посмотрите в приложении.","Спасибо!"],
    "authors": ["user","support","user"]
}`
};

/**
 * Регистрация языка Jinja2 в Monaco Editor
 */
function registerJinja2Language(monaco) {
    const id = 'jinja2';
    
    // Регистрация языка
    monaco.languages.register({
        id,
        extensions: ['.j2', '.jinja', '.jinja2', '.html.j2', '.tpl'],
        aliases: ['Jinja2', 'Jinja'],
        mimetypes: ['text/x-jinja2', 'text/jinja2'],
    });

    const keywords = [
        'if', 'elif', 'else', 'endif',
        'for', 'endfor', 'in', 'recursive', 'reversed', 'loop',
        'block', 'endblock', 'extends', 'include', 'import', 'from', 'with', 'without', 'context',
        'macro', 'endmacro', 'call', 'endcall',
        'filter', 'endfilter', 'set',
        'raw', 'endraw', 'trans', 'endtrans', 'do',
        'autoescape', 'endautoescape', 'scoped',
        'as', 'true', 'false', 'none', 'is', 'not', 'and', 'or', 'test', 'capture'
    ];

    const filtersAndTests = [
        'safe', 'escape', 'e', 'capitalize', 'lower', 'upper', 'title', 'trim', 'striptags', 'replace', 'default', 'd',
        'join', 'list', 'length', 'reverse', 'sort', 'unique', 'first', 'last', 'random', 'slice',
        'abs', 'round', 'int', 'float', 'string', 'format', 'urlencode', 'json', 'tojson',
        'map', 'select', 'reject', 'selectattr', 'rejectattr', 'min', 'max',
        'file_exists', 'defined', 'undefined', 'equalto', 'odd', 'even', 'divisibleby', 'iterable'
    ];

    // Настройка токенизатора
    monaco.languages.setMonarchTokensProvider(id, {
        defaultToken: '',
        tokenPostfix: '.jinja2',

        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
            { open: '[', close: ']', token: 'delimiter.bracket' },
        ],

        keywords,
        filters: filtersAndTests,

        operators: [
            '+', '-', '*', '/', '//', '%', '**', '~',
            '==', '!=', '>', '<', '>=', '<=',
            '=', '|', ':', ',', '.', '?', '??',
        ],

        symbols: /[=><!~?:&|+\-*\/%\^]+/,
        escapes: /\\(?:[abfnrtv\\"'`]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})/,
        digits: /\d+(_\d+)*/,
        identifier: /[A-Za-z_][\w]*/,

        tokenizer: {
            root: [
                [/\{#-?/, { token: 'comment.block.jinja', next: '@comment' }],
                [/\{\{-?/, { token: 'delimiter.brace-expression.jinja', next: '@output' }],
                [/\{%-?/, { token: 'delimiter.brace-statement.jinja', next: '@tag' }],
                [/[^\{]+/, ''],
                [/\{/, ''],
            ],

            comment: [
                [/-?#\}/, { token: 'comment.block.jinja', next: '@pop' }],
                [/./, 'comment.block.jinja']
            ],

            output: [
                [/-?\}\}/, { token: 'delimiter.brace-expression.jinja', next: '@pop' }],
                { include: '@expression' },
            ],

            tag: [
                [/(\s*)(raw)(\s*)(%}-?)/, ['', 'keyword.jinja', '', { token: 'delimiter.brace.jinja', next: '@rawBlock' }]],
                [/-?%\}/, { token: 'delimiter.brace-statement.jinja', next: '@pop' }],
                { include: '@expression' },
            ],

            rawBlock: [
                [/\{%-?\s*endraw\s*-?%\}/, { token: 'delimiter.brace.jinja', next: '@pop' }],
                [/./, '']
            ],

            expression: [
                [/\"([^\\\"]|@escapes)*\"/, 'string'],
                [/'([^\\']|@escapes)*'/, 'string'],
                [/`([^\\`]|@escapes)*`/, 'string'],
                [/(@digits\.@digits([eE][+\-]?@digits)?|@digits([eE][+\-]?@digits)?)/, 'number'],
                [/@symbols/, {
                    cases: {
                        '@operators': 'operator',
                        '@default': ''
                    }
                }],
                [/\|\s*@identifier/, {
                    cases: {
                        '@filters': 'predefined',
                        '@default': 'operator'
                    }
                }],
                [/(\bis\b)(\s+)(@identifier)/, ['keyword.jinja', '', {
                    cases: {
                        '@filters': 'predefined',
                        '@default': 'type.identifier'
                    }
                }]],
                [/@identifier/, {
                    cases: {
                        '@keywords': 'keyword.jinja',
                        '@default': 'variable'
                    }
                }],
                [/\(|\)|\[|\]|\{|\}|\.|,|:|;/, 'delimiter']
            ],
        }
    });

    // Конфигурация языка
    monaco.languages.setLanguageConfiguration(id, {
        comments: {
            blockComment: ['{#', '#}'],
        },
        autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"', notIn: ['string'] },
            { open: "'", close: "'", notIn: ['string'] },
            { open: '`', close: '`', notIn: ['string'] },
            { open: '{{ ', close: ' }}' },
            { open: '{% ', close: ' %}' },
            { open: '{# ', close: ' #}' },
        ],
        surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
            { open: '`', close: '`' },
        ],
        folding: {
            offSide: false,
            markers: {
                start: /^\s*\{%-?\s*(if|for|macro|block|filter|call|raw|autoescape)\b.*/,
                end: /^\s*\{%-?\s*end(if|for|macro|block|filter|call|raw|autoescape)\b.*-?%\}/,
            }
        },
        brackets: [['{%', '%}'], ['{{', '}}'], ['{', '}'], ['[', ']'], ['(', ')']]
    });

    // Создание темы
    monaco.editor.defineTheme("jinja", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "json", foreground: 'ffd700' },
            { token: "json2", foreground: 'da70d6' },
            { token: "json3", foreground: '179fff' },
            { token: "delimiter.brace-expression.jinja", foreground: "da70d6" },
            { token: "delimiter.brace-statement.jinja", foreground: "da70d6" },
            { token: "delimiter.brace.jinja", foreground: "da70d6" },
        ],
        colors: {},
    });

    // Регистрация провайдеров
    registerCompletionProvider(monaco, id, keywords, filtersAndTests);
    registerFoldingProvider(monaco, id);
    registerHoverProvider(monaco, id, keywords, filtersAndTests);
    registerFormattingProvider(monaco, id);
}

/**
 * Регистрация провайдера автодополнения
 */
function registerCompletionProvider(monaco, id, keywords, filtersAndTests) {
    monaco.languages.registerCompletionItemProvider(id, {
        triggerCharacters: ['{', '%', '|', ' '],
        provideCompletionItems(model, position) {
            const suggestions = [];

            // Теги
            suggestions.push(
                ...['if', 'for', 'block', 'macro', 'filter', 'call', 'set', 'with', 'trans', 'raw', 'autoescape', 'extends', 'include', 'import', 'from']
                    .map(label => ({
                        label: `{% ${label} %}`,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: `{% ${label} $0 %}`,
                        range: undefined,
                    }))
            );

            // Закрывающие теги
            suggestions.push(
                ...['endif', 'endfor', 'endblock', 'endmacro', 'endfilter', 'endcall', 'endraw', 'endautoescape']
                    .map(label => ({
                        label: `{% ${label} %}`,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: `{% ${label} %}`,
                        range: undefined,
                    }))
            );

            // Вывод
            suggestions.push({
                label: '{{ … }}',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '{{ ${1:var} }}',
            });

            // Фильтры
            suggestions.push(
                ...filtersAndTests.map(f => ({
                    label: `| ${f}`,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: `| ${f}`,
                }))
            );

            return { suggestions };
        },
    });
}

/**
 * Регистрация провайдера сворачивания
 */
function registerFoldingProvider(monaco, id) {
    monaco.languages.registerFoldingRangeProvider(id, {
        provideFoldingRanges(model) {
            const lines = model.getLineCount();
            const starts = [];
            const ranges = [];
            const startRegex = /\{%-?\s*(if|for|block|macro|filter|call|raw|autoescape)\b/;
            const endRegex = /\{%-?\s*end(if|for|block|macro|filter|call|raw|autoescape)\b.*%\}/;

            for (let i = 1; i <= lines; i++) {
                const text = model.getLineContent(i);
                if (startRegex.test(text)) {
                    starts.push(i);
                } else if (endRegex.test(text)) {
                    const start = starts.pop();
                    if (start) {
                        const end = i;
                        if (end > start) ranges.push({ start, end, kind: monaco.languages.FoldingRangeKind.Region });
                    }
                }
            }
            return ranges;
        }
    });
}

/**
 * Регистрация провайдера подсказок
 */
function registerHoverProvider(monaco, id, keywords, filtersAndTests) {
    monaco.languages.registerHoverProvider(id, {
        provideHover(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;
            const text = word.word;
            if (keywords.includes(text)) {
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [{ value: `**Jinja2 keyword**: \\\`${text}\\\`` }]
                };
            }
            if (filtersAndTests.includes(text)) {
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [{ value: `**Jinja2 filter/test**: \\\`${text}\\\`` }]
                };
            }
            return null;
        }
    });
}

/**
 * Регистрация провайдера форматирования
 */
function registerFormattingProvider(monaco, id) {
    monaco.languages.registerDocumentFormattingEditProvider(id, {
        provideDocumentFormattingEdits(model, options) {
            const indentSize = options.tabSize || 2;
            let text = model.getValue();

            // Выделяем теги Jinja и заменяем их на маркеры
            const tagRegex = /(\{\{.*?\}\}|\{%-?[\s\S]*?%-?\})/g;
            let parts = [];
            let lastIndex = 0;
            let match;
            while ((match = tagRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({ type: 'json', value: text.slice(lastIndex, match.index) });
                }
                parts.push({ type: 'jinja', value: match[0] });
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < text.length) {
                parts.push({ type: 'json', value: text.slice(lastIndex) });
            }

            // Форматируем каждую часть отдельно
            parts = parts.map(part => {
                if (part.type === 'json') {
                    let trimmed = part.value.trim();
                    if (!trimmed) return part;
                    try {
                        const parsed = JSON.parse(trimmed);
                        part.value = '\n' + JSON.stringify(parsed, null, indentSize) + '\n';
                    } catch {
                        // если это невалидный JSON — оставляем как есть
                    }
                } else if (part.type === 'jinja') {
                    let lines = part.value.split('\n');
                    let indent = 0;
                    lines = lines.map(line => {
                        const trimmed = line.trim();
                        if (/^\{%-?\s*end\w+/.test(trimmed)) indent = Math.max(indent - 1, 0);
                        const res = ' '.repeat(indent * indentSize) + trimmed;
                        if (/^\{%-?\s*(if|for|block|macro|filter|call|raw|autoescape)\b/.test(trimmed) && !/end\w+/.test(trimmed)) {
                            indent++;
                        }
                        return res;
                    });
                    part.value = lines.join('\n');
                }
                return part;
            });

            // Склеиваем обратно
            const formattedText = parts.map(p => p.value).join('');

            return [{
                range: model.getFullModelRange(),
                text: formattedText
            }];
        }
    });
}

/**
 * Класс для управления редакторами
 */
class EditorManager {
    constructor() {
        this.editors = {};
        this.output = '';
        this.renderTimeout = null;
        this.saveTimeout = null;
        this.init();
    }

    init() {
        this.createEditors();
        this.setupEventListeners();
        this.setupResizeObserver();
    }

    createEditors() {
        const editorConfig = {
            theme: 'vs-dark',
            fontSize: 14,
            wordWrap: "on",
            minimap: { enabled: false },
            unicodeHighlight: {
                ambiguousCharacters: false,
                invisibleCharacters: false,
                nonBasicASCII: false
            }
        };

        // Загружаем сохраненные данные
        const savedData = this.loadFromStorage();

        // Создание редакторов с сохраненными данными
        this.editors.template = monaco.editor.create(document.getElementById('top-left'), {
            ...editorConfig,
            value: savedData.template,
            language: 'jinja2',
        });

        this.editors.data = monaco.editor.create(document.getElementById('bottom-left'), {
            ...editorConfig,
            value: savedData.data,
            language: 'json',
        });

        this.editors.output = monaco.editor.create(document.getElementById('top-right'), {
            ...editorConfig,
            value: '',
            language: 'json',
            theme: 'jinja',
            readOnly: true
        });

        this.editors.text = monaco.editor.create(document.getElementById('bottom-right'), {
            ...editorConfig,
            value: '',
            language: 'json',
            theme: 'jinja',
            readOnly: true
        });

        // Инициализируем остальные элементы интерфейса
        this.initializeUI(savedData);
    }

    /**
     * Инициализация элементов интерфейса с сохраненными данными
     */
    initializeUI(savedData) {
        // Устанавливаем JSONPath
        document.getElementById('jsonpath').value = savedData.jsonpath;
        
        // Устанавливаем формат вывода
        const formatRadio = document.querySelector(`input[name="output-format"][value="${savedData.outputFormat}"]`);
        if (formatRadio) {
            formatRadio.checked = true;
        }

        // Инициализируем список шаблонов
        this.updateTemplateSelect();
    }

    setupEventListeners() {
        // Обработчики изменений в редакторах с debouncing
        this.editors.template.onDidChangeModelContent(() => this.debouncedRenderTemplate());
        this.editors.data.onDidChangeModelContent(() => this.debouncedRenderTemplate());

        // Обработчик изменения формата вывода
        document.querySelectorAll('input[name="output-format"]').forEach(input => {
            input.addEventListener("change", () => {
                this.renderOutput(this.output);
                this.saveToStorage();
            });
        });

        // Обработчик изменения JSONPath
        document.getElementById("jsonpath").addEventListener("input", () => {
            this.renderJsonPath(this.output);
            this.saveToStorage(); // Сохраняем изменения
        });

        // Обработчики кнопок управления шаблонами
        document.getElementById("save-template-btn").addEventListener("click", () => {
            this.saveTemplate();
        });

        document.getElementById("load-template-btn").addEventListener("click", () => {
            this.loadTemplate();
        });

        document.getElementById("delete-template-btn").addEventListener("click", () => {
            this.deleteTemplate();
        });

        document.getElementById("reset-btn").addEventListener("click", () => {
            this.resetToExamples();
        });

        // Обработчик изменения выбора шаблона
        document.getElementById("template-select").addEventListener("change", () => {
            const select = document.getElementById("template-select");
            const templateName = select.value;
            if (templateName) {
                document.getElementById("template-name").value = templateName;
            }
        });

        // Обработчик Enter в поле имени шаблона
        document.getElementById("template-name").addEventListener("keypress", (e) => {
            if (e.key === 'Enter') {
                this.saveTemplate();
            }
        });

        // Обработчик изменения размера окна
        window.addEventListener("resize", () => this.layoutEditors());
        
        // Автоматическое сохранение при изменении данных
        this.setupAutoSave();
        
        // Очистка таймера при закрытии страницы
        window.addEventListener("beforeunload", () => {
            if (this.renderTimeout) {
                clearTimeout(this.renderTimeout);
            }
            this.saveToStorage(); // Сохраняем данные перед закрытием
        });
    }

    setupResizeObserver() {
        const editors = [
            { editor: this.editors.template, container: document.getElementById("top-left") },
            { editor: this.editors.data, container: document.getElementById("bottom-left") },
            { editor: this.editors.output, container: document.getElementById("top-right") },
            { editor: this.editors.text, container: document.getElementById("bottom-right") }
        ];

        const resizeObserver = new ResizeObserver(() => {
            editors.forEach(({ editor }) => editor.layout());
        });

        editors.forEach(({ container }) => resizeObserver.observe(container));
    }

    /**
     * Настройка автоматического сохранения
     */
    setupAutoSave() {
        // Сохраняем при изменении редакторов (с небольшой задержкой)
        this.editors.template.onDidChangeModelContent(() => {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.saveToStorage(), 1000);
        });

        this.editors.data.onDidChangeModelContent(() => {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.saveToStorage(), 1000);
        });
    }

    layoutEditors() {
        Object.values(this.editors).forEach(editor => editor.layout());
    }

    getSelectedFormat() {
        return document.querySelector('input[name="output-format"]:checked').value;
    }

    /**
     * Сохранение данных в Local Storage
     */
    saveToStorage() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.TEMPLATE, this.editors.template.getValue());
            localStorage.setItem(CONFIG.STORAGE_KEYS.DATA, this.editors.data.getValue());
            localStorage.setItem(CONFIG.STORAGE_KEYS.JSONPATH, document.getElementById('jsonpath').value);
            localStorage.setItem(CONFIG.STORAGE_KEYS.OUTPUT_FORMAT, this.getSelectedFormat());
        } catch (error) {
            console.warn('Не удалось сохранить данные в Local Storage:', error);
        }
    }

    /**
     * Загрузка данных из Local Storage
     */
    loadFromStorage() {
        try {
            const template = localStorage.getItem(CONFIG.STORAGE_KEYS.TEMPLATE);
            const data = localStorage.getItem(CONFIG.STORAGE_KEYS.DATA);
            const jsonpath = localStorage.getItem(CONFIG.STORAGE_KEYS.JSONPATH);
            const outputFormat = localStorage.getItem(CONFIG.STORAGE_KEYS.OUTPUT_FORMAT);

            return {
                template: template || EXAMPLE_DATA.template,
                data: data || EXAMPLE_DATA.json,
                jsonpath: jsonpath || '$.messages[0].content',
                outputFormat: outputFormat || 'json'
            };
        } catch (error) {
            console.warn('Не удалось загрузить данные из Local Storage:', error);
            return {
                template: EXAMPLE_DATA.template,
                data: EXAMPLE_DATA.json,
                jsonpath: '$.messages[0].content',
                outputFormat: 'json'
            };
        }
    }

    /**
     * Очистка сохраненных данных
     */
    clearStorage() {
        try {
            Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.warn('Не удалось очистить Local Storage:', error);
        }
    }

    /**
     * Сброс к примерам
     */
    resetToExamples() {
        this.editors.template.setValue(EXAMPLE_DATA.template);
        this.editors.data.setValue(EXAMPLE_DATA.json);
        document.getElementById('jsonpath').value = '$.messages[0].content';
        
        // Устанавливаем формат JSON
        const jsonRadio = document.querySelector('input[name="output-format"][value="json"]');
        if (jsonRadio) {
            jsonRadio.checked = true;
        }
        
        // Очищаем поле имени шаблона
        document.getElementById('template-name').value = '';
        
        // Сохраняем сброшенные данные
        this.saveToStorage();
        
        // Запускаем рендеринг
        this.renderTemplate();
    }

    /**
     * Получить список сохраненных шаблонов
     */
    getSavedTemplates() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SAVED_TEMPLATES);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('Не удалось загрузить сохраненные шаблоны:', error);
            return {};
        }
    }

    /**
     * Сохранить шаблон с именем
     */
    saveTemplate() {
        const name = document.getElementById('template-name').value.trim();
        if (!name) {
            alert('Введите имя шаблона');
            return;
        }

        const templates = this.getSavedTemplates();
        const templateData = {
            template: this.editors.template.getValue(),
            data: this.editors.data.getValue(),
            jsonpath: document.getElementById('jsonpath').value,
            outputFormat: this.getSelectedFormat(),
            timestamp: new Date().toISOString()
        };

        templates[name] = templateData;

        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_TEMPLATES, JSON.stringify(templates));
            this.updateTemplateSelect();
            alert(`Шаблон "${name}" сохранен`);
        } catch (error) {
            console.error('Не удалось сохранить шаблон:', error);
            alert('Ошибка при сохранении шаблона');
        }
    }

    /**
     * Загрузить выбранный шаблон
     */
    loadTemplate() {
        const select = document.getElementById('template-select');
        const templateName = select.value;
        
        if (!templateName) {
            alert('Выберите шаблон для загрузки');
            return;
        }

        const templates = this.getSavedTemplates();
        const templateData = templates[templateName];

        if (!templateData) {
            alert('Шаблон не найден');
            return;
        }

        // Загружаем данные шаблона
        this.editors.template.setValue(templateData.template);
        this.editors.data.setValue(templateData.data);
        document.getElementById('jsonpath').value = templateData.jsonpath;
        
        // Устанавливаем формат вывода
        const formatRadio = document.querySelector(`input[name="output-format"][value="${templateData.outputFormat}"]`);
        if (formatRadio) {
            formatRadio.checked = true;
        }

        // Устанавливаем имя в поле
        document.getElementById('template-name').value = templateName;

        // Сохраняем в основное хранилище
        this.saveToStorage();

        // Запускаем рендеринг
        this.renderTemplate();
    }

    /**
     * Удалить выбранный шаблон
     */
    deleteTemplate() {
        const select = document.getElementById('template-select');
        const templateName = select.value;
        
        if (!templateName) {
            alert('Выберите шаблон для удаления');
            return;
        }

        if (!confirm(`Удалить шаблон "${templateName}"?`)) {
            return;
        }

        const templates = this.getSavedTemplates();
        delete templates[templateName];

        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SAVED_TEMPLATES, JSON.stringify(templates));
            this.updateTemplateSelect();
            alert(`Шаблон "${templateName}" удален`);
        } catch (error) {
            console.error('Не удалось удалить шаблон:', error);
            alert('Ошибка при удалении шаблона');
        }
    }

    /**
     * Обновить список шаблонов в select
     */
    updateTemplateSelect() {
        const select = document.getElementById('template-select');
        const templates = this.getSavedTemplates();
        
        // Очищаем список
        select.innerHTML = '<option value="">Выберите шаблон</option>';
        
        // Добавляем сохраненные шаблоны
        Object.keys(templates).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    /**
     * Debounced рендеринг - ждет 3 секунды после последнего изменения
     */
    debouncedRenderTemplate() {
        // Очищаем предыдущий таймер
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        
        // Устанавливаем новый таймер на указанное время
        this.renderTimeout = setTimeout(() => {
            this.renderTemplate();
        }, CONFIG.RENDER_DELAY);
    }

    async renderTemplate() {
        const template = this.editors.template.getValue();
        let data;
        
        try {
            data = JSON.parse(this.editors.data.getValue());
        } catch (error) {
            this.editors.output.setValue("// Ошибка во входных данных:\n" + error.message);
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/render`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template, data })
            });
            const result = await response.json();

            if (result.ok) {
                this.renderOutput(result.result);
            } else {
                this.editors.output.setValue("// Ошибка рендеринга\n" + result.error);
            }
        } catch (error) {
            this.editors.output.setValue("// Ошибка сети:\n" + error.message);
        }
    }

    renderOutput(rawText) {
        let formatted = rawText;

        try {
            const format = this.getSelectedFormat();

            if (format === "json") {
                const parsed = JSON.parse(rawText);
                formatted = JSON.stringify(parsed, null, 2);
                this.output = formatted;
            } else {
                try {
                    formatted = formatted.replace(/\\u[0-9a-fA-F]{4}/g, match => {
                        return String.fromCharCode(parseInt(match.slice(2), 16));
                    });
                    this.output = formatted;
                } catch (error) {
                    formatted = error.message;
                }
            }
        } catch (error) {
            formatted = "// Ошибка в шаблоне\n" + error.message + "\n\n" + formatted;
        }

        this.editors.output.setValue(formatted);
        this.renderJsonPath(this.output);
    }

    async renderJsonPath(rawText) {
        if (!rawText) return;
        
        const json = rawText;
        const path = document.getElementById("jsonpath").value;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/jsonpath`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ "json": JSON.parse(json), "path": path })
            });
            const result = await response.json();
            
            if (result.error) {
                this.editors.text.setValue(result.error);
            } else {
                this.editors.text.setValue(result.result[0] ? result.result[0] : "Unknown JSONPath");
            }
        } catch (error) {
            this.editors.text.setValue("// Ошибка JSONPath:\n" + error.message);
        }
    }
}

/**
 * Инициализация приложения
 */
function initializeApp() {
    require.config({ 
        paths: { 
            vs: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${CONFIG.MONACO_VERSION}/min/vs` 
        } 
    });
    
    require(['vs/editor/editor.main'], function (monaco) {
        // Регистрируем язык Jinja2
        registerJinja2Language(monaco);
        
        // Создаем менеджер редакторов
        window.editorManager = new EditorManager();
        
        // Первоначальный рендеринг (без debouncing)
        window.editorManager.renderTemplate();
    });
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', initializeApp);
