/**
 * PyPred Evaluator Application
 * Веб-приложение для оценки Python-подобных предикатов
 */

// Конфигурация приложения
const CONFIG = {
    API_BASE_URL: 'https://far.ddns.me:8000',
    MONACO_VERSION: '0.45.0',
    RENDER_DELAY: 1000, // Задержка рендеринга в миллисекундах
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

    // Обработчики событий
    predicateEditor.onDidChangeModelContent(renderPredicate);
    dataEditor.onDidChangeModelContent(renderPredicate);
    
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
