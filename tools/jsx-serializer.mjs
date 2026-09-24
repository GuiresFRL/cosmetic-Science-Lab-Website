// Mechanical, lossless HTML -> JSX converter used to port the source SPA's markup
// into Next.js page/component files without altering appearance or behavior.

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Boolean HTML attributes: written bare in source (value === ""), must become
// JSX shorthand (`attr`) rather than `attr=""` (which React treats as falsy).
const BOOLEAN_SOURCE_NAMES = new Set([
  'hidden', 'required', 'disabled', 'checked', 'selected', 'open',
  'multiple', 'novalidate', 'readonly', 'autofocus',
]);

// React/TS types these as `number`; the source HTML always has them as text.
const NUMERIC_PROPS = new Set(['tabIndex', 'colSpan', 'rowSpan', 'maxLength', 'minLength']);

// Attribute renames: HTML name (lowercase) -> JSX prop name.
const ATTR_RENAME = {
  'class': 'className',
  'for': 'htmlFor',
  'tabindex': 'tabIndex',
  'readonly': 'readOnly',
  'autofocus': 'autoFocus',
  'autocomplete': 'autoComplete',
  'autoplay': 'autoPlay',
  'crossorigin': 'crossOrigin',
  'novalidate': 'noValidate',
  'contenteditable': 'contentEditable',
  'spellcheck': 'spellCheck',
  'enctype': 'encType',
  'formaction': 'formAction',
  'colspan': 'colSpan',
  'rowspan': 'rowSpan',
  'usemap': 'useMap',
  'cellpadding': 'cellPadding',
  'cellspacing': 'cellSpacing',
  'frameborder': 'frameBorder',
  'allowfullscreen': 'allowFullScreen',
  'srcset': 'srcSet',
  'accesskey': 'accessKey',
  'playsinline': 'playsInline',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
  'inputmode': 'inputMode',
  'enterkeyhint': 'enterKeyHint',
  'datetime': 'dateTime',
  // SVG presentation attributes (kebab-case in source -> camelCase in JSX)
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-opacity': 'strokeOpacity',
  'stroke-miterlimit': 'strokeMiterlimit',
  'fill-rule': 'fillRule',
  'fill-opacity': 'fillOpacity',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'text-anchor': 'textAnchor',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'dominant-baseline': 'dominantBaseline',
  'letter-spacing': 'letterSpacing',
};

function camelCaseCss(prop) {
  if (prop.startsWith('--')) return prop;
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// Splits an inline style string into [prop, value] pairs without breaking on
// semicolons that appear inside url(...) (e.g. data: URIs).
function styleToPairs(str) {
  const urls = [];
  const protectedStr = str.replace(/url\([^)]*\)/g, (m) => {
    urls.push(m);
    return `__URL_${urls.length - 1}__`;
  });
  return protectedStr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx === -1) throw new Error('Malformed style declaration: ' + decl);
      const prop = decl.slice(0, idx).trim();
      let value = decl.slice(idx + 1).trim();
      value = value.replace(/__URL_(\d+)__/g, (_, i) => urls[+i]);
      return [prop, value];
    });
}

// Known onclick="..." patterns present in the source (verified exhaustively
// against the file). Anything else throws so it can't be silently dropped.
function onClickToJsx(rawValue) {
  const v = rawValue.trim();
  if (v === 'return false') {
    return "onClick={(e) => e.preventDefault()}";
  }
  if (v === 'event.stopPropagation()') {
    return 'onClick={(e) => e.stopPropagation()}';
  }
  if (v.startsWith("document.body.classList.toggle('tp-hide-notes')")) {
    return (
      'onClick={(e) => { ' +
      "document.body.classList.toggle('tp-hide-notes'); " +
      "e.currentTarget.textContent = document.body.classList.contains('tp-hide-notes') " +
      "? 'Show writer notes' : 'Hide writer notes'; " +
      '}}'
    );
  }
  throw new Error('Unknown onclick pattern, please add explicit handling: ' + JSON.stringify(rawValue));
}

function serializeAttrs(node) {
  const attribs = node.attribs || {};
  let out = '';
  let hasEventHandler = false;

  for (const rawKey of Object.keys(attribs)) {
    const lowerKey = rawKey.toLowerCase();
    const value = attribs[rawKey];

    if (lowerKey === 'style') continue; // handled separately

    if (lowerKey === 'onclick') {
      out += ' ' + onClickToJsx(value);
      hasEventHandler = true;
      continue;
    }
    if (lowerKey.startsWith('on')) {
      throw new Error(`Unhandled event attribute "${rawKey}" (value=${JSON.stringify(value)})`);
    }

    const jsxName = ATTR_RENAME[lowerKey] || rawKey;

    if (BOOLEAN_SOURCE_NAMES.has(lowerKey) && value === '') {
      out += ' ' + jsxName;
      continue;
    }

    // React types these DOM props as `number`, not `string`, even though the
    // source HTML attribute is always textual.
    if (NUMERIC_PROPS.has(jsxName) && /^-?\d+$/.test(value)) {
      out += ` ${jsxName}={${Number(value)}}`;
      continue;
    }

    out += ` ${jsxName}={${JSON.stringify(value)}}`;
  }

  let needsCssVarCast = false;
  if (attribs.style) {
    const pairs = styleToPairs(attribs.style);
    const body = pairs
      .map(([p, v]) => `${JSON.stringify(camelCaseCss(p))}: ${JSON.stringify(v)}`)
      .join(', ');
    const hasCustomProp = pairs.some(([p]) => p.startsWith('--'));
    if (hasCustomProp) {
      out += ` style={{${body}} as CSSProperties}`;
      needsCssVarCast = true;
    } else {
      out += ` style={{${body}}}`;
    }
  }

  return { attrs: out, hasEventHandler, needsCssVarCast };
}

function serializeNode(node, ctx) {
  if (node.type === 'text') {
    if (/^\s*$/.test(node.data)) return '';
    return `{${JSON.stringify(node.data)}}`;
  }
  if (node.type === 'comment') {
    const safe = node.data.replace(/\*\//g, '* /');
    return `{/*${safe}*/}`;
  }
  if (node.type === 'tag') {
    return serializeTag(node, ctx);
  }
  return '';
}

function serializeTag(node, ctx) {
  const tag = node.tagName || node.name;
  const { attrs, hasEventHandler, needsCssVarCast } = serializeAttrs(node);
  if (hasEventHandler) ctx.needsClient = true;
  if (needsCssVarCast) ctx.needsCssVarCast = true;

  const childrenNodes = node.children || [];
  const childrenJsx = childrenNodes.map((c) => serializeNode(c, ctx)).join('');
  const isVoid = VOID_ELEMENTS.has(tag.toLowerCase());

  if (isVoid) {
    return `<${tag}${attrs} />`;
  }
  if (childrenJsx.trim() === '') {
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${childrenJsx}</${tag}>`;
}

// Converts an array of cheerio/htmlparser2 child nodes (a fragment) to a JSX
// string. Returns { jsx, needsClient } where needsClient is true if any
// element required an onClick handler (so the page must be a Client Component).
export function nodesToJsx(nodes) {
  const ctx = { needsClient: false, needsCssVarCast: false };
  const parts = nodes.map((n) => serializeNode(n, ctx)).filter((s) => s !== '');
  const jsx = parts.length === 1 ? parts[0] : `<>${parts.join('')}</>`;
  return { jsx, needsClient: ctx.needsClient, needsCssVarCast: ctx.needsCssVarCast };
}
