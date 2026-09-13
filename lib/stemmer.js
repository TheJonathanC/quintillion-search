// Morphological Stemming and Text Analysis for Quintillion v2

const stemmingRules = {
  // Plurals
  'plants': 'plant',
  'gardens': 'garden',
  'flowers': 'flower',
  'recipes': 'recipe',
  'foods': 'food',
  'meals': 'meal',
  'exercises': 'exercise',
  'workouts': 'workout',
  'techniques': 'technique',
  'methods': 'method',
  'tips': 'tip',
  'ideas': 'idea',
  'photos': 'photo',
  'images': 'image',
  'books': 'book',
  'tools': 'tool',
  'skills': 'skill',
  'projects': 'project',
  'homes': 'home',
  'houses': 'house',
  'cars': 'car',
  'systems': 'system',
  'solutions': 'solution',
  'documents': 'document',
  'guides': 'guide',
  'tutorials': 'tutorial',
  'functions': 'function',
  'classes': 'class',
  'modules': 'module',
  'packages': 'package',
  'libraries': 'library',
  'components': 'component',
  'hooks': 'hook',
  'routes': 'route',
  'servers': 'server',
  'clients': 'client',
  'databases': 'database',
  'requests': 'request',
  'responses': 'response',
  'errors': 'error',
  'exceptions': 'exception',
  
  // -ing forms
  'cooking': 'cook',
  'baking': 'bake',
  'gardening': 'garden',
  'planting': 'plant',
  'growing': 'grow',
  'training': 'train',
  'learning': 'learn',
  'building': 'build',
  'working': 'work',
  'traveling': 'travel',
  'running': 'run',
  'walking': 'walk',
  'eating': 'eat',
  'drinking': 'drink',
  'reading': 'read',
  'writing': 'write',
  'planning': 'plan',
  'organizing': 'organize',
  'cleaning': 'clean',
  'decorating': 'decorate',
  'programming': 'program',
  'developing': 'develop',
  'coding': 'code',
  'testing': 'test',
  'debugging': 'debug',
  'deploying': 'deploy',
  'routing': 'route',
  'fetching': 'fetch',
  'crawling': 'crawl',
  'indexing': 'index',
  'ranking': 'rank',

  // -ed forms
  'cooked': 'cook',
  'baked': 'bake',
  'planted': 'plant',
  'trained': 'train',
  'learned': 'learn',
  'worked': 'work',
  'traveled': 'travel',
  'planned': 'plan',
  'organized': 'organize',
  'cleaned': 'clean',
  'decorated': 'decorate',
  'created': 'create',
  'developed': 'develop',
  'compiled': 'compile',
  'rendered': 'render',
  'executed': 'execute',

  // -er forms
  'bigger': 'big',
  'smaller': 'small',
  'faster': 'fast',
  'slower': 'slow',
  'better': 'good',
  'worker': 'work',
  'trainer': 'train',
  'baker': 'bake',
  'cooker': 'cook',
  'gardener': 'garden',
  'photographer': 'photo',
  'developer': 'develop',
  'programmer': 'program',

  // -ly forms
  'quickly': 'quick',
  'easily': 'easy',
  'slowly': 'slow',
  'carefully': 'care',
  'properly': 'proper',
  'naturally': 'natural',
  'healthy': 'health',
  'asynchronously': 'asynchronous',

  // -tion/-sion
  'preparation': 'prepare',
  'organization': 'organize',
  'information': 'inform',
  'education': 'educate',
  'nutrition': 'nutrient',
  'meditation': 'meditate',
  'restoration': 'restore',
  'creation': 'create',
  'decoration': 'decorate',
  'installation': 'install',
  'documentation': 'document',
  'implementation': 'implement',
  'authentication': 'authenticate',
  'authorization': 'authorize',
  'navigation': 'navigate',
  'configuration': 'configure'
};

export function sanitizeWord(word) {
  if (!word) return '';
  return word.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

export function getStem(word) {
  const lower = sanitizeWord(word);
  if (!lower) return '';

  if (stemmingRules[lower]) {
    return stemmingRules[lower];
  }

  let stem = lower;
  if (stem.endsWith('ies') && stem.length > 4) {
    stem = stem.slice(0, -3) + 'y';
  } else if (stem.endsWith('ied') && stem.length > 4) {
    stem = stem.slice(0, -3) + 'y';
  } else if (stem.endsWith('ing') && stem.length > 4) {
    stem = stem.slice(0, -3);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      const lastChar = stem[stem.length - 1];
      if ('bdfgklmnprtv'.includes(lastChar)) {
        stem = stem.slice(0, -1);
      }
    }
  } else if (stem.endsWith('ed') && stem.length > 3) {
    stem = stem.slice(0, -2);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      const lastChar = stem[stem.length - 1];
      if ('bdfgklmnprtv'.includes(lastChar)) {
        stem = stem.slice(0, -1);
      }
    }
  } else if (stem.endsWith('s') && stem.length > 3 && !stem.endsWith('ss')) {
    stem = stem.slice(0, -1);
  }

  return stem;
}

export function getWordVariations(word) {
  const clean = sanitizeWord(word);
  if (!clean) return [];
  const stem = getStem(clean);
  const variations = new Set([clean, stem]);

  Object.entries(stemmingRules).forEach(([variant, root]) => {
    if (root === stem || variant === clean) {
      variations.add(variant);
      variations.add(root);
    }
  });

  return Array.from(variations);
}

export function extractTokens(text) {
  if (!text) return [];
  return text
    .split(/\s+/)
    .map(sanitizeWord)
    .filter((w) => w.length > 1);
}
