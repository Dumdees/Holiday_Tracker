// Saving files to the computer and choosing files – the only "file" plumbing in the app.

/** Trigger a download of text content with the given file name. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Open the browser's file chooser. Resolves with the File, or null if cancelled. */
export function pickFile({ accept = '' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const done = (file) => { if (settled) return; settled = true; input.remove(); resolve(file || null); };
    input.addEventListener('change', () => done(input.files && input.files[0]));
    // If the dialog is cancelled, no event fires in some browsers – tidy up when focus returns.
    window.addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) done(null); }, 800), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Read a File as text. */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

/** 'Monteith Holiday Manager backup 2026-04-03.json' style names. */
export function datedFilename(base, ext, iso) {
  return `${base} ${iso}.${ext}`;
}
