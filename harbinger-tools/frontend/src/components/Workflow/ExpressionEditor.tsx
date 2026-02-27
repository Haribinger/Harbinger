import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount, BeforeMount, Monaco } from '@monaco-editor/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Derive sub-namespace types from the Monaco type that @monaco-editor/react
// exposes, so we don't need `monaco-editor` as a direct dependency.
type MonacoEditor = Monaco['editor'];
type IStandaloneCodeEditor = ReturnType<MonacoEditor['create']>;
type ITextModel = NonNullable<ReturnType<IStandaloneCodeEditor['getModel']>>;
type IMarkerData = Parameters<MonacoEditor['setModelMarkers']>[2][number];
type IDisposable = ReturnType<Monaco['languages']['registerCompletionItemProvider']>;

interface AvailableNode {
  id: string;
  label: string;
}

interface ExpressionEditorProps {
  value: string;
  onChange: (val: string) => void;
  availableNodes?: AvailableNode[];
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Constants — expression language grammar tokens
// ---------------------------------------------------------------------------

const LANGUAGE_ID = 'harbinger-expr';
const THEME_ID = 'harbinger-expr-dark';

// Built-in context paths available in every workflow
const PREV_SUGGESTIONS = ['prev.output', 'prev.status'];
const TRIGGER_SUGGESTIONS = [
  'trigger.data',
  'trigger.data.url',
  'trigger.data.method',
  'trigger.data.headers',
  'trigger.data.body',
  'trigger.data.params',
  'trigger.data.query',
];
const ENV_SUGGESTIONS = [
  'env.API_KEY',
  'env.TARGET',
  'env.SCOPE',
  'env.WEBHOOK_URL',
  'env.PROXY',
  'env.TIMEOUT',
];
const FILTER_SUGGESTIONS = ['count', 'first', 'uppercase', 'json', 'length'];

// Track whether we already registered the language globally so hot-reload
// does not throw duplicate registration errors.
let languageRegistered = false;

// ---------------------------------------------------------------------------
// Language registration — runs once per Monaco instance
// ---------------------------------------------------------------------------

function registerExpressionLanguage(monaco: Monaco) {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: LANGUAGE_ID });

  // Monarch tokenizer: highlights {{...}} blocks and pipe filters
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    tokenizer: {
      root: [
        // Opening double braces
        [/\{\{/, { token: 'delimiter.expression', next: '@expression' }],
        // Plain text outside expressions
        [/[^{]+/, 'string.plain'],
        [/\{(?!\{)/, 'string.plain'],
      ],
      expression: [
        // Closing double braces
        [/\}\}/, { token: 'delimiter.expression', next: '@root' }],
        // Pipe operator for filters
        [/\|/, 'operator.pipe'],
        // Dot-separated identifiers inside expression
        [/[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*/, 'variable.expression'],
        // Whitespace inside expression
        [/\s+/, 'white'],
        // Anything else inside an expression
        [/./, 'variable.expression'],
      ],
    },
  } as Parameters<Monaco['languages']['setMonarchTokensProvider']>[1]);

  // Define the dark theme to match Obsidian Command
  monaco.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'ffffff', background: '0a0a0f' },
      { token: 'string.plain', foreground: '9ca3af' },
      { token: 'delimiter.expression', foreground: 'f0c040', fontStyle: 'bold' },
      { token: 'variable.expression', foreground: '00d4ff' },
      { token: 'operator.pipe', foreground: 'f0c040', fontStyle: 'bold' },
      { token: 'white', foreground: '555555' },
    ],
    colors: {
      'editor.background': '#0a0a0f',
      'editor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#0d0d1500', // transparent — single-line editor
      'editor.selectionBackground': '#f0c04030',
      'editorCursor.foreground': '#f0c040',
      'editor.selectionHighlightBackground': '#f0c04015',
      'editorBracketMatch.background': '#f0c04020',
      'editorBracketMatch.border': '#f0c04060',
      'editorOverviewRuler.errorForeground': '#ef4444',
      'editorError.foreground': '#ef4444',
      'editorWidget.background': '#0d0d15',
      'editorWidget.border': '#1a1a2e',
      'editorSuggestWidget.background': '#0d0d15',
      'editorSuggestWidget.border': '#1a1a2e',
      'editorSuggestWidget.foreground': '#ffffff',
      'editorSuggestWidget.selectedBackground': '#1a1a2e',
      'editorSuggestWidget.highlightForeground': '#f0c040',
      'input.background': '#0a0a0f',
      'input.border': '#1a1a2e',
      'focusBorder': '#f0c04060',
      'scrollbarSlider.background': '#1a1a2e80',
      'scrollbarSlider.hoverBackground': '#1a1a2ea0',
    },
  });
}

// ---------------------------------------------------------------------------
// Autocomplete provider factory — unique per component instance so it can
// reference the latest availableNodes without stale closures.
// ---------------------------------------------------------------------------

// Completion item shape that satisfies Monaco's completion provider.
// We use a plain interface rather than importing from monaco-editor directly.
interface ExprCompletionItem {
  label: string;
  kind: number;
  insertText: string;
  detail: string;
  documentation: string;
  range: unknown;
}

function buildCompletionItems(
  monaco: Monaco,
  availableNodes: AvailableNode[],
): ExprCompletionItem[] {
  const range = undefined!; // Range is set per-call in provideCompletionItems

  const items: ExprCompletionItem[] = [];

  // Previous node context
  for (const path of PREV_SUGGESTIONS) {
    items.push({
      label: `{{${path}}}`,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: `{{${path}}}`,
      detail: 'Previous node',
      documentation: `Reference the ${path.split('.')[1]} of the previous node in the workflow chain.`,
      range,
    });
  }

  // Per-node references
  for (const node of availableNodes) {
    items.push({
      label: `{{${node.id}.output}}`,
      kind: monaco.languages.CompletionItemKind.Reference,
      insertText: `{{${node.id}.output}}`,
      detail: node.label,
      documentation: `Output from node "${node.label}" (${node.id})`,
      range,
    });
  }

  // Trigger context
  for (const path of TRIGGER_SUGGESTIONS) {
    items.push({
      label: `{{${path}}}`,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `{{${path}}}`,
      detail: 'Trigger data',
      documentation: `Access ${path} from the workflow trigger payload.`,
      range,
    });
  }

  // Environment variables
  for (const path of ENV_SUGGESTIONS) {
    items.push({
      label: `{{${path}}}`,
      kind: monaco.languages.CompletionItemKind.Constant,
      insertText: `{{${path}}}`,
      detail: 'Environment',
      documentation: `Read the ${path.split('.')[1]} environment variable.`,
      range,
    });
  }

  // Pipe filters — inserted after a pipe inside an existing expression
  for (const filter of FILTER_SUGGESTIONS) {
    items.push({
      label: `| ${filter}`,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: `| ${filter}`,
      detail: 'Filter',
      documentation: `Apply the "${filter}" transform to the preceding value.`,
      range,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Validation — red underlines for unmatched braces
// ---------------------------------------------------------------------------

function validateExpression(
  model: ITextModel,
  monaco: Monaco,
): void {
  const text = model.getValue();
  const markers: IMarkerData[] = [];

  // Find all {{ and }} and check they are balanced
  let openIdx = -1;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{' && i + 1 < text.length && text[i + 1] === '{') {
      if (openIdx !== -1) {
        // Nested {{ before closing — mark the second opening as error
        const pos = model.getPositionAt(i);
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Unexpected {{ inside an already-open expression',
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + 2,
        });
      }
      openIdx = i;
      i += 2;
      continue;
    }
    if (text[i] === '}' && i + 1 < text.length && text[i + 1] === '}') {
      if (openIdx === -1) {
        // Closing without opening
        const pos = model.getPositionAt(i);
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Closing }} without a matching {{',
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + 2,
        });
      }
      openIdx = -1;
      i += 2;
      continue;
    }
    i++;
  }

  // If we ended with an unclosed {{
  if (openIdx !== -1) {
    const pos = model.getPositionAt(openIdx);
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed {{ — missing matching }}',
      startLineNumber: pos.lineNumber,
      startColumn: pos.column,
      endLineNumber: pos.lineNumber,
      endColumn: pos.column + 2,
    });
  }

  monaco.editor.setModelMarkers(model, 'harbinger-expr-validation', markers);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  value,
  onChange,
  availableNodes = [],
  placeholder = '{{prev.output}} | json',
}) => {
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Keep a mutable ref of availableNodes so the completion provider always
  // sees the latest list without re-registering.
  const nodesRef = useRef(availableNodes);
  useEffect(() => {
    nodesRef.current = availableNodes;
  }, [availableNodes]);

  // Register language + theme before the editor mounts
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerExpressionLanguage(monaco);
  }, []);

  const handleMount: OnMount = useCallback(
    (ed, monaco) => {
      editorRef.current = ed;
      monacoRef.current = monaco;

      // -- Completion provider --
      const completionDisposable = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
        triggerCharacters: ['{', '.', '|', ' '],
        provideCompletionItems(model: ITextModel, position: { lineNumber: number; column: number }) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endLineNumber: position.lineNumber,
            endColumn: word.endColumn,
          };

          const items = buildCompletionItems(monaco, nodesRef.current);
          // Assign the computed range to each item
          for (const item of items) {
            item.range = range;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structurally compatible with Monaco CompletionItem
          return { suggestions: items as any[] };
        },
      });
      disposablesRef.current.push(completionDisposable);

      // -- Initial validation --
      const model = ed.getModel();
      if (model) {
        validateExpression(model, monaco);
      }

      // -- Re-validate on content change --
      const changeDisposable = ed.onDidChangeModelContent(() => {
        const m = ed.getModel();
        if (m) validateExpression(m, monaco);
      });
      disposablesRef.current.push(changeDisposable);

      // -- Single-line behavior: Enter blurs instead of inserting newline
      // when not expanded --
      ed.addCommand(monaco.KeyCode.Enter, () => {
        if (!expanded) {
          ed.trigger('keyboard', 'hideSuggestWidget', {});
          (document.activeElement as HTMLElement)?.blur();
        } else {
          ed.trigger('keyboard', 'type', { text: '\n' });
        }
      });

      // Escape always blurs
      ed.addCommand(monaco.KeyCode.Escape, () => {
        ed.trigger('keyboard', 'hideSuggestWidget', {});
        (document.activeElement as HTMLElement)?.blur();
      });

      // Remove default scroll-beyond-last-line padding
      ed.updateOptions({ scrollBeyondLastLine: false });
    },
    [expanded],
  );

  // Cleanup disposables on unmount
  useEffect(() => {
    return () => {
      for (const d of disposablesRef.current) {
        d.dispose();
      }
      disposablesRef.current = [];
    };
  }, []);

  // Re-validate whenever availableNodes changes (a referenced node may have
  // been added or removed — future enhancement could flag unknown node ids).
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) validateExpression(model, monacoRef.current);
    }
  }, [availableNodes]);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? '');
    },
    [onChange],
  );

  const editorHeight = expanded ? 120 : 32;

  // Show a faint placeholder overlay when value is empty
  const showPlaceholder = !value;

  return (
    <div
      className="relative group rounded border border-[#1a1a2e] transition-colors focus-within:border-[#f0c04060] bg-[#0a0a0f]"
      style={{ height: editorHeight, minHeight: 32 }}
    >
      {/* Placeholder text — visible when editor is empty */}
      {showPlaceholder && (
        <div
          className="absolute inset-0 flex items-center px-2 text-xs text-[#555555] font-mono pointer-events-none z-10 select-none"
          style={{ lineHeight: '32px' }}
        >
          {placeholder}
        </div>
      )}

      <Editor
        height={editorHeight}
        language={LANGUAGE_ID}
        theme={THEME_ID}
        value={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: 'off',
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          minimap: { enabled: false },
          scrollbar: {
            vertical: expanded ? 'auto' : 'hidden',
            horizontal: 'hidden',
            useShadows: false,
            verticalScrollbarSize: 4,
          },
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderLineHighlight: 'none',
          wordWrap: expanded ? 'on' : 'off',
          wrappingStrategy: 'advanced',
          padding: { top: expanded ? 6 : 7, bottom: 0 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, strings: true, comments: false },
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          contextmenu: false,
          // Prevent scroll-jacking the parent when editor hits bounds
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fixedOverflowWidgets: true,
        }}
      />

      {/* Expand / collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="absolute top-0.5 right-1 text-[9px] text-[#555555] hover:text-[#f0c040] transition-colors z-20 opacity-0 group-hover:opacity-100 font-mono"
        title={expanded ? 'Collapse editor' : 'Expand editor'}
      >
        {expanded ? '[-]' : '[+]'}
      </button>
    </div>
  );
};

export default ExpressionEditor;
