export function formatArticleContent(content: string): string {
  // Clean multiple spaces
  let text = content.replace(/[ \t]+/g, ' ').trim();
  
  // Format paragraphs/bents with newlines
  text = text.replace(/ \(([0-9]+)\)/g, '\n($1)');
  text = text.replace(/ ([a-zçğıöşü])\)/gi, '\n$1)');
  text = text.replace(/ ([0-9]+)\)/g, '\n$1)');
  
  return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

export function parseLegislationText(text: string) {
  // Regex to find "MADDE 1", "GEÇİCİ MADDE 2", etc.
  const regex = /\b(MADDE|GEÇİCİ\s+MADDE|Geçici\s+Madde|Madde)\s+(\d+)\b/gi;
  const articles: any[] = [];
  
  const matches: { index: number; length: number; prefix: string; num: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      prefix: match[1],
      num: match[2]
    });
  }
  
  // Helper to extract bents from an article content
  const extractBents = (articleNo: string, articleTitle: string, rawContent: string, startOrderIndex: number) => {
    // Split text into lines
    const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    const bents: any[] = [];
    
    let currentPara = ''; // e.g. "(1)"
    let currentSub = '';  // e.g. "a)"
    let currentBentText = '';
    let currentBentKey = '';
    
    const pushCurrentBent = () => {
      if (currentBentText.trim()) {
        const key = currentBentKey || articleNo;
        bents.push({
          article_no: key,
          title: articleTitle,
          content: currentBentText.trim(),
        });
      }
    };
    
    for (const line of lines) {
      // Check if line starts with paragraph number, e.g., (1) or (12)
      const paraMatch = line.match(/^(\([0-9]+\))\s*(.*)/);
      // Check if line starts with letter, e.g., a) or ç)
      const letterMatch = line.match(/^([a-zçğıöşüA-Z]\))\s*(.*)/);
      // Check if line starts with number dot or number parenthese, e.g. 1) or 1.
      const numMatch = line.match(/^([0-9]+[\)\.])\s*(.*)/);
      
      if (paraMatch) {
        pushCurrentBent();
        currentPara = paraMatch[1];
        currentSub = '';
        currentBentKey = `${articleNo} ${currentPara}`;
        currentBentText = line; // Include the marker in content
      } else if (letterMatch) {
        pushCurrentBent();
        currentSub = letterMatch[1];
        currentBentKey = `${articleNo} ${currentPara ? currentPara + ' ' : ''}${currentSub}`;
        currentBentText = line;
      } else if (numMatch) {
        pushCurrentBent();
        currentSub = numMatch[1];
        currentBentKey = `${articleNo} ${currentPara ? currentPara + ' ' : ''}${currentSub}`;
        currentBentText = line;
      } else {
        // Continuation of previous bent
        if (bents.length === 0 && !currentBentText) {
          // If we haven't started any bent, treat this as part of the main article text
          currentBentKey = articleNo;
          currentBentText = line;
        } else {
          currentBentText += '\n' + line;
        }
      }
    }
    pushCurrentBent();
    
    // Fallback if no bents found
    if (bents.length === 0) {
      bents.push({
        article_no: articleNo,
        title: articleTitle,
        content: rawContent,
      });
    }
    
    return bents;
  };

  if (matches.length === 0) {
    if (text.trim()) {
      const parsedBents = extractBents('Madde 1', 'Genel Hükümler', text.trim(), 1);
      parsedBents.forEach((b, idx) => {
        articles.push({
          ...b,
          order_index: idx + 1
        });
      });
    }
    return articles;
  }
  
  let orderCounter = 1;
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let rawContent = text.substring(currentMatch.index + currentMatch.length, nextIndex).trim();
    
    // Clean leading dashes, colons, and spaces at the start of the article content
    rawContent = rawContent.replace(/^[-–—:\s]+/, '');
    
    let articleNo = `${currentMatch.prefix} ${currentMatch.num}`;
    let title = articleNo;
    let content = rawContent;
    
    // Search for first paragraph marker like (1) or a) to separate title from content
    const paraIndex = rawContent.search(/(?:\([0-9]+\)|^[a-zçğıöşü]\)|^[0-9]+\))/i);
    if (paraIndex > 0) {
      const potentialTitle = rawContent.substring(0, paraIndex).replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
      if (potentialTitle && potentialTitle.length < 150) {
        title = potentialTitle;
        content = rawContent.substring(paraIndex).trim();
      }
    } else {
      const lines = rawContent.split('\n');
      if (lines.length > 1 && lines[0].trim().length < 100 && !lines[0].includes('(')) {
        title = lines[0].trim().replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
        content = lines.slice(1).join('\n').trim();
      }
    }
    
    content = formatArticleContent(content);
    
    const parsedBents = extractBents(articleNo, title, content, orderCounter);
    parsedBents.forEach(b => {
      articles.push({
        ...b,
        order_index: orderCounter++
      });
    });
  }
  
  return articles;
}
