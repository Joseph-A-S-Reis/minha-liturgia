const PREVIEW_BASE_STYLES = `
  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  body {
    color: #1f2937;
    font-family: "Times New Roman", Times, serif;
  }

  .library-html-content {
    color: #1f2937;
    font-size: 1rem;
    line-height: 1.9;
    max-width: 74ch;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .library-html-content--full {
    max-width: none;
    margin: 0;
    width: 100%;
  }

  .library-html-content h1,
  .library-html-content h2,
  .library-html-content h3,
  .library-html-content h4,
  .library-html-content h5,
  .library-html-content h6 {
    color: #0f172a;
    line-height: 1.3;
    letter-spacing: -0.01em;
    margin-top: 1.25rem;
    margin-bottom: 0.75rem;
    font-weight: bold;
  }

  .library-html-content h1 {
    font-size: 2rem;
    font-weight: 800;
  }

  .library-html-content h2 {
    font-size: 1.65rem;
    font-weight: 700;
  }

  .library-html-content h3 {
    font-size: 1.35rem;
    font-weight: 700;
  }

  .library-html-content h4 {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .library-html-content h5 {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .library-html-content h6 {
    font-size: 0.95rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .library-html-content p,
  .library-html-content div,
  .library-html-content section,
  .library-html-content article {
    margin-bottom: 0.95rem;
  }

  .library-html-content ul,
  .library-html-content ol {
    margin: 0.85rem 0 1rem 1.4rem;
  }

  .library-html-content li {
    margin-bottom: 0.35rem;
  }

  .library-html-content blockquote {
    border-left: 4px solid #cbd5e1;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #334155;
    font-style: italic;
  }

  .library-html-content img,
  .library-html-content video,
  .library-html-content iframe {
    display: block;
    max-width: 100%;
    width: 100%;
    height: auto;
    margin: 1rem 0;
    border-radius: 0.5rem;
  }

  .library-html-content audio {
    display: block;
    width: 100%;
    margin: 1rem 0;
  }

  .library-html-content figure {
    margin: 1rem 0;
  }

  .library-html-content figcaption {
    font-size: 0.85rem;
    color: #64748b;
    margin-top: 0.35rem;
  }

  .library-html-content code {
    background: #f1f5f9;
    border-radius: 0.25rem;
    padding: 0.05rem 0.35rem;
  }

  .library-html-content pre {
    overflow: auto;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.85rem;
    margin: 1rem 0;
    line-height: 1.6;
  }

  .library-html-content hr {
    border: 0;
    border-top: 1px solid #dbeafe;
    margin: 1.2rem 0;
  }

  .library-html-content a {
    color: #0369a1;
    text-decoration: none;
  }
`;

export function buildLocalHtmlPreviewDocument(rawHtml: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    doc
      .querySelectorAll(
        "script,style,noscript,object,embed,link,meta,base,head,form,input,button,textarea,select,nav,menu,aside,header,footer,area",
      )
      .forEach((element) => element.remove());

    doc.querySelectorAll("*").forEach((element) => {
      for (const attr of Array.from(element.attributes)) {
        const key = attr.name.toLowerCase();

        if (key === "style" || key === "class" || key === "id" || key.startsWith("on")) {
          element.removeAttribute(attr.name);
        }
      }
    });

    const sanitizedContent = (doc.body?.innerHTML ?? rawHtml).trim();

    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PREVIEW_BASE_STYLES}</style>
  </head>
  <body>
    <main class="library-html-content library-html-content--full">${sanitizedContent}</main>
  </body>
</html>`;
  } catch {
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PREVIEW_BASE_STYLES}</style>
  </head>
  <body>
    <main class="library-html-content library-html-content--full">${rawHtml}</main>
  </body>
</html>`;
  }
}