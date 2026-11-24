/**
 * Everyday situations for "Conversation au hasard": a role-play or a chat on a theme of real life.
 * Carla picks the 5 most useful words herself, adapted to the learner's level.
 */
export type Situation = {
  id: string;
  emoji: string;
  title: string; // Spanish
  titleFr: string;
  kind: "role-play" | "charla";
  /** What happens, for Carla (French). */
  setup: string;
  persona: string;
  /** Lowest level where it makes sense. */
  level: "A1" | "A2" | "B1";
};

export const SITUATIONS: Situation[] = [
  { id: "bar", emoji: "☕", title: "En el bar", titleFr: "Commander au bar", kind: "role-play", level: "A1", persona: "un camarero sympathique d'un bar de quartier à Madrid", setup: "Elle entre dans un bar le matin. Elle commande un café et quelque chose à manger, demande le prix et paie. Ajoute un petit imprévu (il n'y a plus de croissants)." },
  { id: "restaurante", emoji: "🍽️", title: "Cena en un restaurante", titleFr: "Client et serveur au restaurant", kind: "role-play", level: "A1", persona: "une serveuse d'un restaurant de tapas", setup: "Elle dîne au restaurant : réserver une table, choisir le menu, poser une question sur un plat, signaler un problème (le plat est froid), demander l'addition." },
  { id: "peluqueria", emoji: "💇", title: "En la peluquería", titleFr: "Chez le coiffeur", kind: "role-play", level: "A2", persona: "une coiffeuse bavarde", setup: "Elle va chez le coiffeur : expliquer ce qu'elle veut (couper un peu, la frange, la couleur), réagir au résultat et discuter de tout et de rien pendant la coupe." },
  { id: "mudanza", emoji: "📦", title: "La mudanza", titleFr: "Un déménagement", kind: "role-play", level: "A2", persona: "une amie qui aide au déménagement, puis l'employé d'une entreprise de déménagement", setup: "Elle déménage : organiser le jour du déménagement avec une amie (où mettre les cartons, quelles pièces), puis appeler une entreprise pour demander un devis et une date." },
  { id: "cena-amigos", emoji: "🍷", title: "Cena con amigos", titleFr: "Dîner avec des amis", kind: "charla", level: "A1", persona: "une amie madrilène qui l'invite à dîner", setup: "Un dîner chez des amis : arriver, offrir quelque chose, faire des compliments sur le repas, raconter sa semaine, parler des projets du week-end." },
  { id: "piso", emoji: "🔑", title: "Alquilar un piso", titleFr: "Visiter un appartement", kind: "role-play", level: "A2", persona: "un agent immobilier pressé", setup: "Elle visite un appartement à louer : poser des questions sur le loyer, les charges, le quartier, les transports, négocier la date d'entrée." },
  { id: "farmacia", emoji: "💊", title: "En la farmacia", titleFr: "À la pharmacie", kind: "role-play", level: "A1", persona: "une cliente espagnole (et toi, tu es la pharmacienne)", setup: "Inversion des rôles : elle est la pharmacienne et toi la cliente. Tu as mal à la gorge et tu veux un conseil ; elle doit poser des questions et conseiller simplement." },
  { id: "medico", emoji: "🩺", title: "En el médico", titleFr: "Chez le médecin", kind: "role-play", level: "A2", persona: "une médecin généraliste", setup: "Elle consulte une médecin : expliquer ses symptômes, depuis quand, comprendre les conseils et la posologie." },
  { id: "supermercado", emoji: "🛒", title: "En el supermercado", titleFr: "Au supermarché", kind: "role-play", level: "A1", persona: "un employé du rayon frais", setup: "Elle fait ses courses : demander où se trouve un produit, acheter au rayon charcuterie (cantidades: cien gramos, medio kilo), payer à la caisse." },
  { id: "vecinos", emoji: "🏢", title: "Los vecinos", titleFr: "Avec les voisins", kind: "role-play", level: "A2", persona: "une voisine curieuse de l'immeuble", setup: "Elle croise sa voisine dans l'ascenseur : se présenter, parler de l'immeuble, régler un petit souci (le bruit, un colis reçu par erreur)." },
  { id: "transporte", emoji: "🚇", title: "En el metro", titleFr: "Se déplacer en ville", kind: "role-play", level: "A1", persona: "un passant madrilène puis un guichetier du métro", setup: "Elle est perdue à Madrid : demander son chemin, acheter une carte de transport, comprendre les correspondances." },
  { id: "tienda-ropa", emoji: "👗", title: "En una tienda de ropa", titleFr: "Acheter des vêtements", kind: "role-play", level: "A1", persona: "une vendeuse de boutique", setup: "Elle achète un vêtement : demander sa taille, une autre couleur, essayer, donner son avis, échanger un article." },
  { id: "banco", emoji: "🏦", title: "En el banco", titleFr: "À la banque", kind: "role-play", level: "B1", persona: "un conseiller bancaire", setup: "Elle ouvre un compte en banque en Espagne : documents nécessaires, carte, frais, rendez-vous." },
  { id: "hotel", emoji: "🏨", title: "En el hotel", titleFr: "À l'hôtel", kind: "role-play", level: "A1", persona: "le réceptionniste d'un hôtel", setup: "Elle arrive à l'hôtel : check-in, poser des questions (petit-déjeuner, wifi), signaler un problème dans la chambre." },
  { id: "fin-de-semana", emoji: "🌞", title: "El fin de semana", titleFr: "Raconter son week-end", kind: "charla", level: "A1", persona: "Carla, curieuse, comme une amie", setup: "Discussion de la vie : ce qu'elle a fait le week-end dernier et ce qu'elle prévoit le prochain. Pousse-la à raconter au passé et au futur proche." },
  { id: "trabajo", emoji: "💼", title: "Hablar del trabajo", titleFr: "Parler de son travail", kind: "charla", level: "A2", persona: "Carla, comme une nouvelle collègue", setup: "Discussion de la vie : son métier, une journée type, ce qu'elle aime et ce qui est difficile, ses projets professionnels." },
  { id: "familia", emoji: "👨‍👩‍👧", title: "La familia", titleFr: "Parler de sa famille", kind: "charla", level: "A1", persona: "Carla, comme une amie", setup: "Discussion de la vie : sa famille, où elle vit, les traditions familiales, un souvenir d'enfance." },
  { id: "viajes", emoji: "✈️", title: "Viajes", titleFr: "Voyages et vacances", kind: "charla", level: "A2", persona: "Carla, qui adore voyager", setup: "Discussion de la vie : son meilleur voyage, le prochain, comparer avec les voyages de Carla en Espagne." },
  { id: "comida", emoji: "🥘", title: "La comida", titleFr: "Cuisine et goûts", kind: "charla", level: "A1", persona: "Carla, gourmande", setup: "Discussion de la vie : ce qu'elle aime manger, une recette qu'elle sait faire, les différences entre la cuisine française et espagnole." },
  { id: "ocio", emoji: "🎬", title: "Tiempo libre", titleFr: "Loisirs, séries, sport", kind: "charla", level: "A1", persona: "Carla, comme une amie", setup: "Discussion de la vie : ses loisirs, une série ou un film récent, le sport, ce qu'elle fait le soir." },
  { id: "planes", emoji: "📅", title: "Quedar con alguien", titleFr: "Organiser une sortie", kind: "role-play", level: "A2", persona: "une amie au téléphone", setup: "Elle organise une sortie au téléphone : proposer un plan, fixer l'heure et le lieu, changer de plan à cause d'un imprévu." },
  { id: "queja", emoji: "📞", title: "Una reclamación", titleFr: "Faire une réclamation", kind: "role-play", level: "B1", persona: "un service client au téléphone", setup: "Elle appelle un service client : un colis n'est jamais arrivé. Expliquer le problème, donner les détails, obtenir une solution sans s'énerver." },
  { id: "opinion", emoji: "💬", title: "Dar tu opinión", titleFr: "Donner son avis", kind: "charla", level: "B1", persona: "Carla, qui aime débattre gentiment", setup: "Discussion de la vie : vivre en ville ou à la campagne, télétravail ou bureau. Elle donne son avis, justifie et nuance." },
];

export function getSituation(id: string | undefined): Situation | undefined {
  return SITUATIONS.find((s) => s.id === id);
}

const RANK = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;

/** Situations that fit her level (at most one notch above). */
export function situationsFor(level: string): Situation[] {
  const l = RANK[level as keyof typeof RANK] ?? 0;
  return SITUATIONS.filter((s) => RANK[s.level] <= l + 1);
}

/** A random situation for her level, avoiding the ones done recently. */
export function pickSituation(level: string, recent: string[] = [], rnd = Math.random): Situation {
  const pool = situationsFor(level);
  const fresh = pool.filter((s) => !recent.includes(s.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rnd() * from.length)] ?? SITUATIONS[0];
}
