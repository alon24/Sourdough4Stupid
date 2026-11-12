import help from '../../../docs/HELP.md?raw';
import { renderMd } from '../md';

const html = renderMd(help);

export function Help() {
  const click = (e: MouseEvent) => {
    const id = (e.target as HTMLElement).closest('a[data-anchor]')?.getAttribute('data-anchor');
    if (id) { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
  };
  return (
    <main class="screen help" onClick={click}>
      <a class="back" href="#/">‹ חזרה</a>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
