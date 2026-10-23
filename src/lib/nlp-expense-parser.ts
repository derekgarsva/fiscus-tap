export interface ParsedExpense {
  amount: number | null;
  currency: string;
  description: string;
  category: string;
  categoryIcon: string;
  confidence: number;
  rawText: string;
}

const CATEGORY_MAP: Record<string, { name: string; icon: string; keywords: string[] }> = {
  food: {
    name: "Food & Drink",
    icon: "☕",
    keywords: [
      "coffee", "cafe", "tea", "latte", "espresso", "matcha", "cappuccino",
      "lunch", "dinner", "breakfast", "brunch", "almuerzo", "cena", "desayuno",
      "pizza", "burger", "tacos", "sushi", "ramen", "pasta", "sandwich",
      "beer", "cerveza", "wine", "cocktail", "bar", "pub", "starbucks",
      "restaurant", "restaurante", "snack", "bakery", "panaderia", "dessert",
      "ice cream", "helado", "food", "comida", "mc donalds", "mcdonalds", "kfc"
    ],
  },
  transport: {
    name: "Transport",
    icon: "🚕",
    keywords: [
      "uber", "taxi", "cab", "lyft", "didi", "ridery", "yummy", "ride",
      "metro", "subway", "bus", "train", "tren", "gas", "gasolina", "petrol",
      "parking", "estacionamiento", "toll", "peaje", "flight", "vuelo",
      "airline", "avianca", "copa", "ticket", "pasaje", "scooter"
    ],
  },
  groceries: {
    name: "Groceries",
    icon: "🛒",
    keywords: [
      "groceries", "super", "supermarket", "supermercado", "market", "mercado",
      "walmart", "target", "trader joe", "costco", "carrefour", "mercadona",
      "automercado", "gama", "plazas", "vea", "fruits", "vegetables", "milk",
      "eggs", "bread", "bodega"
    ],
  },
  shopping: {
    name: "Shopping",
    icon: "🛍️",
    keywords: [
      "amazon", "clothes", "ropa", "shoes", "zapatos", "zara", "h&m", "nike",
      "adidas", "apple", "gadget", "electronics", "book", "books", "libro",
      "mall", "tienda", "shopping", "compra", "regalo", "gift"
    ],
  },
  entertainment: {
    name: "Entertainment",
    icon: "🎬",
    keywords: [
      "netflix", "spotify", "hulu", "disney", "hbo", "prime", "movie", "cine",
      "cinema", "theater", "teatro", "concert", "concierto", "festival",
      "game", "steam", "playstation", "xbox", "nintendo", "party", "club"
    ],
  },
  health: {
    name: "Health & Fitness",
    icon: "💪",
    keywords: [
      "gym", "gimnasio", "fitness", "workout", "crossfit", "pharmacy", "farmacia",
      "doctor", "dentist", "dentista", "medicine", "medicina", "hospital",
      "clinic", "clinica", "supplements", "vitamins", "massage", "terapia"
    ],
  },
  utilities: {
    name: "Bills & Utilities",
    icon: "⚡",
    keywords: [
      "electric", "electricity", "luz", "water", "agua", "gas bill", "internet",
      "wifi", "phone bill", "cantv", "corpoelec", "hidrocapital", "movistar",
      "digitel", "rent", "alquiler", "condo", "condominio", "maintenance"
    ],
  },
  subscriptions: {
    name: "Subscriptions & Tech",
    icon: "💻",
    keywords: [
      "chatgpt", "openai", "claude", "github", "cursor", "vercel", "aws", "gcp",
      "domain", "hosting", "software", "icloud", "google one", "notion", "adobe"
    ],
  },
};

export function parseExpenseNaturalLanguage(
  input: string,
  defaultCurrency = "SGD"
): ParsedExpense {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      amount: null,
      currency: defaultCurrency,
      description: "",
      category: "General",
      categoryIcon: "🧾",
      confidence: 0,
      rawText: "",
    };
  }

  // Detect explicit currency in string
  let detectedCurrency = defaultCurrency;
  if (/(\bSGD\b|\$SGD|\bS\$\b)/i.test(trimmed)) detectedCurrency = "SGD";
  else if (/(\bUSD\b|\$USD|\$)/i.test(trimmed)) detectedCurrency = "USD";
  else if (/(\bEUR\b|€)/i.test(trimmed)) detectedCurrency = "EUR";
  else if (/(\bGBP\b|£)/i.test(trimmed)) detectedCurrency = "GBP";
  else if (/(\bBs\.?\b|\bVES\b)/i.test(trimmed)) detectedCurrency = "VES";

  // Regex to extract numeric amount (e.g. 6, 6.00, 12.50, $45, 120,50)
  // Look for currency symbol + number OR number standalone
  const amountRegex = /(?:[\$€£]|Bs\.?|SGD\s*)?\s*(\d+(?:[.,]\d{1,2})?)(?:\s*(?:[\$€£]|Bs\.?|SGD|USD|EUR))?/i;
  const match = trimmed.match(amountRegex);

  let amount: number | null = null;
  let remainingText = trimmed;

  if (match && match[1]) {
    const rawNum = match[1].replace(",", ".");
    const parsed = parseFloat(rawNum);
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
      // Remove the matched amount chunk from text to leave the description
      remainingText = trimmed.replace(match[0], "").trim();
    }
  }

  // Clean description: remove prepositions and filler words
  let description = remainingText
    .replace(/^(paid|spent|bought|for|at|on|in|un|una|el|la|de|en|por)\s+/gi, "")
    .replace(/\s+(sgd|usd|eur|gbp|ves|dollars?|pesos?|bolivares?)$/gi, "")
    .trim();

  // If description is empty, fallback to "Expense" or inferred label
  if (!description) {
    description = amount ? `Expense of ${amount}` : "General Expense";
  } else {
    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // Categorize based on keywords in whole input
  const lowerAll = trimmed.toLowerCase();
  let matchedCategory = "General";
  let matchedIcon = "🧾";
  let confidence = 0.3;

  for (const [, cat] of Object.entries(CATEGORY_MAP)) {
    for (const kw of cat.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(lowerAll)) {
        matchedCategory = cat.name;
        matchedIcon = cat.icon;
        confidence = 0.95;
        break;
      }
    }
    if (confidence > 0.5) break;
  }

  return {
    amount,
    currency: detectedCurrency,
    description,
    category: matchedCategory,
    categoryIcon: matchedIcon,
    confidence,
    rawText: trimmed,
  };
}
