
export function textify (text, bigIndex) {
  return (text || [])
    .map(([txt, meta]) => {
      if (!meta || !meta.find(cmd => cmd.length > 1)) return txt;
      if (txt === '⁍') {
        const [cmd, content] = meta[0];
        if (cmd === 'e') {
          return content
            .replace(/\\mathrm\{P\}/g, '𝖯')
            .replace(/\\mathrm\{Q\}/g, '𝖰')
            .replace(/\\mathrm\{x\}/g, '𝑥')
            .replace(/\\mathrm\{A\}/g, '𝖠')
            .replace(/\\mathrm\{P\(x\)\}/g, '𝖯(𝑥)')
            .replace(/\\implies/g, '⟹')
            .replace(/\\land/g, '∧')
            .replace(/\\lor/g, '∨')
            .replace(/\\forall/g, '∀')
            .replace(/\\exists/g, '∃')
            .replace(/\\neg/g, '¬')
            .replace(/\\in/g, '∈')
          ;
        }
        else return console.warn(`UKNOWN CMD ${cmd}`);
      }
      if (txt === '‣') {
        const [cmd, id] = meta[0];
        if (cmd === 'p') {
          const node = bigIndex.block[id];
          return textify(node.value?.properties?.title, bigIndex);
        }
        else return console.warn(`UKNOWN CMD ${cmd}`);
      }
    })
    .join('')
  ;
}
