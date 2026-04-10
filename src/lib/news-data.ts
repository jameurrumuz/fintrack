
import type { NewsArticle } from '@/types';

const LOCAL_STORAGE_KEY = 'newsArticles';

// Initialize with an empty array if no data is found in localStorage
const initializeArticles = (): NewsArticle[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (data) {
    try {
      const parsedData = JSON.parse(data);
      if (Array.isArray(parsedData)) {
        return parsedData;
      }
    } catch (e) {
      console.error("Failed to parse articles from localStorage", e);
      return [];
    }
  }
  return [];
};


// Function to get all articles from localStorage
export function getArticles(): NewsArticle[] {
  return initializeArticles();
}

// Function to save an article (add or update)
export function saveArticle(article: NewsArticle) {
  if (typeof window === 'undefined') return;
  const articles = getArticles();
  const existingIndex = articles.findIndex(a => a.id === article.id);

  if (existingIndex > -1) {
    // Update existing article
    articles[existingIndex] = article;
  } else {
    // Add new article
    articles.unshift(article); // Add to the beginning of the array
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(articles));
}

// Function to delete an article
export function deleteArticle(articleId: string) {
  if (typeof window === 'undefined') return;
  let articles = getArticles();
  articles = articles.filter(a => a.id !== articleId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(articles));
}

// Function to get a single article by slug
export function getArticleBySlug(slug: string): { article: NewsArticle | null, related: NewsArticle[] } {
  const articles = getArticles();
  const article = articles.find(a => a.slug === slug) || null;
  let related: NewsArticle[] = [];
  if (article) {
    related = articles.filter(a => a.category === article.category && a.id !== article.id).slice(0, 5);
  }
  return { article, related };
}
